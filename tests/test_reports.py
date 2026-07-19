from decimal import Decimal

from finance_tracker.charts import save_monthly_chart, save_trend_chart
from finance_tracker.reports import build_monthly_report, build_trend_report
from finance_tracker.services import AccountService, ActivityService


def _activity_service(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    accounts = AccountService(db_path)
    checking = accounts.create_account("Checking", "asset", "0", "2026-01-01", "cash")
    savings = accounts.create_account("Savings", "asset", "0", "2026-01-01", "cash")
    return ActivityService(db_path), checking, savings


def test_monthly_report_includes_only_income_and_expense(tmp_path):
    service, checking, savings = _activity_service(tmp_path)
    service.add_activity("income", "3000", "Salary", "Pay", "2026-06-01", checking.id)
    service.add_activity("expense", "100", "Food", "Groceries", "2026-06-02", checking.id)
    service.add_transfer("500", "Save", "2026-06-03", checking.id, savings.id)
    service.adjust_account(savings.id, "510", "2026-06-04", "Interest")
    all_activity = [item.activity for item in service.list_activities()]

    report = build_monthly_report(all_activity, 6, 2026, context_transactions=all_activity)

    assert report.total_income == Decimal("3000.00")
    assert report.total_expenses == Decimal("100.00")
    assert report.net_savings == Decimal("2900.00")
    assert report.transaction_count == 2
    assert report.expenses_by_category == {"Food": Decimal("100.00")}


def test_trend_report_excludes_non_cashflow_and_fills_empty_months(tmp_path):
    service, checking, savings = _activity_service(tmp_path)
    service.add_activity("income", "1000", "Salary", "April", "2026-04-01", checking.id)
    service.add_transfer("100", "May transfer", "2026-05-01", checking.id, savings.id)
    service.add_activity("expense", "200", "Food", "June", "2026-06-01", checking.id)

    report = build_trend_report(
        [item.activity for item in service.list_activities()], months=3, end_month=6, end_year=2026
    )

    assert [item.transaction_count for item in report.months] == [1, 0, 1]
    assert report.transaction_count == 2
    assert report.total_income == Decimal("1000.00")
    assert report.total_expenses == Decimal("200.00")


def test_activity_reports_still_generate_png_charts(tmp_path):
    service, checking, _ = _activity_service(tmp_path)
    service.add_activity("income", "1000", "Salary", "Pay", "2026-06-01", checking.id)
    service.add_activity("expense", "200", "Food", "Groceries", "2026-06-02", checking.id)
    activity = [item.activity for item in service.list_activities()]
    monthly = build_monthly_report(activity, 6, 2026)
    trend = build_trend_report(activity, months=1, end_month=6, end_year=2026)

    monthly_path = save_monthly_chart(monthly, tmp_path / "monthly.png")
    trend_path = save_trend_chart(trend, tmp_path / "trend.png")

    assert monthly_path.read_bytes().startswith(b"\x89PNG")
    assert trend_path.read_bytes().startswith(b"\x89PNG")
