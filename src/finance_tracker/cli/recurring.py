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
    kind: Annotated[str, typer.Argument(help="income, expense, or transfer")],
    amount: Annotated[str, typer.Argument(help="Positive activity amount")],
    day_of_month: Annotated[int, typer.Option("--day", help="Day of month 1-31")],
    category: Annotated[
        str | None, typer.Option("--category", "-c", help="Income/expense category")
    ] = None,
    account_id: Annotated[
        int | None, typer.Option("--account", help="Income/expense account ID")
    ] = None,
    from_account_id: Annotated[
        int | None, typer.Option("--from-account", help="Transfer source account ID")
    ] = None,
    to_account_id: Annotated[
        int | None, typer.Option("--to-account", help="Transfer destination account ID")
    ] = None,
    description: Annotated[str, typer.Option("--description", "-d", help="Template note")] = "",
    db_path: DbPathOption = None,
) -> None:
    """Add a monthly recurring activity template."""
    try:
        template = recurring_service(db_path).add_template(
            kind=kind,
            amount=amount,
            category=category,
            description=description,
            day_of_month=day_of_month,
            account_id=account_id,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    amount_str = format_money(template.amount, currency(db_path))
    typer.echo(
        f"Added recurring template #{template.id}: {template.type.value} "
        f"{amount_str} in {template.category or 'transfer'} on day {template.day_of_month}"
    )


def recurring_list(
    active_only: Annotated[
        bool,
        typer.Option("--active-only", help="Only show active templates"),
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """List recurring activity templates."""
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
            template.category or "—",
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
    """Delete a recurring activity template."""
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
    """Create activities from active recurring templates for a month."""
    try:
        result = recurring_service(db_path).apply_templates(month=month, year=year)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Created {len(result.created)} recurring activity item(s); "
        f"skipped {result.skipped_duplicates} duplicate(s)."
    )
