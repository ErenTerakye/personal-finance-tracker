"""Account-aware activity CSV parsing, preview, import, and export."""

import csv
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import TextIO

from finance_tracker.csv_io.common import ImportResult
from finance_tracker.exceptions import CsvFormatError, ValidationError
from finance_tracker.models.accounts import Account
from finance_tracker.models.activities import Activity, ActivityKind, ActivityRecord, PostingRole
from finance_tracker.services.accounts import AccountService
from finance_tracker.services.activities import ActivityService

ACTIVITY_CSV_FIELDS = [
    "kind",
    "amount",
    "category",
    "description",
    "date",
    "account",
    "from_account",
    "to_account",
]


@dataclass(frozen=True)
class ActivityImportPreviewRow:
    line_number: int
    status: str
    activity: Activity | None = None
    effects: ActivityRecord | None = None
    original_category: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class ActivityImportPreview:
    valid_count: int
    duplicate_count: int
    invalid_count: int
    rows: list[ActivityImportPreviewRow]


def import_activities_csv(
    path: Path | str, service: ActivityService, allow_duplicates: bool = False
) -> ImportResult:
    with Path(path).open(newline="", encoding="utf-8") as csv_file:
        return import_activities_csv_file(csv_file, service, allow_duplicates)


def import_activities_csv_text(
    csv_text: str, service: ActivityService, allow_duplicates: bool = False
) -> ImportResult:
    return import_activities_csv_file(StringIO(csv_text), service, allow_duplicates)


def import_activities_csv_file(
    csv_file: TextIO, service: ActivityService, allow_duplicates: bool = False
) -> ImportResult:
    preview = preview_activities_csv_file(csv_file, service)
    imported = 0
    skipped = 0
    errors: list[str] = []
    for row in preview.rows:
        if row.status == "invalid":
            skipped += 1
            errors.append(f"Line {row.line_number}: {row.error}")
            continue
        if row.status == "duplicate" and not allow_duplicates:
            skipped += 1
            errors.append(f"Line {row.line_number}: Duplicate activity skipped.")
            continue
        if row.activity is None:
            continue
        if allow_duplicates:
            _store_activity(service, row.activity)
        else:
            service.add_activity_if_new(row.activity)
        imported += 1
    return ImportResult(imported, skipped, errors)


def preview_activities_csv_text(csv_text: str, service: ActivityService) -> ActivityImportPreview:
    return preview_activities_csv_file(StringIO(csv_text), service)


def preview_activities_csv_file(
    csv_file: TextIO, service: ActivityService
) -> ActivityImportPreview:
    reader = csv.DictReader(csv_file)
    if reader.fieldnames is None:
        raise CsvFormatError("CSV file must include a header row.")
    missing = set(ACTIVITY_CSV_FIELDS) - set(reader.fieldnames)
    if missing:
        raise CsvFormatError(f"CSV file is missing required columns: {', '.join(sorted(missing))}.")
    account_service = AccountService(service.db_path, initialize=False)
    seen: set[tuple[object, ...]] = set()
    rows: list[ActivityImportPreviewRow] = []
    for line_number, csv_row in enumerate(reader, start=2):
        try:
            kind = ActivityKind((csv_row.get("kind") or "").lower())
            if kind is ActivityKind.OPENING:
                raise ValidationError("Opening activities are created with accounts, not imported.")
            original_category = csv_row.get("category") or None
            activity = _activity_from_row(csv_row, kind, account_service)
            activity = service.prepare_activity(activity)
            key = _duplicate_key(activity)
            duplicate = key in seen or service.activity_exists(activity)
            if not duplicate:
                seen.add(key)
            rows.append(
                ActivityImportPreviewRow(
                    line_number,
                    "duplicate" if duplicate else "valid",
                    activity,
                    service.project_activity(activity),
                    original_category,
                )
            )
        except (ValidationError, ValueError) as exc:
            rows.append(
                ActivityImportPreviewRow(
                    line_number,
                    "invalid",
                    error=(
                        str(exc)
                        if not isinstance(exc, ValueError)
                        else "Kind must be income, expense, transfer, or adjustment."
                    ),
                )
            )
    return ActivityImportPreview(
        sum(row.status == "valid" for row in rows),
        sum(row.status == "duplicate" for row in rows),
        sum(row.status == "invalid" for row in rows),
        rows,
    )


