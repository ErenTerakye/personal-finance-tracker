"""Transaction and budget CSV CLI commands."""

from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    budget_service,
    currency,
    handle_error,
    transaction_service,
)
from finance_tracker.csv_io import (
    export_budgets_csv,
    export_transactions_csv,
    import_budgets_csv,
    import_transactions_csv,
    preview_transactions_csv_file,
)
from finance_tracker.exceptions import CsvFormatError, FinanceTrackerError
from finance_tracker.reports import format_money


def import_csv(
    path: Annotated[Path, typer.Argument(help="CSV file to import")],
    preview: Annotated[
        bool,
        typer.Option(
            "--preview",
            help="Preview valid, duplicate, and invalid rows without writing",
        ),
    ] = False,
    allow_duplicates: Annotated[
        bool,
        typer.Option("--allow-duplicates", help="Import duplicate rows instead of skipping them"),
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Import transactions from a CSV file."""
    try:
        service = transaction_service(db_path)
        if preview:
            currency_code = currency(db_path)
            with path.open(newline="", encoding="utf-8") as csv_file:
                preview_result = preview_transactions_csv_file(csv_file, service)
            typer.echo(
                f"Previewed {len(preview_result.rows)} row(s): "
                f"{preview_result.valid_count} valid, "
                f"{preview_result.duplicate_count} duplicate, "
                f"{preview_result.invalid_count} invalid."
            )
            for row in preview_result.rows:
                if row.transaction is not None:
                    amount_str = format_money(row.transaction.amount, currency_code)
                    detail = (
                        f"{row.transaction.type.value} {amount_str} "
                        f"in {row.transaction.category} on {row.transaction.date.isoformat()}"
                    )
                else:
                    detail = row.error or ""
                typer.echo(f"  - Line {row.line_number}: {row.status} {detail}".rstrip())
            return
        result = import_transactions_csv(path, service, allow_duplicates=allow_duplicates)
    except (CsvFormatError, FinanceTrackerError) as exc:
        handle_error(exc)

    typer.echo(f"Imported {result.imported_count} transaction(s).")
    if result.skipped_count:
        typer.echo(f"Skipped {result.skipped_count} invalid row(s):")
        for error in result.errors:
            typer.echo(f"  - {error}")


def import_budgets(
    path: Annotated[Path, typer.Argument(help="Budget CSV file to import")],
    db_path: DbPathOption = None,
) -> None:
    """Import monthly category budgets from a CSV file."""
    try:
        result = import_budgets_csv(path, budget_service(db_path))
    except (CsvFormatError, FinanceTrackerError) as exc:
        handle_error(exc)

    typer.echo(f"Imported {result.imported_count} budget(s).")
    if result.skipped_count:
        typer.echo(f"Skipped {result.skipped_count} invalid row(s):")
        for error in result.errors:
            typer.echo(f"  - {error}")


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
        transactions = transaction_service(db_path).list_transactions(
            month=month,
            year=year,
            category=category,
            transaction_type=transaction_type,
        )
        output_path = export_transactions_csv(path, transactions)
    except FinanceTrackerError as exc:
        handle_error(exc)

    typer.echo(f"Exported {len(transactions)} transaction(s) to {output_path}")


def export_budgets(
    path: Annotated[Path, typer.Argument(help="Budget CSV output path")],
    month: Annotated[int | None, typer.Option("--month", "-m", help="Filter by month 1-12")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y", help="Filter by year")] = None,
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="Filter by category"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Export monthly category budgets to a CSV file."""
    try:
        budgets = budget_service(db_path).list_budgets(
            month=month,
            year=year,
            category=category,
        )
        output_path = export_budgets_csv(path, budgets)
    except FinanceTrackerError as exc:
        handle_error(exc)

    typer.echo(f"Exported {len(budgets)} budget(s) to {output_path}")
