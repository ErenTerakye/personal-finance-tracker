"""Frozen inbound-adapter manifests from the architecture cleanup RFC."""

from collections.abc import Mapping

from fastapi.testclient import TestClient
from typer.main import get_command
from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.web.app import create_app

CLI_PARAMETER_NAMES = {
    "init": ("db_path",),
    "web": ("host", "port", "db_path"),
    "add": ("transaction_type", "amount", "category", "description", "transaction_date", "db_path"),
    "list": ("month", "year", "category", "transaction_type", "db_path"),
    "delete": ("transaction_id", "db_path"),
    "budget-set": ("category", "amount", "month", "year", "db_path"),
    "budget-list": ("month", "year", "category", "db_path"),
    "budget-delete": ("budget_id", "db_path"),
    "budget-status": ("month", "year", "db_path"),
    "category-rule-set": ("alias", "category", "db_path"),
    "category-rule-list": ("db_path",),
    "category-rule-delete": ("rule_id", "db_path"),
    "recurring-add": (
        "transaction_type",
        "amount",
        "category",
        "day_of_month",
        "description",
        "db_path",
    ),
    "recurring-list": ("active_only", "db_path"),
    "recurring-delete": ("template_id", "db_path"),
    "recurring-apply": ("month", "year", "db_path"),
    "edit": (
        "transaction_id",
        "transaction_type",
        "amount",
        "category",
        "description",
        "transaction_date",
        "db_path",
    ),
    "summary": ("month", "year", "db_path"),
    "report": ("month", "year", "chart", "db_path"),
    "trends": ("end_month", "end_year", "months", "chart", "db_path"),
    "import-csv": ("path", "preview", "allow_duplicates", "db_path"),
    "import-budgets-csv": ("path", "db_path"),
    "export-csv": ("path", "month", "year", "category", "transaction_type", "db_path"),
    "export-budgets-csv": ("path", "month", "year", "category", "db_path"),
    "settings-get": ("key", "db_path"),
    "settings-set": ("key", "value", "db_path"),
}

POSITIONAL_PARAMETERS = {
    ("add", "transaction_type"),
    ("add", "amount"),
    ("delete", "transaction_id"),
    ("budget-set", "category"),
    ("budget-set", "amount"),
    ("budget-delete", "budget_id"),
    ("category-rule-set", "alias"),
    ("category-rule-set", "category"),
    ("category-rule-delete", "rule_id"),
    ("recurring-add", "transaction_type"),
    ("recurring-add", "amount"),
    ("recurring-delete", "template_id"),
    ("edit", "transaction_id"),
    ("import-csv", "path"),
    ("import-budgets-csv", "path"),
    ("export-csv", "path"),
    ("export-budgets-csv", "path"),
    ("settings-get", "key"),
    ("settings-set", "key"),
    ("settings-set", "value"),
}

OPTION_SPELLINGS = {
    "active_only": ("--active-only",),
    "allow_duplicates": ("--allow-duplicates",),
    "amount": ("--amount", "-a"),
    "category": ("--category", "-c"),
    "chart": ("--chart",),
    "db_path": ("--db-path",),
    "day_of_month": ("--day",),
    "description": ("--description", "-d"),
    "end_month": ("--end-month",),
    "end_year": ("--end-year",),
    "host": ("--host",),
    "month": ("--month", "-m"),
    "months": ("--months",),
    "port": ("--port",),
    "preview": ("--preview",),
    "transaction_date": ("--date",),
    "transaction_type": ("--type", "-t"),
    "year": ("--year", "-y"),
}

REQUIRED_OPTIONS = {
    ("add", "category"),
    ("budget-set", "month"),
    ("budget-set", "year"),
    ("budget-status", "month"),
    ("budget-status", "year"),
    ("recurring-add", "category"),
    ("recurring-add", "day_of_month"),
    ("recurring-apply", "month"),
    ("recurring-apply", "year"),
    ("summary", "month"),
    ("summary", "year"),
    ("report", "month"),
    ("report", "year"),
    ("trends", "end_month"),
    ("trends", "end_year"),
}

