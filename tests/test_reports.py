from decimal import Decimal

from typer.testing import CliRunner

from finance_tracker.charts import save_monthly_chart, save_trend_chart
from finance_tracker.cli import app
from finance_tracker.reports import (
    build_monthly_report,
    build_trend_report,
    format_monthly_report,
    format_trend_report,
)
from finance_tracker.services import TransactionService


def test_monthly_report_calculates_totals_and_categories(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("income", "200", "Freelance", "Logo work", "2026-06-05")
    service.add_transaction("expense", "40", "Food", "Groceries", "2026-06-10")
    service.add_transaction("expense", "60", "Food", "Dinner", "2026-06-11")

    report = build_monthly_report(service.list_transactions(month=6, year=2026), month=6, year=2026)

    assert report.total_income == Decimal("3200.00")
    assert report.total_expenses == Decimal("100.00")
    assert report.net_savings == Decimal("3100.00")
    assert report.expenses_by_category["Food"] == Decimal("100.00")
    assert "Net savings:  $3,100.00" in format_monthly_report(report)


def test_trend_report_calculates_monthly_totals_empty_months_and_top_categories(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-04-01")
    service.add_transaction("expense", "120", "Food", "Groceries", "2026-04-02")
    service.add_transaction("expense", "80", "Transport", "Train", "2026-04-03")
    service.add_transaction("income", "3200", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "200", "food", "Groceries", "2026-06-02")
    service.add_transaction("expense", "50", "Dining", "Lunch", "2026-06-03")
    service.add_transaction("expense", "999", "Travel", "Ignored old trip", "2026-03-01")

    report = build_trend_report(
        service.list_transactions(),
        months=3,
        end_month=6,
        end_year=2026,
    )

    assert [(month.year, month.month) for month in report.months] == [
        (2026, 4),
        (2026, 5),
        (2026, 6),
    ]
    assert report.months[0].total_income == Decimal("3000.00")
    assert report.months[0].total_expenses == Decimal("200.00")
    assert report.months[0].savings_rate == Decimal("93.3")
    assert report.months[1].transaction_count == 0
    assert report.months[1].savings_rate == Decimal("0.0")
    assert report.total_income == Decimal("6200.00")
    assert report.total_expenses == Decimal("450.00")
    assert report.net_savings == Decimal("5750.00")
    assert report.transaction_count == 6
    assert report.top_expense_categories == {
        "Food": Decimal("320.00"),
        "Transport": Decimal("80.00"),
        "Dining": Decimal("50.00"),
    }
    assert "2026-05  $0.00" in format_trend_report(report)
    assert "Top expense categories:" in format_trend_report(report)


def test_trend_report_table_aligns_columns_for_large_values(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "1234567.89", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "98765.43", "Transportation", "Travel", "2026-06-02")

    report = build_trend_report(service.list_transactions(), months=1, end_month=6, end_year=2026)

    lines = format_trend_report(report).splitlines()
    header = next(line for line in lines if line.startswith("Month"))
    row = next(line for line in lines if line.startswith("2026-06"))
    assert header.index("Expenses") == row.index("$98,765.43")
    assert row[header.index("Transactions") :].strip() == "2"


def test_cli_smoke_flow(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"

    init_result = runner.invoke(app, ["init", "--db-path", str(db_path)])
    add_result = runner.invoke(
        app,
        [
            "add",
            "expense",
            "45.90",
            "--category",
            "Food",
            "--description",
            "Groceries",
            "--date",
            "2026-06-12",
            "--db-path",
            str(db_path),
        ],
    )
    summary_result = runner.invoke(
        app, ["summary", "--month", "6", "--year", "2026", "--db-path", str(db_path)]
    )

    assert init_result.exit_code == 0
    assert add_result.exit_code == 0
    assert summary_result.exit_code == 0
    assert "Expenses:     $45.90" in summary_result.output


def test_cli_edit_updates_transaction(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"

    add_result = runner.invoke(
        app,
        [
            "add",
            "expense",
            "45.90",
            "--category",
            "Food",
            "--description",
            "Groceries",
            "--date",
            "2026-06-12",
            "--db-path",
            str(db_path),
        ],
    )
    edit_result = runner.invoke(
        app,
        [
            "edit",
            "1",
            "--amount",
            "52.25",
            "--category",
            "Household",
            "--db-path",
            str(db_path),
        ],
    )
    list_result = runner.invoke(app, ["list", "--db-path", str(db_path)])

    assert add_result.exit_code == 0
    assert edit_result.exit_code == 0
    assert "Updated #1: expense $52.25 in Household" in edit_result.output
    assert "Household" in list_result.output
    assert "$52.25" in list_result.output


def test_cli_trends_outputs_multi_month_report_and_saves_chart(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"
    chart_path = tmp_path / "reports" / "trend.png"

    runner.invoke(
        app,
        [
            "add",
            "income",
            "3000",
            "--category",
            "Salary",
            "--date",
            "2026-05-01",
            "--db-path",
            str(db_path),
        ],
    )
    runner.invoke(
        app,
        [
            "add",
            "expense",
            "120",
            "--category",
            "Food",
            "--date",
            "2026-06-12",
            "--db-path",
            str(db_path),
        ],
    )

    result = runner.invoke(
        app,
        [
            "trends",
            "--months",
            "2",
            "--end-month",
            "6",
            "--end-year",
            "2026",
            "--chart",
            str(chart_path),
            "--db-path",
            str(db_path),
        ],
    )

    assert result.exit_code == 0
    assert "Trend report for 2026-05 through 2026-06" in result.output
    assert "2026-05  $3,000.00" in result.output
    assert "Food: $120.00" in result.output
    assert "Saved chart to" in result.output
    assert chart_path.exists()
    assert chart_path.read_bytes().startswith(b"\x89PNG")


def test_save_monthly_chart_creates_png(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "40", "Food", "Groceries", "2026-06-10")
    report = build_monthly_report(service.list_transactions(month=6, year=2026), month=6, year=2026)
    chart_path = tmp_path / "reports" / "june.png"

    save_monthly_chart(report, chart_path)

    assert chart_path.exists()
    assert chart_path.read_bytes().startswith(b"\x89PNG")


def test_save_trend_chart_creates_png(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-05-01")
    service.add_transaction("expense", "40", "Food", "Groceries", "2026-06-10")
    report = build_trend_report(service.list_transactions(), months=2, end_month=6, end_year=2026)
    chart_path = tmp_path / "reports" / "trend.png"

    save_trend_chart(report, chart_path)

    assert chart_path.exists()
    assert chart_path.read_bytes().startswith(b"\x89PNG")
