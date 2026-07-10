"""Monthly and trend report CLI commands."""

from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.charts import save_monthly_chart, save_trend_chart
from finance_tracker.cli.common import DbPathOption, currency, handle_error, transaction_service
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import (
    build_monthly_report,
    build_trend_report,
    format_monthly_report,
    format_trend_report,
)


def summary(
    month: Annotated[int, typer.Option("--month", "-m", help="Report month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Report year")],
    db_path: DbPathOption = None,
) -> None:
    """Print a monthly income, expense, and net savings summary."""
    try:
        service = transaction_service(db_path)
        transactions = service.list_transactions(month=month, year=year)
        report = build_monthly_report(
            transactions,
            month=month,
            year=year,
            context_transactions=service.list_transactions(),
        )
        currency_code = currency(db_path)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(format_monthly_report(report, currency_code))


def report(
    month: Annotated[int, typer.Option("--month", "-m", help="Report month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Report year")],
    chart: Annotated[Path | None, typer.Option("--chart", help="Optional PNG output path")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print a monthly report and optionally save a PNG chart."""
    try:
        service = transaction_service(db_path)
        transactions = service.list_transactions(month=month, year=year)
        monthly_report = build_monthly_report(
            transactions,
            month=month,
            year=year,
            context_transactions=service.list_transactions(),
        )
        currency_code = currency(db_path)
    except FinanceTrackerError as exc:
        handle_error(exc)

    typer.echo(format_monthly_report(monthly_report, currency_code))
    if chart is not None:
        chart_path = save_monthly_chart(monthly_report, chart)
        typer.echo(f"\nSaved chart to {chart_path}")


def trends(
    end_month: Annotated[int, typer.Option("--end-month", help="Final month 1-12")],
    end_year: Annotated[int, typer.Option("--end-year", help="Final year")],
    months: Annotated[int, typer.Option("--months", help="Number of months to include")] = 6,
    chart: Annotated[Path | None, typer.Option("--chart", help="Optional PNG output path")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print a multi-month financial trend report."""
    try:
        transactions = transaction_service(db_path).list_transactions()
        trend_report = build_trend_report(
            transactions=transactions,
            months=months,
            end_month=end_month,
            end_year=end_year,
        )
        currency_code = currency(db_path)
    except FinanceTrackerError as exc:
        handle_error(exc)

    typer.echo(format_trend_report(trend_report, currency_code))
    if chart is not None:
        chart_path = save_trend_chart(trend_report, chart)
        typer.echo(f"\nSaved chart to {chart_path}")