CLI_PARAMETER_DEFAULTS = {
    "init": {"db_path": None},
    "web": {"host": "127.0.0.1", "port": 8000, "db_path": None},
    "add": {"description": "", "transaction_date": None, "db_path": None},
    "list": {
        "month": None,
        "year": None,
        "category": None,
        "transaction_type": None,
        "db_path": None,
    },
    "delete": {"db_path": None},
    "budget-set": {"db_path": None},
    "budget-list": {"month": None, "year": None, "category": None, "db_path": None},
    "budget-delete": {"db_path": None},
    "budget-status": {"db_path": None},
    "category-rule-set": {"db_path": None},
    "category-rule-list": {"db_path": None},
    "category-rule-delete": {"db_path": None},
    "recurring-add": {"description": "", "db_path": None},
    "recurring-list": {"active_only": False, "db_path": None},
    "recurring-delete": {"db_path": None},
    "recurring-apply": {"db_path": None},
    "edit": {
        "transaction_type": None,
        "amount": None,
        "category": None,
        "description": None,
        "transaction_date": None,
        "db_path": None,
    },
    "summary": {"db_path": None},
    "report": {"chart": None, "db_path": None},
    "trends": {"months": 6, "chart": None, "db_path": None},
    "import-csv": {"preview": False, "allow_duplicates": False, "db_path": None},
    "import-budgets-csv": {"db_path": None},
    "export-csv": {
        "month": None,
        "year": None,
        "category": None,
        "transaction_type": None,
        "db_path": None,
    },
    "export-budgets-csv": {
        "month": None,
        "year": None,
        "category": None,
        "db_path": None,
    },
    "settings-get": {"db_path": None},
    "settings-set": {"db_path": None},
}

HTTP_OPERATIONS = {
    ("GET", "/api/health"),
    ("GET", "/api/dashboard"),
    ("GET", "/api/transactions"),
    ("POST", "/api/transactions"),
    ("PATCH", "/api/transactions/{transaction_id}"),
    ("DELETE", "/api/transactions/{transaction_id}"),
    ("POST", "/api/transactions/import-csv"),
    ("POST", "/api/transactions/import-csv/preview"),
    ("GET", "/api/transactions/export-csv"),
    ("GET", "/api/budgets"),
    ("POST", "/api/budgets"),
    ("DELETE", "/api/budgets/{budget_id}"),
    ("GET", "/api/budgets/status"),
    ("POST", "/api/budgets/import-csv"),
    ("GET", "/api/budgets/export-csv"),
    ("GET", "/api/category-rules"),
    ("POST", "/api/category-rules"),
    ("DELETE", "/api/category-rules/{rule_id}"),
    ("GET", "/api/recurring-templates"),
    ("POST", "/api/recurring-templates"),
    ("DELETE", "/api/recurring-templates/{template_id}"),
    ("POST", "/api/recurring-templates/apply"),
    ("GET", "/api/reports/monthly.txt"),
    ("GET", "/api/reports/trends.txt"),
    ("GET", "/api/charts/monthly.png"),
    ("GET", "/api/charts/trends.png"),
    ("GET", "/api/settings"),
    ("PUT", "/api/settings"),
}

FROZEN_SCHEMAS = {
    "ApiErrorDetail",
    "ErrorResponse",
    "NoticeResponse",
    "ImportSummaryResponse",
    "TransactionRequest",
    "TransactionPatchRequest",
    "BudgetRequest",
    "CategoryRuleRequest",
    "RecurringTemplateRequest",
    "SettingsRequest",
    "SettingsResponse",
    "TransactionResponse",
    "TransactionPreviewRecordResponse",
    "BudgetResponse",
    "CategoryRuleResponse",
    "RecurringTemplateResponse",
    "BudgetStatusResponse",
    "MonthlyReportResponse",
    "TrendMonthResponse",
    "TrendReportResponse",
    "DashboardResponse",
    "PageResponse",
    "TransactionListResponse",
    "TransactionMutationResponse",
    "BudgetListResponse",
    "BudgetMutationResponse",
    "CategoryRuleListResponse",
    "CategoryRuleMutationResponse",
    "RecurringTemplateListResponse",
    "RecurringTemplateMutationResponse",
    "RecurringApplyResponse",
    "TransactionImportPreviewRowResponse",
    "TransactionImportPreviewResponse",
    "BudgetStatusListResponse",
}


def _api_operations(schema: Mapping[str, object]) -> set[tuple[str, str]]:
    operations = set()
    paths = schema["paths"]
    assert isinstance(paths, dict)
    for path, path_item in paths.items():
        assert isinstance(path_item, dict)
        for method in path_item:
            if method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                operations.add((method.upper(), path))
    return operations


