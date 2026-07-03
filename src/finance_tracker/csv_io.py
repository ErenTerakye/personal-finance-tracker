"""CSV import and export helpers."""

import csv
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import TextIO

from finance_tracker.exceptions import CsvFormatError, ValidationError
from finance_tracker.models import Budget, Transaction
from finance_tracker.services import BudgetService, TransactionService

CSV_FIELDS = ["type", "amount", "category", "description", "date"]
BUDGET_CSV_FIELDS = ["category", "amount", "month", "year"]


@dataclass(frozen=True)
class ImportResult:
    imported_count: int
    skipped_count: int
    errors: list[str]


def import_transactions_csv(path: Path | str, service: TransactionService) -> ImportResult:
    csv_path = Path(path)

    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        return import_transactions_csv_file(csv_file, service)


def import_transactions_csv_text(csv_text: str, service: TransactionService) -> ImportResult:
    return import_transactions_csv_file(StringIO(csv_text), service)


def import_transactions_csv_file(csv_file: TextIO, service: TransactionService) -> ImportResult:
    imported_count = 0
    skipped_count = 0
    errors: list[str] = []

    reader = csv.DictReader(csv_file)
    if reader.fieldnames is None:
        raise CsvFormatError("CSV file must include a header row.")
    missing_fields = set(CSV_FIELDS) - set(reader.fieldnames)
    if missing_fields:
        missing = ", ".join(sorted(missing_fields))
        raise CsvFormatError(f"CSV file is missing required columns: {missing}.")

    for line_number, row in enumerate(reader, start=2):
        try:
            service.add_transaction(
                transaction_type=row["type"],
                amount=row["amount"],
                category=row["category"],
                description=row.get("description", ""),
                transaction_date=row["date"],
            )
            imported_count += 1
        except ValidationError as exc:
            skipped_count += 1
            errors.append(f"Line {line_number}: {exc}")

    return ImportResult(imported_count=imported_count, skipped_count=skipped_count, errors=errors)


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


def _parse_csv_integer(value: str, field_name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise ValidationError(f"{field_name} must be a valid integer.") from exc


def export_transactions_csv(path: Path | str, transactions: list[Transaction]) -> Path:
    csv_path = Path(path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        write_transactions_csv(csv_file, transactions)

    return csv_path


def export_transactions_csv_text(transactions: list[Transaction]) -> str:
    csv_file = StringIO()
    write_transactions_csv(csv_file, transactions)
    return csv_file.getvalue()


def write_transactions_csv(csv_file: TextIO, transactions: list[Transaction]) -> None:
    writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for transaction in transactions:
        writer.writerow(
            {
                "type": transaction.type.value,
                "amount": str(transaction.amount),
                "category": transaction.category,
                "description": transaction.description,
                "date": transaction.date.isoformat(),
            }
        )


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
