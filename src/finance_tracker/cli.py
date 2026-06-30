"""Typer command-line interface."""

from datetime import date
from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.charts import save_monthly_chart, save_trend_chart
from finance_tracker.config import resolve_db_path
from finance_tracker.csv_io import (
    export_budgets_csv,
    export_transactions_csv,
    import_budgets_csv,
    import_transactions_csv,
)
from finance_tracker.database import initialize_database
from finance_tracker.exceptions import CsvFormatError, FinanceTrackerError
from finance_tracker.reports import (
    build_monthly_report,
    build_trend_report,
    format_money,
    format_monthly_report,
    format_trend_report,
)
from finance_tracker.services import BudgetService, BudgetStatus, TransactionService

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


def _budget_service(db_path: Path | None) -> BudgetService:
    return BudgetService(resolve_db_path(db_path))


def _handle_error(error: FinanceTrackerError) -> None:
    typer.secho(f"Error: {error}", fg=typer.colors.RED, err=True)
    raise typer.Exit(code=1)


def _format_percent(status: BudgetStatus) -> str:
    return f"{status.percent_used:.1f}%"


def _format_table(
    headers: list[str],
    rows: list[list[str]],
    right_aligned_headers: set[str] | None = None,
) -> list[str]:
    right_aligned_headers = right_aligned_headers or set()
    widths = [
        max(len(header), *(len(row[index]) for row in rows))
        for index, header in enumerate(headers)
    ]

    def format_cell(index: int, value: str) -> str:
        if index == len(headers) - 1:
            return value
        if headers[index] in right_aligned_headers:
            return value.rjust(widths[index])
        return value.ljust(widths[index])

    lines = [
        "  ".join(format_cell(index, header) for index, header in enumerate(headers)),
        "  ".join("-" * width for width in widths),
    ]
    lines.extend(
        "  ".join(format_cell(index, value) for index, value in enumerate(row))
        for row in rows
    )
    return lines


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

    rows = [
        [
            str(transaction.id),
            transaction.date.isoformat(),
            transaction.type.value,
            format_money(transaction.amount),
            transaction.category,
            transaction.description,
        ]
        for transaction in transactions
    ]
    for line in _format_table(["ID", "Date", "Type", "Amount", "Category", "Description"], rows):
        typer.echo(line)


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


@app.command("budget-set")
def budget_set(
    category: Annotated[str, typer.Argument(help="Budget category")],
    amount: Annotated[str, typer.Argument(help="Positive monthly budget amount")],
    month: Annotated[int, typer.Option("--month", "-m", help="Budget month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Budget year")],
    db_path: DbPathOption = None,
) -> None:
    """Set or update a monthly category budget."""
    try:
        budget = _budget_service(db_path).set_budget(
            category=category,
            amount=amount,
            month=month,
            year=year,
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(
        f"Set budget #{budget.id}: {budget.category} {format_money(budget.amount)} "
        f"for {budget.year}-{budget.month:02d}"
    )


@app.command("budget-list")
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
        budgets = _budget_service(db_path).list_budgets(
            month=month,
            year=year,
            category=category,
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    if not budgets:
        typer.echo("No budgets found.")
        return

    rows = [
        [
            str(budget.id),
            f"{budget.year}-{budget.month:02d}",
            budget.category,
            format_money(budget.amount),
        ]
        for budget in budgets
    ]
    for line in _format_table(["ID", "Month", "Category", "Amount"], rows):
        typer.echo(line)


@app.command("budget-delete")
def budget_delete(
    budget_id: Annotated[int, typer.Argument(help="Budget ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a budget by ID."""
    try:
        _budget_service(db_path).delete_budget(budget_id)
    except FinanceTrackerError as exc:
        _handle_error(exc)
    typer.echo(f"Deleted budget #{budget_id}")


@app.command("budget-status")
def budget_status(
    month: Annotated[int, typer.Option("--month", "-m", help="Budget month 1-12")],
    year: Annotated[int, typer.Option("--year", "-y", help="Budget year")],
    db_path: DbPathOption = None,
) -> None:
    """Compare monthly category budgets to actual expenses."""
    try:
        statuses = _budget_service(db_path).budget_statuses(month=month, year=year)
    except FinanceTrackerError as exc:
        _handle_error(exc)

    if not statuses:
        typer.echo("No budgets found.")
        return

    typer.echo(f"Budget status for {year}-{month:02d}")
    typer.echo("")
    rows = [
        [
            status.budget.category,
            format_money(status.budget.amount),
            format_money(status.actual_expenses),
            format_money(status.remaining),
            _format_percent(status),
            status.status,
        ]
        for status in statuses
    ]
    headers = ["Category", "Budget", "Actual", "Remaining", "Used", "Status"]
    for line in _format_table(headers, rows):
        typer.echo(line)


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


@app.command()
def trends(
    months: Annotated[int, typer.Option("--months", help="Number of months to include")] = 6,
    end_month: Annotated[int, typer.Option("--end-month", help="Final month 1-12")] = ...,
    end_year: Annotated[int, typer.Option("--end-year", help="Final year")] = ...,
    chart: Annotated[Path | None, typer.Option("--chart", help="Optional PNG output path")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print a multi-month financial trend report."""
    try:
        transactions = _service(db_path).list_transactions()
        trend_report = build_trend_report(
            transactions=transactions,
            months=months,
            end_month=end_month,
            end_year=end_year,
        )
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(format_trend_report(trend_report))
    if chart is not None:
        chart_path = save_trend_chart(trend_report, chart)
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


@app.command("import-budgets-csv")
def import_budgets(
    path: Annotated[Path, typer.Argument(help="Budget CSV file to import")],
    db_path: DbPathOption = None,
) -> None:
    """Import monthly category budgets from a CSV file."""
    try:
        result = import_budgets_csv(path, _budget_service(db_path))
    except (CsvFormatError, FinanceTrackerError) as exc:
        _handle_error(exc)

    typer.echo(f"Imported {result.imported_count} budget(s).")
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


@app.command("export-budgets-csv")
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
        budgets = _budget_service(db_path).list_budgets(
            month=month,
            year=year,
            category=category,
        )
        output_path = export_budgets_csv(path, budgets)
    except FinanceTrackerError as exc:
        _handle_error(exc)

    typer.echo(f"Exported {len(budgets)} budget(s) to {output_path}")
