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


@dataclass(frozen=True)
class TransactionImportPreviewRow:
    line_number: int
    status: str
    transaction: Transaction | None = None
    original_category: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class TransactionImportPreview:
    valid_count: int
    duplicate_count: int
    invalid_count: int
    rows: list[TransactionImportPreviewRow]


def import_transactions_csv(
    path: Path | str,
    service: TransactionService,
    allow_duplicates: bool = False,
) -> ImportResult:
    csv_path = Path(path)

    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        return import_transactions_csv_file(csv_file, service, allow_duplicates)


def import_transactions_csv_text(
    csv_text: str,
    service: TransactionService,
    allow_duplicates: bool = False,
) -> ImportResult:
    return import_transactions_csv_file(StringIO(csv_text), service, allow_duplicates)


def import_transactions_csv_file(
    csv_file: TextIO,
    service: TransactionService,
    allow_duplicates: bool = False,
) -> ImportResult:
    imported_count = 0
    skipped_count = 0
    errors: list[str] = []

    preview = preview_transactions_csv_file(csv_file, service)
    for row in preview.rows:
        if row.status == "invalid":
            skipped_count += 1
            errors.append(f"Line {row.line_number}: {row.error}")
            continue
        if row.status == "duplicate" and not allow_duplicates:
            skipped_count += 1
            errors.append(f"Line {row.line_number}: Duplicate transaction skipped.")
            continue
        if row.transaction is None:
            continue
        if allow_duplicates:
            service.add_transaction(
                transaction_type=row.transaction.type.value,
                amount=str(row.transaction.amount),
                category=row.transaction.category,
                description=row.transaction.description,
                transaction_date=row.transaction.date.isoformat(),
            )
        else:
            service.add_transaction_if_new(row.transaction)
        imported_count += 1

    return ImportResult(imported_count=imported_count, skipped_count=skipped_count, errors=errors)


def preview_transactions_csv_text(
    csv_text: str,
    service: TransactionService,
) -> TransactionImportPreview:
    return preview_transactions_csv_file(StringIO(csv_text), service)


def preview_transactions_csv_file(
    csv_file: TextIO,
    service: TransactionService,
) -> TransactionImportPreview:
    rows: list[TransactionImportPreviewRow] = []
    seen_keys: set[tuple[str, str, str, str, str]] = set()
    reader = csv.DictReader(csv_file)
    if reader.fieldnames is None:
        raise CsvFormatError("CSV file must include a header row.")
    missing_fields = set(CSV_FIELDS) - set(reader.fieldnames)
    if missing_fields:
        missing = ", ".join(sorted(missing_fields))
        raise CsvFormatError(f"CSV file is missing required columns: {missing}.")

    for line_number, csv_row in enumerate(reader, start=2):
        try:
            original_category = csv_row["category"]
            transaction = Transaction.create(
                transaction_type=csv_row["type"],
                amount=csv_row["amount"],
                category=original_category,
                description=csv_row.get("description", ""),
                transaction_date=csv_row["date"],
            )
            transaction = service.prepare_transaction(transaction)
            key = _transaction_duplicate_key(transaction)
            is_duplicate = key in seen_keys or service.transaction_exists(transaction)
            if not is_duplicate:
                seen_keys.add(key)
            rows.append(
                TransactionImportPreviewRow(
                    line_number=line_number,
                    status="duplicate" if is_duplicate else "valid",
                    transaction=transaction,
                    original_category=original_category,
                )
            )
        except ValidationError as exc:
            rows.append(
                TransactionImportPreviewRow(
                    line_number=line_number,
                    status="invalid",
                    error=str(exc),
                )
            )

    return TransactionImportPreview(
        valid_count=sum(row.status == "valid" for row in rows),
        duplicate_count=sum(row.status == "duplicate" for row in rows),
        invalid_count=sum(row.status == "invalid" for row in rows),
        rows=rows,
    )


def _transaction_duplicate_key(transaction: Transaction) -> tuple[str, str, str, str, str]:
    return (
        transaction.type.value,
        str(transaction.amount),
        transaction.category.lower(),
        transaction.description,
        transaction.date.isoformat(),
    )


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
