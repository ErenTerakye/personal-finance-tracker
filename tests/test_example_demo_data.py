from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path

from examples.build_demo import DEMO_AS_OF, build_demo_database
from finance_tracker.csv_io import (
    export_budgets_csv,
    export_transactions_csv,
    preview_transactions_csv_file,
)
from finance_tracker.reports import (
    build_monthly_report,
    build_net_worth_history,
    build_net_worth_summary,
    build_trend_report,
)
from finance_tracker.services import (
    AccountService,
    BudgetService,
    CategoryRuleService,
    RecurringTemplateService,
    TransactionService,
)

EXAMPLES_DIR = Path(__file__).resolve().parents[1] / "examples"


def test_sample_data_builds_rich_reproducible_demo(tmp_path):
    db_path = tmp_path / "demo.sqlite3"
    result = build_demo_database(db_path)
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)
    accounts = AccountService(db_path)

    assert result.transaction_count == 281
    assert result.budget_count == 120
    assert result.category_rule_count == 5
    assert result.recurring_template_count == 4
    assert result.recurring_created_count == 4
    assert result.recurring_duplicate_count == 4
    assert result.account_count == 7
    assert result.snapshot_count == 827

    july_report = build_monthly_report(
        transactions.list_transactions(month=7, year=2026),
        month=7,
        year=2026,
        context_transactions=transactions.list_transactions(),
    )
    assert july_report.total_income == Decimal("4500.00")
    assert july_report.total_expenses == Decimal("3843.53")
    assert july_report.net_savings == Decimal("656.47")
    assert july_report.ytd_net_savings == Decimal("8528.07")
    assert july_report.transaction_count == 25
    assert len(july_report.expenses_by_category) == 11

    july_transactions = transactions.list_transactions(month=7, year=2026)
    july_activity = Counter(transaction.date for transaction in july_transactions)
    assert len(july_activity) == 17
    assert max(july_activity.values()) == 3
    assert {transaction.description for transaction in july_transactions} >= {
        "Neighborhood market groceries",
        "Coffee and breakfast sandwich",
        "Transit card top-up",
        "Pharmacy essentials",
    }

    trend = build_trend_report(
        transactions.list_transactions(),
        months=12,
        end_month=7,
        end_year=2026,
    )
    assert trend.transaction_count == 281
    assert trend.total_income == Decimal("52870.00")
    assert trend.total_expenses == Decimal("37246.14")
    assert trend.months[0].net_savings == Decimal("1253.85")
    assert trend.months[-1].net_savings == Decimal("656.47")

    statuses = {
        status.budget.category: status.status
        for status in budgets.budget_statuses(7, 2026)
    }
    assert set(statuses.values()) == {"ok", "near limit", "over budget"}
    assert statuses["Travel"] == "over budget"
    assert statuses["Rent"] == "near limit"
    assert statuses["Food"] == "ok"

    assert {
        (rule.alias, rule.category)
        for rule in CategoryRuleService(db_path).list_rules()
    } >= {
        ("groceries", "Food"),
        ("metro", "Transport"),
        ("streaming", "Subscriptions"),
    }
    assert {
        template.category
        for template in RecurringTemplateService(db_path).list_templates()
    } == {"Fitness", "Rent", "Salary", "Subscriptions"}

    all_accounts, snapshots = accounts.report_data(DEMO_AS_OF)
    net_worth = build_net_worth_summary(
        all_accounts,
        snapshots,
        date.fromisoformat(DEMO_AS_OF),
    )
    history = build_net_worth_history(
        all_accounts,
        snapshots,
        date.fromisoformat(DEMO_AS_OF),
        months=12,
    )
    assert net_worth.total_assets == Decimal("64865.00")
    assert net_worth.total_liabilities == Decimal("8585.00")
    assert net_worth.total_net_worth == Decimal("56280.00")
    assert net_worth.active_account_count == 6
    assert net_worth.archived_account_count == 1
    assert history.points[0].total_net_worth == Decimal("36390.00")
    assert history.points[-1].total_net_worth == Decimal("56280.00")

    full_history = build_net_worth_history(
        all_accounts,
        snapshots,
        date.fromisoformat(DEMO_AS_OF),
        months=120,
    )
    assert len(full_history.points) == 120
    assert full_history.points[0].as_of == date(2016, 8, 31)
    assert full_history.points[0].unresolved_account_count == 0
    assert full_history.points[0].total_net_worth == Decimal("-17440.00")
    assert (
        full_history.points[43].total_net_worth
        < full_history.points[42].total_net_worth
    )
    monthly_changes = [
        point.total_net_worth - previous.total_net_worth
        for previous, point in zip(
            full_history.points, full_history.points[1:], strict=False
        )
    ]
    assert sum(change < 0 for change in monthly_changes) >= 24
    assert sum(change < 0 for change in monthly_changes[-11:]) >= 4
    assert full_history.points[-1].total_net_worth == Decimal("56280.00")

    with (EXAMPLES_DIR / "sample_transactions.csv").open(
        newline="", encoding="utf-8"
    ) as csv_file:
        preview = preview_transactions_csv_file(csv_file, transactions)
    assert preview.valid_count == 0
    assert preview.duplicate_count == 277
    assert preview.invalid_count == 0
    assert any(
        row.original_category == "groceries"
        and row.transaction is not None
        and row.transaction.category == "Food"
        for row in preview.rows
    )

    transaction_export = export_transactions_csv(
        tmp_path / "exports" / "transactions.csv",
        transactions.list_transactions(),
    )
    budget_export = export_budgets_csv(
        tmp_path / "exports" / "budgets.csv",
        budgets.list_budgets(),
    )
    assert transaction_export.read_text(encoding="utf-8").count("\n") == 282
    assert budget_export.read_text(encoding="utf-8").count("\n") == 121
