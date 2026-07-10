"""Recurring-template CLI commands."""

from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    currency,
    format_table,
    handle_error,
    recurring_service,
)
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import format_money


def recurring_add(
    transaction_type: Annotated[str, typer.Argument(help="income or expense")],
    amount: Annotated[str, typer.Argument(help="Positive transaction amount")],
    category: Annotated[str, typer.Option("--category", "-c", help="Template category")],
    day_of_month: Annotated[int, typer.Option("--day", help="Day of month 1-31")],
    description: Annotated[str, typer.Option("--description", "-d", help="Template note")] = "",
    db_path: DbPathOption = None,
) -> None:
    """Add a monthly recurring transaction template."""
    try:
        template = recurring_service(db_path).add_template(
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            day_of_month=day_of_month,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    amount_str = format_money(template.amount, currency(db_path))
    typer.echo(
        f"Added recurring template #{template.id}: {template.type.value} "
        f"{amount_str} in {template.category} on day {template.day_of_month}"
    )


def recurring_list(
    active_only: Annotated[
        bool,
        typer.Option("--active-only", help="Only show active templates"),
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """List recurring transaction templates."""
    try:
        templates = recurring_service(db_path).list_templates(active_only=active_only)
    except FinanceTrackerError as exc:
        handle_error(exc)
    if not templates:
        typer.echo("No recurring templates found.")
        return
    currency_code = currency(db_path)
    rows = [
        [
            str(template.id),
            template.type.value,
            format_money(template.amount, currency_code),
            template.category,
            str(template.day_of_month),
            "yes" if template.active else "no",
            template.description,
        ]
        for template in templates
    ]
    headers = ["ID", "Type", "Amount", "Category", "Day", "Active", "Description"]
    for line in format_table(headers, rows):
        typer.echo(line)


def recurring_delete(
    template_id: Annotated[int, typer.Argument(help="Recurring template ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a recurring transaction template."""
    try:
        recurring_service(db_path).delete_template(template_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted recurring template #{template_id}")


def recurring_apply(
    month: Annotated[int, typer.Option("--month", "-m", help="Target month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Target year")],
    db_path: DbPathOption = None,
) -> None:
    """Create transactions from active recurring templates for a month."""
    try:
        result = recurring_service(db_path).apply_templates(month=month, year=year)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Created {len(result.created)} recurring transaction(s); "
        f"skipped {result.skipped_duplicates} duplicate(s)."
    )
