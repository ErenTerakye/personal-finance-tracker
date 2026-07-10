"""Executable transaction-ownership contracts for services and repositories."""

import ast
from pathlib import Path

import pytest

from finance_tracker.repositories.transactions import TransactionRepository
from finance_tracker.services import RecurringTemplateService, TransactionService

REPOSITORY_ROOT = Path(__file__).parents[1] / "src" / "finance_tracker" / "repositories"


def test_recurring_multi_write_failure_rolls_back_the_complete_use_case(tmp_path, monkeypatch):
    db_path = tmp_path / "atomic.sqlite3"
    recurring = RecurringTemplateService(db_path)
    recurring.add_template("expense", "10", "Food", "First", 1)
    recurring.add_template("expense", "20", "Rent", "Second", 2)
    original_add = TransactionRepository.add
    add_calls = 0

    def fail_on_second_add(self, transaction):
        nonlocal add_calls
        add_calls += 1
        if add_calls == 2:
            raise RuntimeError("forced second-write failure")
        return original_add(self, transaction)

    monkeypatch.setattr(TransactionRepository, "add", fail_on_second_add)

    with pytest.raises(RuntimeError, match="forced second-write failure"):
        recurring.apply_templates(month=7, year=2026)

    assert add_calls == 2
    assert TransactionService(db_path).count_transactions() == 0


def test_repositories_never_commit_or_roll_back_transactions():
    violations = []
    transaction_sql = {"COMMIT", "ROLLBACK"}

    for path in sorted(REPOSITORY_ROOT.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            if node.func.attr in {"commit", "rollback"}:
                violations.append(f"{path.name}:{node.lineno} calls {node.func.attr}()")
            if node.func.attr not in {"execute", "executemany", "executescript"} or not node.args:
                continue
            sql = node.args[0]
            if isinstance(sql, ast.Constant) and isinstance(sql.value, str):
                first_token = sql.value.strip().split(maxsplit=1)[0].upper()
                if first_token in transaction_sql:
                    violations.append(f"{path.name}:{node.lineno} executes {first_token}")

    assert not violations, "Repositories own transaction boundaries:\n" + "\n".join(violations)
