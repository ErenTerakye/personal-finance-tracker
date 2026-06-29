"""Typer command-line interface."""

from datetime import date
from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.charts import save_monthly_chart
from finance_tracker.config import resolve_db_path
from finance_tracker.csv_io import export_transactions_csv, import_transactions_csv
from finance_tracker.database import initialize_database
from finance_tracker.exceptions import CsvFormatError, FinanceTrackerError
from finance_tracker.reports import build_monthly_report, format_money, format_monthly_report
from finance_tracker.services import TransactionService

app = typer.Typer(help="Track income and expenses from the command line.")

DbPathOption = Annotated[
    Path | None,
    typer.Option(
        "--db-path",
        help="SQLite database path. Defaults to ./data/finance_tracker.sqlite3.",
    ),
]


def _service(db_path: Path | None) -> TransactionService:
    return TransactionService(resolve_db_path(db_path))


def _handle_error(error: FinanceTrackerError) -> None:
    typer.secho(f"Error: {error}", fg=typer.colors.RED, err=True)
    raise typer.Exit(code=1)


@app.command()
def init(db_path: DbPathOption = None) -> None:
    """Initialize the SQLite database."""
    resolved_path = resolve_db_path(db_path)
    initialize_database(resolved_path)
    typer.echo(f"Initialized database at {resolved_path}")


@app.command()
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
        transaction = _service(db_path).add_transaction(
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            transaction_date=transaction_date or date.today().isoformat(),
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(
        f"Added #{transaction.id}: {transaction.type.value} {format_money(transaction.amount)} "
        f"in {transaction.category} on {transaction.date.isoformat()}"
    )


@app.command("list")
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
        transactions = _service(db_path).list_transactions(
            month=month,
            year=year,
            category=category,
            transaction_type=transaction_type,
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    if not transactions:
        typer.echo("No transactions found.")
        return

    typer.echo("ID  Date        Type     Amount      Category  Description")
    typer.echo("--  ----------  -------  ----------  --------  -----------")
    for transaction in transactions:
        typer.echo(
            f"{transaction.id:<3} {transaction.date.isoformat():<10} "
            f"{transaction.type.value:<8} {format_money(transaction.amount):<11} "
            f"{transaction.category:<9} {transaction.description}"
        )


@app.command()
def delete(
    transaction_id: Annotated[int, typer.Argument(help="Transaction ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a transaction by ID."""
    try:
        _service(db_path).delete_transaction(transaction_id)
    except FinanceTrackerError as exc:
        _handle_error(exc)
    typer.echo(f"Deleted transaction #{transaction_id}")


@app.command()
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
        transaction = _service(db_path).edit_transaction(
            transaction_id=transaction_id,
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            transaction_date=transaction_date,
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(
        f"Updated #{transaction.id}: {transaction.type.value} {format_money(transaction.amount)} "
        f"in {transaction.category} on {transaction.date.isoformat()}"
    )


@app.command()
def summary(
    month: Annotated[int, typer.Option("--month", "-m", help="Report month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Report year")],
    db_path: DbPathOption = None,
) -> None:
    """Print a monthly income, expense, and net savings summary."""
    try:
        transactions = _service(db_path).list_transactions(month=month, year=year)
        report = build_monthly_report(transactions, month=month, year=year)
    except FinanceTrackerError as exc:
        _handle_error(exc)
    typer.echo(format_monthly_report(report))


@app.command()
def report(
    month: Annotated[int, typer.Option("--month", "-m", help="Report month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Report year")],
    chart: Annotated[Path | None, typer.Option("--chart", help="Optional PNG output path")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print a monthly report and optionally save a PNG chart."""
    try:
        transactions = _service(db_path).list_transactions(month=month, year=year)
        monthly_report = build_monthly_report(transactions, month=month, year=year)
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(format_monthly_report(monthly_report))
    if chart is not None:
        chart_path = save_monthly_chart(monthly_report, chart)
        typer.echo(f"\nSaved chart to {chart_path}")


@app.command("import-csv")
def import_csv(
    path: Annotated[Path, typer.Argument(help="CSV file to import")],
    db_path: DbPathOption = None,
) -> None:
    """Import transactions from a CSV file."""
    try:
        result = import_transactions_csv(path, _service(db_path))
    except (CsvFormatError, FinanceTrackerError) as exc:
        _handle_error(exc)

    typer.echo(f"Imported {result.imported_count} transaction(s).")
    if result.skipped_count:
        typer.echo(f"Skipped {result.skipped_count} invalid row(s):")
        for error in result.errors:
            typer.echo(f"  - {error}")


@app.command("export-csv")
def export_csv(
    path: Annotated[Path, typer.Argument(help="CSV output path")],
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
    """Export transactions to a CSV file."""
    try:
        transactions = _service(db_path).list_transactions(
            month=month,
            year=year,
            category=category,
            transaction_type=transaction_type,
        )
        output_path = export_transactions_csv(path, transactions)
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(f"Exported {len(transactions)} transaction(s) to {output_path}")
