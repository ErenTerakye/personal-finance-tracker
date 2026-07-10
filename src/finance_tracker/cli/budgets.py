"""Budget CLI commands."""

from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    budget_service,
    currency,
    format_percent,
    format_table,
    handle_error,
)
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import format_money


def budget_set(
    category: Annotated[str, typer.Argument(help="Budget category")],
    amount: Annotated[str, typer.Argument(help="Positive monthly budget amount")],
    month: Annotated[int, typer.Option("--month", "-m", help="Budget month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Budget year")],
    db_path: DbPathOption = None,
) -> None:
    """Set or update a monthly category budget."""
    try:
        budget = budget_service(db_path).set_budget(
            category=category,
            amount=amount,
            month=month,
            year=year,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)

    typer.echo(
        f"Set budget #{budget.id}: {budget.category} "
        f"{format_money(budget.amount, currency(db_path))} for {budget.year}-{budget.month:02d}"
    )


def budget_list(
    month: Annotated[int | None, typer.Option("--month", "-m", help="Filter by month 1-12")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y", help="Filter by year")] = None,
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="Filter by category"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """List monthly category budgets."""
    try:
        budgets = budget_service(db_path).list_budgets(
            month=month,
            year=year,
            category=category,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)

    if not budgets:
        typer.echo("No budgets found.")
        return

    currency_code = currency(db_path)
    rows = [
        [
            str(budget.id),
            f"{budget.year}-{budget.month:02d}",
            budget.category,
            format_money(budget.amount, currency_code),
        ]
        for budget in budgets
    ]
    for line in format_table(["ID", "Month", "Category", "Amount"], rows):
        typer.echo(line)


def budget_delete(
    budget_id: Annotated[int, typer.Argument(help="Budget ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a budget by ID."""
    try:
        budget_service(db_path).delete_budget(budget_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted budget #{budget_id}")


def budget_status(
    month: Annotated[int, typer.Option("--month", "-m", help="Budget month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Budget year")],
    db_path: DbPathOption = None,
) -> None:
    """Compare monthly category budgets to actual expenses."""
    try:
        statuses = budget_service(db_path).budget_statuses(month=month, year=year)
    except FinanceTrackerError as exc:
        handle_error(exc)

    if not statuses:
        typer.echo("No budgets found.")
        return

    currency_code = currency(db_path)
    typer.echo(f"Budget status for {year}-{month:02d}")
    typer.echo("")
    rows = [
        [
            status.budget.category,
            format_money(status.budget.amount, currency_code),
            format_money(status.actual_expenses, currency_code),
            format_money(status.remaining, currency_code),
            format_percent(status),
            status.status,
        ]
        for status in statuses
    ]
    headers = ["Category", "Budget", "Actual", "Remaining", "Used", "Status"]
    for line in format_table(headers, rows):
        typer.echo(line)
