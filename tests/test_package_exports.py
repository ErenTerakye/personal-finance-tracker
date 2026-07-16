"""Stable public exports retained by the split core packages."""

import importlib

EXPECTED_EXPORTS = {
    "models": (
        "Account",
        "AccountType",
        "BalanceSnapshot",
        "Budget",
        "BudgetFilters",
        "CategoryRule",
        "RecurringTemplate",
        "ResolvedAccount",
        "Transaction",
        "TransactionFilters",
        "TransactionType",
        "parse_account_type",
        "parse_amount",
        "parse_balance",
        "parse_date",
        "parse_snapshot_date",
        "parse_transaction_type",
        "validate_day_of_month",
        "validate_month",
        "validate_text",
        "validate_year",
    ),
    "repositories": (
        "AccountRepository",
        "BalanceSnapshotRepository",
        "BudgetRepository",
        "CategoryRuleRepository",
        "RecurringTemplateRepository",
        "SettingsRepository",
        "TransactionRepository",
    ),
    "services": (
        "AccountService",
        "BudgetService",
        "BudgetStatus",
        "CategoryRuleService",
        "RecurringApplyResult",
        "RecurringTemplateService",
        "SettingsService",
        "SnapshotMutation",
        "TransactionService",
    ),
    "csv_io": (
        "BUDGET_CSV_FIELDS",
        "CSV_FIELDS",
        "ImportResult",
        "TransactionImportPreview",
        "TransactionImportPreviewRow",
        "export_budgets_csv",
        "export_budgets_csv_text",
        "export_transactions_csv",
        "export_transactions_csv_text",
        "import_budgets_csv",
        "import_budgets_csv_file",
        "import_budgets_csv_text",
        "import_transactions_csv",
        "import_transactions_csv_file",
        "import_transactions_csv_text",
        "preview_transactions_csv_file",
        "preview_transactions_csv_text",
        "write_budgets_csv",
        "write_transactions_csv",
    ),
    "reports": (
        "CURRENCY_SYMBOLS",
        "MonthlyReport",
        "NetWorthHistory",
        "NetWorthSummary",
        "TrendMonth",
        "TrendReport",
        "build_monthly_report",
        "build_net_worth_history",
        "build_net_worth_summary",
        "build_trend_report",
        "format_money",
        "format_monthly_report",
        "format_trend_report",
    ),
    "charts": (
        "render_monthly_chart_png",
        "render_trend_chart_png",
        "save_monthly_chart",
        "save_trend_chart",
    ),
}


def test_split_core_packages_preserve_their_complete_public_export_manifests():
    for package_name, expected_names in EXPECTED_EXPORTS.items():
        package = importlib.import_module(f"finance_tracker.{package_name}")

        assert tuple(package.__all__) == expected_names
        assert all(hasattr(package, name) for name in expected_names)