def test_cli_command_and_parameter_manifest_is_frozen():
    root = get_command(app)

    assert set(root.commands) == set(CLI_PARAMETER_NAMES)
    assert len(root.commands) == 26
    for command_name, parameter_names in CLI_PARAMETER_NAMES.items():
        parameters = root.commands[command_name].params
        actual_names = tuple(parameter.name for parameter in parameters)
        assert actual_names == parameter_names
        for parameter in parameters:
            key = (command_name, parameter.name)
            if key in POSITIONAL_PARAMETERS:
                assert parameter.opts == [parameter.name]
                assert parameter.required
            else:
                assert tuple(parameter.opts) == OPTION_SPELLINGS[parameter.name]
                assert parameter.required == (key in REQUIRED_OPTIONS)
        assert {
            parameter.name: parameter.default for parameter in parameters if not parameter.required
        } == CLI_PARAMETER_DEFAULTS[command_name]


def test_cli_representative_success_error_and_output_contract(tmp_path):
    db_path = tmp_path / "cli-contract.sqlite3"
    runner = CliRunner()

    initialized = runner.invoke(app, ["init", "--db-path", str(db_path)])
    added = runner.invoke(
        app,
        [
            "add",
            "expense",
            "12.50",
            "--category",
            "Food",
            "--date",
            "2026-07-10",
            "--db-path",
            str(db_path),
        ],
    )
    listed = runner.invoke(app, ["list", "--db-path", str(db_path)])
    invalid = runner.invoke(
        app,
        [
            "add",
            "expense",
            "0",
            "--category",
            "Food",
            "--db-path",
            str(db_path),
        ],
    )

    assert initialized.exit_code == 0
    assert f"Initialized database at {db_path}" in initialized.output
    assert added.exit_code == 0
    assert "Added #1: expense $12.50 in Food on 2026-07-10" in added.output
    assert listed.exit_code == 0
    assert "Food" in listed.output
    assert "$12.50" in listed.output
    assert invalid.exit_code == 1
    assert "Error: Amount must be greater than zero." in invalid.output


def test_cli_category_rule_and_recurring_command_contracts(tmp_path):
    db_path = tmp_path / "cli-contract.sqlite3"
    runner = CliRunner()

    rule_set = runner.invoke(
        app,
        ["category-rule-set", "groceries", "Food", "--db-path", str(db_path)],
    )
    rule_list = runner.invoke(app, ["category-rule-list", "--db-path", str(db_path)])
    recurring_add = runner.invoke(
        app,
        [
            "recurring-add",
            "expense",
            "1200",
            "--category",
            "Rent",
            "--day",
            "31",
            "--db-path",
            str(db_path),
        ],
    )
    recurring_list = runner.invoke(app, ["recurring-list", "--db-path", str(db_path)])
    recurring_apply = runner.invoke(
        app,
        ["recurring-apply", "--month", "2", "--year", "2026", "--db-path", str(db_path)],
    )
    recurring_delete = runner.invoke(
        app,
        ["recurring-delete", "1", "--db-path", str(db_path)],
    )
    rule_delete = runner.invoke(
        app,
        ["category-rule-delete", "1", "--db-path", str(db_path)],
    )
    missing_rule = runner.invoke(
        app,
        ["category-rule-delete", "1", "--db-path", str(db_path)],
    )
    invalid_recurring = runner.invoke(
        app,
        [
            "recurring-add",
            "expense",
            "10",
            "--category",
            "Rent",
            "--day",
            "0",
            "--db-path",
            str(db_path),
        ],
    )

    assert rule_set.exit_code == 0
    assert "Set category rule #1: groceries -> Food" in rule_set.output
    assert rule_list.exit_code == 0
    assert "groceries" in rule_list.output and "Food" in rule_list.output
    assert recurring_add.exit_code == 0
    assert (
        "Added recurring template #1: expense $1,200.00 in Rent on day 31"
        in recurring_add.output
    )
    assert recurring_list.exit_code == 0
    assert "$1,200.00" in recurring_list.output and "Rent" in recurring_list.output
    assert recurring_apply.exit_code == 0
    assert "Created 1 recurring transaction(s); skipped 0 duplicate(s)." in recurring_apply.output
    assert recurring_delete.exit_code == 0
    assert "Deleted recurring template #1" in recurring_delete.output
    assert rule_delete.exit_code == 0
    assert "Deleted category rule #1" in rule_delete.output
    assert missing_rule.exit_code == 1
    assert "Error: Category rule 1 was not found." in missing_rule.output
    assert invalid_recurring.exit_code == 1
    assert "Error: Day of month must be between 1 and 31." in invalid_recurring.output


