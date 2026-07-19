from datetime import date
from decimal import Decimal
from pathlib import Path

from examples.build_demo import DEMO_AS_OF, build_demo_database
from finance_tracker.csv_io import preview_activities_csv_file
from finance_tracker.reports import (
    build_monthly_report,
    build_net_worth_history,
    build_net_worth_summary,
)
from finance_tracker.services import AccountService, ActivityService, BudgetService

EXAMPLES_DIR = Path(__file__).resolve().parents[1] / "examples"


def test_sample_data_builds_reproducible_account_activity_demo(tmp_path):
    db_path = tmp_path / "demo.sqlite3"
    result = build_demo_database(db_path)
    activities = ActivityService(db_path)
    accounts = AccountService(db_path)

    assert result.activity_count == 1116
    assert result.budget_count == 120
    assert result.category_rule_count == 5
    assert result.recurring_template_count == 4
    assert result.recurring_created_count == 4
    assert result.recurring_duplicate_count == 4
    assert result.account_count == 7
    assert result.adjustment_count == 820

    july = activities.list_activities(month=7, year=2026)
    report = build_monthly_report(
        [item.activity for item in july],
        7,
        2026,
        context_transactions=[item.activity for item in activities.list_activities()],
    )
    assert report.total_income == Decimal("4500.00")
    assert report.total_expenses == Decimal("3843.53")
    assert report.net_savings == Decimal("656.47")
    assert report.transaction_count == 25
    assert any(item.activity.kind.value == "transfer" for item in july)

    raw_accounts, ledger = accounts.report_data(DEMO_AS_OF)
    summary = build_net_worth_summary(raw_accounts, ledger, date.fromisoformat(DEMO_AS_OF))
    history = build_net_worth_history(
        raw_accounts, ledger, date.fromisoformat(DEMO_AS_OF), months=120
    )
    assert summary.total_assets == Decimal("64865.00")
    assert summary.total_liabilities == Decimal("8585.00")
    assert summary.total_net_worth == Decimal("56280.00")
    assert summary.active_account_count == 6
    assert summary.archived_account_count == 1
    assert history.points[0].as_of == date(2016, 8, 31)
    assert history.points[-1].total_net_worth == Decimal("56280.00")
    assert BudgetService(db_path).budget_statuses(7, 2026)

    with (EXAMPLES_DIR / "sample_activities.csv").open(newline="", encoding="utf-8") as csv_file:
        preview = preview_activities_csv_file(csv_file, activities)
    assert preview.valid_count == 0
    assert preview.duplicate_count == 277
    assert preview.invalid_count == 0
    assert any(
        row.original_category == "groceries"
        and row.activity is not None
        and row.activity.category == "Food"
        for row in preview.rows
    )
