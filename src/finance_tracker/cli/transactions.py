"""Transaction CLI commands."""

from datetime import date
from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    currency,
    format_table,
    handle_error,
    transaction_service,
)
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import format_money


def add(
    transaction_type: Annotated[str, typer.Argument(help="income or expense")],
    amount: Annotated[str, typer.Argument(help="Positive transaction amount")],
    category: Annotated[str, typer.Option("--category", "-c", help="Transaction category")],
    description: Annotated[str, typer.Option("--description", "-d", help="Transaction note")] = "",
    transaction_date: Annotated[
        str | None,
        typer.Option("--date", help="Transaction date in YYYY-MM-DD format"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Add an income or expense transaction."""
    try:
        transaction = transaction_service(db_path).add_transaction(
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            transaction_date=transaction_date or date.today().isoformat(),
        )
    except FinanceTrackerError as exc:
        handle_error(exc)

    amount_str = format_money(transaction.amount, currency(db_path))
    typer.echo(
        f"Added #{transaction.id}: {transaction.type.value} {amount_str} "
        f"in {transaction.category} on {transaction.date.isoformat()}"
    )


def list_transactions(
    month: Annotated[int | None, typer.Option("--month", "-m", help="Filter by month 1-12")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y", help="Filter by year")] = None,
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="Filter by category"),
    ] = None,
    transaction_type: Annotated[
        str | None,
        typer.Option("--type", "-t", help="Filter by income or expense"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """List stored transactions."""
    try:
        transactions = transaction_service(db_path).list_transactions(
            month=month,
            year=year,
            category=category,
            transaction_type=transaction_type,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)

    if not transactions:
        typer.echo("No transactions found.")
        return

    currency_code = currency(db_path)
    rows = [
        [
            str(transaction.id),
            transaction.date.isoformat(),
            transaction.type.value,
            format_money(transaction.amount, currency_code),
            transaction.category,
            transaction.description,
        ]
        for transaction in transactions
    ]
    for line in format_table(["ID", "Date", "Type", "Amount", "Category", "Description"], rows):
        typer.echo(line)


def delete(
    transaction_id: Annotated[int, typer.Argument(help="Transaction ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a transaction by ID."""
    try:
        transaction_service(db_path).delete_transaction(transaction_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted transaction #{transaction_id}")


def edit(
    transaction_id: Annotated[int, typer.Argument(help="Transaction ID to edit")],
    transaction_type: Annotated[
        str | None,
        typer.Option("--type", "-t", help="Set transaction type to income or expense"),
    ] = None,
    amount: Annotated[
        str | None,
        typer.Option("--amount", "-a", help="Set positive transaction amount"),
    ] = None,
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="Set transaction category"),
    ] = None,
    description: Annotated[
        str | None,
        typer.Option("--description", "-d", help="Set transaction note"),
    ] = None,
    transaction_date: Annotated[
        str | None,
        typer.Option("--date", help="Set transaction date in YYYY-MM-DD format"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Edit fields on an existing transaction."""
    try:
        transaction = transaction_service(db_path).edit_transaction(
            transaction_id=transaction_id,
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            transaction_date=transaction_date,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)

    amount_str = format_money(transaction.amount, currency(db_path))
    typer.echo(
        f"Updated #{transaction.id}: {transaction.type.value} {amount_str} "
        f"in {transaction.category} on {transaction.date.isoformat()}"
    )
