"""CSV import and export helpers."""

import csv
from dataclasses import dataclass
from pathlib import Path

from finance_tracker.exceptions import CsvFormatError, ValidationError
from finance_tracker.models import Transaction
from finance_tracker.services import TransactionService

CSV_FIELDS = ["type", "amount", "category", "description", "date"]


@dataclass(frozen=True)
class ImportResult:
    imported_count: int
    skipped_count: int
    errors: list[str]


def import_transactions_csv(path: Path | str, service: TransactionService) -> ImportResult:
    csv_path = Path(path)
    imported_count = 0
    skipped_count = 0
    errors: list[str] = []

    with csv_path.open(newline="", encoding="utf-8") as csv_file:
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


def export_transactions_csv(path: Path | str, transactions: list[Transaction]) -> Path:
    csv_path = Path(path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
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

    return csv_path
