"""Executable dependency direction for the layered Python monolith."""

import ast
import importlib.util
import re
from pathlib import Path

SOURCE_ROOT = Path(__file__).parents[2] / "src" / "finance_tracker"

FORBIDDEN_PROJECT_DEPENDENCIES = {
    "models": {"database", "repositories", "services", "csv_io", "reports", "charts", "cli", "web"},
    "database": {"repositories", "services", "csv_io", "reports", "charts", "cli", "web"},
    "repositories": {"services", "csv_io", "reports", "charts", "cli", "web"},
    "services": {"csv_io", "charts", "cli", "tui", "web"},
    "csv_io": {"database", "repositories", "reports", "charts", "cli", "web"},
    "reports": {"database", "repositories", "services", "csv_io", "charts", "cli", "web"},
    "charts": {"database", "repositories", "services", "csv_io", "cli", "web"},
    "cli": {"database", "repositories", "web"},
    "tui": {"database", "repositories", "cli", "web"},
    "web": {"database", "repositories", "cli"},
}


def _layer(path: Path) -> str | None:
    relative = path.relative_to(SOURCE_ROOT)
    first = relative.parts[0]
    if first.endswith(".py"):
        first = first.removesuffix(".py")
    return first if first in FORBIDDEN_PROJECT_DEPENDENCIES else None


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return _imports_from_tree(path, tree)


def _imports_from_tree(path: Path, tree: ast.AST) -> set[str]:
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            import_name = node.module or ""
            if node.level:
                import_name = importlib.util.resolve_name(
                    f"{'.' * node.level}{import_name}",
                    _package_name(path),
                )
            if import_name:
                imports.add(import_name)
                imports.update(
                    f"{import_name}.{alias.name}" for alias in node.names if alias.name != "*"
                )
    return imports


def _package_name(path: Path) -> str:
    relative = path.relative_to(SOURCE_ROOT)
    module_parts = ["finance_tracker", *relative.with_suffix("").parts]
    if path.name == "__init__.py":
        module_parts.pop()
    else:
        module_parts = module_parts[:-1]
    return ".".join(module_parts)


def _project_layer(import_name: str) -> str | None:
    prefix = "finance_tracker."
    if not import_name.startswith(prefix):
        return None
    return import_name.removeprefix(prefix).split(".", maxsplit=1)[0]


def test_relative_project_imports_are_resolved_before_layer_classification():
    path = SOURCE_ROOT / "web" / "routers" / "example.py"
    tree = ast.parse("from ...repositories import TransactionRepository")

    imports = _imports_from_tree(path, tree)

    assert "finance_tracker.repositories" in imports
    assert _project_layer("finance_tracker.repositories") == "repositories"


def test_python_imports_follow_the_target_dependency_direction():
    violations = []
    for path in SOURCE_ROOT.rglob("*.py"):
        importer_layer = _layer(path)
        if importer_layer is None:
            continue
        for imported_name in _imports(path):
            imported_layer = _project_layer(imported_name)
            if imported_layer in FORBIDDEN_PROJECT_DEPENDENCIES[importer_layer]:
                if (
                    importer_layer == "cli"
                    and path.relative_to(SOURCE_ROOT).as_posix() == "cli/web.py"
                    and imported_layer == "web"
                ):
                    continue
                violations.append(
                    f"{path.relative_to(SOURCE_ROOT)} ({importer_layer}) imports "
                    f"{imported_name} ({imported_layer})"
                )

    assert not violations, "Forbidden Python dependency edges:\n" + "\n".join(violations)


def test_web_routers_do_not_import_sibling_routers():
    violations = []
    routers_root = SOURCE_ROOT / "web" / "routers"
    for path in routers_root.glob("*.py"):
        if path.name == "__init__.py":
            continue
        for imported_name in _imports(path):
            if imported_name == "finance_tracker.web.routers" or imported_name.startswith(
                "finance_tracker.web.routers."
            ):
                violations.append(
                    f"{path.relative_to(SOURCE_ROOT)} imports sibling router {imported_name}"
                )

    assert not violations, "Sibling router imports:\n" + "\n".join(violations)


def test_framework_and_matplotlib_imports_stay_at_their_owned_boundaries():
    violations = []
    for path in SOURCE_ROOT.rglob("*.py"):
        imports = _imports(path)
        relative = path.relative_to(SOURCE_ROOT)
        for imported_name in imports:
            top_level_name = imported_name.split(".", maxsplit=1)[0]
            if top_level_name == "matplotlib" and relative.parts[0] != "charts":
                violations.append(f"{relative} imports {imported_name} outside charts")
            if top_level_name == "fastapi" and relative.parts[0] != "web":
                violations.append(f"{relative} imports {imported_name} outside web")
            if top_level_name == "pydantic" and relative.parts[:2] != (
                "web",
                "schemas",
            ):
                violations.append(f"{relative} imports {imported_name} outside web/schemas")
            if top_level_name == "typer" and relative.parts[0] != "cli":
                violations.append(f"{relative} imports {imported_name} outside cli")
            if top_level_name == "textual" and relative.parts[0] != "tui":
                violations.append(f"{relative} imports {imported_name} outside tui")

    assert not violations, "Misplaced framework imports:\n" + "\n".join(violations)


def test_composition_modules_do_not_own_commands_routes_or_schemas():
    cli_tree = ast.parse((SOURCE_ROOT / "cli" / "app.py").read_text(encoding="utf-8"))
    web_tree = ast.parse((SOURCE_ROOT / "web" / "app.py").read_text(encoding="utf-8"))

    assert not [node for node in cli_tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))]
    web_functions = [node.name for node in web_tree.body if isinstance(node, ast.FunctionDef)]
    assert web_functions == ["create_app"]
    assert not [node for node in web_tree.body if isinstance(node, ast.ClassDef)]


def test_inbound_adapters_contain_no_raw_sql():
    sql_pattern = re.compile(
        r"\b(SELECT\b.+\bFROM|INSERT\s+INTO|UPDATE\b.+\bSET|DELETE\s+FROM|"
        r"CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|DROP\s+(TABLE|INDEX)|PRAGMA\s+\w+)",
        re.I | re.S,
    )
    violations = []
    for adapter in ("cli", "tui", "web"):
        for path in (SOURCE_ROOT / adapter).rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Constant)
                    and isinstance(node.value, str)
                    and sql_pattern.search(node.value)
                ):
                    violations.append(f"{path.relative_to(SOURCE_ROOT)} contains raw SQL")

    assert not violations, "Raw SQL at inbound boundaries:\n" + "\n".join(violations)