def export_activities_csv(path: Path | str, records: list[ActivityRecord]) -> Path:
    csv_path = Path(path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        write_activities_csv(csv_file, records)
    return csv_path


def export_activities_csv_text(records: list[ActivityRecord]) -> str:
    csv_file = StringIO()
    write_activities_csv(csv_file, records)
    return csv_file.getvalue()


def write_activities_csv(csv_file: TextIO, records: list[ActivityRecord]) -> None:
    writer = csv.DictWriter(csv_file, fieldnames=ACTIVITY_CSV_FIELDS)
    writer.writeheader()
    for record in records:
        activity = record.activity
        writer.writerow(
            {
                "kind": activity.kind.value,
                "amount": str(activity.amount),
                "category": activity.category or "",
                "description": activity.description,
                "date": activity.date.isoformat(),
                "account": _effect_name(record, PostingRole.ACCOUNT),
                "from_account": _effect_name(record, PostingRole.SOURCE),
                "to_account": _effect_name(record, PostingRole.DESTINATION),
            }
        )


def _activity_from_row(
    row: dict[str, str | None], kind: ActivityKind, accounts: AccountService
) -> Activity:
    amount = row.get("amount") or ""
    description = row.get("description") or ""
    activity_date = row.get("date") or ""
    if kind in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
        account = _active(accounts.resolve_account_reference(row.get("account") or ""))
        assert account.id is not None
        return Activity.income_or_expense(
            kind,
            amount,
            row.get("category") or "",
            description,
            activity_date,
            account.id,
            account.type,
        )
    if kind is ActivityKind.TRANSFER:
        source = _active(accounts.resolve_account_reference(row.get("from_account") or ""))
        destination = _active(accounts.resolve_account_reference(row.get("to_account") or ""))
        assert source.id is not None and destination.id is not None
        return Activity.transfer(
            amount,
            description,
            activity_date,
            source.id,
            source.type,
            destination.id,
            destination.type,
        )
    account = _active(accounts.resolve_account_reference(row.get("account") or ""))
    assert account.id is not None
    return Activity.set_balance(
        ActivityKind.ADJUSTMENT, amount, description, activity_date, account.id
    )


def _active(account: Account) -> Account:
    if not account.active:
        raise ValidationError(f"Account '{account.name}' is archived.")
    return account


def _store_activity(service: ActivityService, activity: Activity) -> None:
    if activity.kind in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
        posting = activity.postings[0]
        service.add_activity(
            activity.kind.value,
            str(activity.amount),
            activity.category or "",
            activity.description,
            activity.date,
            posting.account_id,
        )
    elif activity.kind is ActivityKind.TRANSFER:
        source = activity.posting(PostingRole.SOURCE)
        destination = activity.posting(PostingRole.DESTINATION)
        assert source is not None and destination is not None
        service.add_transfer(
            str(activity.amount),
            activity.description,
            activity.date,
            source.account_id,
            destination.account_id,
        )
    else:
        service.adjust_account(
            activity.postings[0].account_id,
            str(activity.amount),
            activity.date,
            activity.description,
        )


def _effect_name(record: ActivityRecord, role: PostingRole) -> str:
    effect = record.effect(role)
    return effect.account_name if effect else ""


def _duplicate_key(activity: Activity) -> tuple[object, ...]:
    return (
        activity.kind.value,
        str(activity.amount),
        (activity.category or "").casefold(),
        activity.description,
        activity.date.isoformat(),
        tuple(sorted((posting.account_id, posting.role.value) for posting in activity.postings)),
    )
