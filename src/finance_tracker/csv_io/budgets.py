"""Budget CSV parsing, import, and export."""

import csv
from io import StringIO
from pathlib import Path
from typing import TextIO

from finance_tracker.csv_io.common import ImportResult
from finance_tracker.exceptions import CsvFormatError, ValidationError
from finance_tracker.models.budgets import Budget
from finance_tracker.services.budgets import BudgetService

BUDGET_CSV_FIELDS = ["category", "amount", "month", "year"]


def import_budgets_csv(path: Path | str, service: BudgetService) -> ImportResult:
    csv_path = Path(path)
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        return import_budgets_csv_file(csv_file, service)


def import_budgets_csv_text(csv_text: str, service: BudgetService) -> ImportResult:
    return import_budgets_csv_file(StringIO(csv_text), service)


def import_budgets_csv_file(csv_file: TextIO, service: BudgetService) -> ImportResult:
    imported_count = 0
    skipped_count = 0
    errors: list[str] = []

    reader = csv.DictReader(csv_file)
    if reader.fieldnames is None:
        raise CsvFormatError("CSV file must include a header row.")
    missing_fields = set(BUDGET_CSV_FIELDS) - set(reader.fieldnames)
    if missing_fields:
        missing = ", ".join(sorted(missing_fields))
        raise CsvFormatError(f"CSV file is missing required columns: {missing}.")

    for line_number, row in enumerate(reader, start=2):
        try:
            service.set_budget(
                category=row["category"],
                amount=row["amount"],
                month=_parse_csv_integer(row["month"], "Month"),
                year=_parse_csv_integer(row["year"], "Year"),
            )
            imported_count += 1
        except ValidationError as exc:
            skipped_count += 1
            errors.append(f"Line {line_number}: {exc}")

    return ImportResult(imported_count=imported_count, skipped_count=skipped_count, errors=errors)


def export_budgets_csv(path: Path | str, budgets: list[Budget]) -> Path:
    csv_path = Path(path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        write_budgets_csv(csv_file, budgets)
    return csv_path


def export_budgets_csv_text(budgets: list[Budget]) -> str:
    csv_file = StringIO()
    write_budgets_csv(csv_file, budgets)
    return csv_file.getvalue()


def write_budgets_csv(csv_file: TextIO, budgets: list[Budget]) -> None:
    writer = csv.DictWriter(csv_file, fieldnames=BUDGET_CSV_FIELDS)
    writer.writeheader()
    for budget in budgets:
        writer.writerow(
            {
                "category": budget.category,
                "amount": str(budget.amount),
                "month": budget.month,
                "year": budget.year,
            }
        )


def _parse_csv_integer(value: str, field_name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise ValidationError(f"{field_name} must be a valid integer.") from exc