def test_cli_delete_transaction_csv_and_settings_command_contracts(tmp_path):
    db_path = tmp_path / "cli-contract.sqlite3"
    import_path = tmp_path / "transactions.csv"
    invalid_import_path = tmp_path / "invalid-transactions.csv"
    export_path = tmp_path / "exported-transactions.csv"
    invalid_export_path = tmp_path / "invalid-export.csv"
    import_path.write_text(
        "type,amount,category,description,date\nexpense,12.50,Food,Lunch,2026-07-10\n",
        encoding="utf-8",
    )
    invalid_import_path.write_text(
        "type,amount,date\nexpense,12.50,2026-07-10\n",
        encoding="utf-8",
    )
    runner = CliRunner()

    runner.invoke(
        app,
        [
            "add",
            "income",
            "100",
            "--category",
            "Salary",
            "--date",
            "2026-07-01",
            "--db-path",
            str(db_path),
        ],
    )
    deleted = runner.invoke(app, ["delete", "1", "--db-path", str(db_path)])
    missing_transaction = runner.invoke(app, ["delete", "1", "--db-path", str(db_path)])
    imported = runner.invoke(app, ["import-csv", str(import_path), "--db-path", str(db_path)])
    exported = runner.invoke(app, ["export-csv", str(export_path), "--db-path", str(db_path)])
    invalid_import = runner.invoke(
        app,
        ["import-csv", str(invalid_import_path), "--db-path", str(db_path)],
    )
    invalid_export = runner.invoke(
        app,
        [
            "export-csv",
            str(invalid_export_path),
            "--month",
            "13",
            "--db-path",
            str(db_path),
        ],
    )
    settings_get = runner.invoke(app, ["settings-get", "currency", "--db-path", str(db_path)])
    settings_set = runner.invoke(
        app,
        ["settings-set", "currency", "TRY", "--db-path", str(db_path)],
    )
    unknown_setting_get = runner.invoke(
        app,
        ["settings-get", "unknown", "--db-path", str(db_path)],
    )
    unknown_setting_set = runner.invoke(
        app,
        ["settings-set", "unknown", "value", "--db-path", str(db_path)],
    )

    assert deleted.exit_code == 0
    assert "Deleted transaction #1" in deleted.output
    assert missing_transaction.exit_code == 1
    assert "Error: Transaction 1 was not found." in missing_transaction.output
    assert imported.exit_code == 0
    assert "Imported 1 transaction(s)." in imported.output
    assert exported.exit_code == 0
    assert f"Exported 1 transaction(s) to {export_path}" in exported.output
    assert "expense,12.50,Food,Lunch,2026-07-10" in export_path.read_text(encoding="utf-8")
    assert invalid_import.exit_code == 1
    assert "Error: CSV file is missing required columns:" in invalid_import.output
    assert invalid_export.exit_code == 1
    assert "Error: Month must be between 1 and 12." in invalid_export.output
    assert settings_get.exit_code == 0
    assert settings_get.output == "USD\n"
    assert settings_set.exit_code == 0
    assert "Set setting 'currency' to 'TRY'." in settings_set.output
    assert unknown_setting_get.exit_code == 1
    assert (
        "Error: Unknown setting key 'unknown'. Supported key: currency"
        in unknown_setting_get.output
    )
    assert unknown_setting_set.exit_code == 1
    assert (
        "Error: Unknown setting key 'unknown'. Supported key: currency"
        in unknown_setting_set.output
    )


def test_openapi_operation_and_schema_manifests_are_frozen(tmp_path):
    schema = create_app(tmp_path / "contract.sqlite3").openapi()

    assert schema["info"] == {"title": "Personal Finance Tracker", "version": "1.1.0"}
    assert _api_operations(schema) == HTTP_OPERATIONS
    assert len(HTTP_OPERATIONS) == 28
    assert set(schema["components"]["schemas"]) >= FROZEN_SCHEMAS


def test_security_cache_and_static_fallback_contract(tmp_path):
    client = TestClient(create_app(tmp_path / "contract.sqlite3"))

    api_response = client.get("/api/health")
    browser_response = client.get("/transactions")

    assert api_response.headers["x-content-type-options"] == "nosniff"
    assert api_response.headers["referrer-policy"] == "no-referrer"
    assert api_response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert api_response.headers["cache-control"] == "no-store"
    assert api_response.headers["content-security-policy"] == (
        "default-src 'self'; script-src 'self'; style-src 'self'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    )
    assert browser_response.status_code == 200
    assert "text/html" in browser_response.headers["content-type"]
    assert client.get("/not-a-route").status_code == 200
    assert client.get("/assets/missing.js").status_code == 404
