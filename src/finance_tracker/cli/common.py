"""Shared CLI options, service construction, errors, and table presentation."""

from pathlib import Path
from typing import Annotated, Never

import typer

from finance_tracker.config import resolve_db_path
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.services import (
    BudgetService,
    BudgetStatus,
    CategoryRuleService,
    RecurringTemplateService,
    SettingsService,
    TransactionService,
)

DbPathOption = Annotated[
    Path | None,
    typer.Option(
        "--db-path",
        help="SQLite database path. Defaults to ./data/finance_tracker.sqlite3.",
    ),
]


def transaction_service(db_path: Path | None) -> TransactionService:
    return TransactionService(resolve_db_path(db_path))


def budget_service(db_path: Path | None) -> BudgetService:
    return BudgetService(resolve_db_path(db_path))


def category_rule_service(db_path: Path | None) -> CategoryRuleService:
    return CategoryRuleService(resolve_db_path(db_path))


def recurring_service(db_path: Path | None) -> RecurringTemplateService:
    return RecurringTemplateService(resolve_db_path(db_path))


def settings_service(db_path: Path | None) -> SettingsService:
    return SettingsService(resolve_db_path(db_path))


def currency(db_path: Path | None) -> str:
    try:
        return settings_service(db_path).get_currency()
    except Exception:
        return "USD"


def handle_error(error: FinanceTrackerError) -> Never:
    typer.secho(f"Error: {error}", fg=typer.colors.RED, err=True)
    raise typer.Exit(code=1)


def format_percent(status: BudgetStatus) -> str:
    return f"{status.percent_used:.1f}%"


def format_table(
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
