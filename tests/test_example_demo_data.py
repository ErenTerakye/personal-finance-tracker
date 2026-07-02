from decimal import Decimal
from pathlib import Path

from finance_tracker.csv_io import import_budgets_csv, import_transactions_csv
from finance_tracker.reports import build_monthly_report, build_trend_report
from finance_tracker.services import BudgetService, TransactionService

EXAMPLES_DIR = Path(__file__).resolve().parents[1] / "examples"


def test_sample_data_builds_rich_reproducible_demo(tmp_path):
    db_path = tmp_path / "demo.sqlite3"
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)

    transaction_import = import_transactions_csv(
        EXAMPLES_DIR / "sample_transactions.csv",
        transactions,
    )
    budget_import = import_budgets_csv(EXAMPLES_DIR / "sample_budgets.csv", budgets)

    assert transaction_import.imported_count == 70
    assert transaction_import.skipped_count == 0
    assert budget_import.imported_count == 63
    assert budget_import.skipped_count == 0

    july_report = build_monthly_report(
        transactions.list_transactions(month=7, year=2026),
        month=7,
        year=2026,
    )
    assert july_report.total_income == Decimal("4500.00")
    assert july_report.total_expenses == Decimal("3366.24")
    assert july_report.net_savings == Decimal("1133.76")
    assert len(july_report.expenses_by_category) == 9

    trend = build_trend_report(
        transactions.list_transactions(),
        months=6,
        end_month=7,
        end_year=2026,
    )
    assert trend.transaction_count == 61
    assert {month.total_expenses for month in trend.months} == {
        Decimal("2500.04"),
        Decimal("2432.89"),
        Decimal("2862.49"),
        Decimal("2749.09"),
        Decimal("2877.04"),
        Decimal("3366.24"),
    }

    statuses = {status.status for status in budgets.budget_statuses(7, 2026)}
    assert statuses == {"ok", "near limit", "over budget"}
