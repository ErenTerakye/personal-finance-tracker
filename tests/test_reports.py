from decimal import Decimal

from typer.testing import CliRunner

from finance_tracker.charts import save_monthly_chart
from finance_tracker.cli import app
from finance_tracker.reports import build_monthly_report, format_monthly_report
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


def test_save_monthly_chart_creates_png(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "40", "Food", "Groceries", "2026-06-10")
    report = build_monthly_report(service.list_transactions(month=6, year=2026), month=6, year=2026)
    chart_path = tmp_path / "reports" / "june.png"

    save_monthly_chart(report, chart_path)

    assert chart_path.exists()
    assert chart_path.read_bytes().startswith(b"\x89PNG")
