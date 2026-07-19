from finance_tracker.csv_io import (
    ACTIVITY_CSV_FIELDS,
    export_activities_csv_text,
    import_activities_csv_text,
    preview_activities_csv_text,
)
from finance_tracker.exceptions import CsvFormatError
from finance_tracker.services import AccountService, ActivityService

HEADER = ",".join(ACTIVITY_CSV_FIELDS)


def _services(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    accounts = AccountService(db_path)
    checking = accounts.create_account("Checking", "asset", "100", "2026-01-01", "cash")
    savings = accounts.create_account("Savings", "asset", "0", "2026-01-01", "cash")
    return ActivityService(db_path), checking, savings


def test_activity_csv_preview_validates_kind_fields_and_calculates_effects(tmp_path):
    service, _, _ = _services(tmp_path)
    csv_text = "\n".join(
        [
            HEADER,
            "expense,25,Food,Dinner,2026-06-03,Checking,,",
            "transfer,20,,Save,2026-06-04,,Checking,Savings",
            "adjustment,90,,Bank observation,2026-06-05,Checking,,",
            "expense,10,,Missing category,2026-06-06,Checking,,",
        ]
    )

    preview = preview_activities_csv_text(csv_text, service)

    assert (preview.valid_count, preview.invalid_count) == (3, 1)
    assert preview.rows[0].effects.effects[0].after_balance.__str__() == "75.00"
    assert "category" in preview.rows[-1].error.lower()


def test_activity_csv_duplicate_detection_is_account_aware(tmp_path):
    service, _, _ = _services(tmp_path)
    first = f"{HEADER}\nexpense,25,Food,Dinner,2026-06-03,Checking,,\n"
    other_account = f"{HEADER}\nexpense,25,Food,Dinner,2026-06-03,Savings,,\n"
    assert import_activities_csv_text(first, service).imported_count == 1
    assert preview_activities_csv_text(first, service).duplicate_count == 1
    assert preview_activities_csv_text(other_account, service).valid_count == 1


def test_activity_csv_round_trip_preserves_semantic_account_references(tmp_path):
    service, checking, savings = _services(tmp_path)
    service.add_activity("income", "50", "Salary", "Pay", "2026-06-01", checking.id)
    service.add_transfer("20", "Save", "2026-06-02", checking.id, savings.id)
    service.adjust_account(savings.id, "25", "2026-06-03", "Observed")
    exported = export_activities_csv_text(
        [item for item in service.list_activities() if item.activity.kind.value != "opening"]
    )

    target_path = tmp_path / "target.sqlite3"
    target_accounts = AccountService(target_path)
    target_accounts.create_account("Checking", "asset", "100", "2026-01-01", "cash")
    target_accounts.create_account("Savings", "asset", "0", "2026-01-01", "cash")
    result = import_activities_csv_text(exported, ActivityService(target_path))

    assert exported.splitlines()[0] == HEADER
    assert ",Checking,," in exported
    assert ",,Checking,Savings" in exported
    assert result.imported_count == 3


def test_activity_csv_rejects_missing_required_header(tmp_path):
    service, _, _ = _services(tmp_path)
    try:
        preview_activities_csv_text("kind,amount\nexpense,10\n", service)
    except CsvFormatError as exc:
        assert "missing required columns" in str(exc)
    else:
        raise AssertionError("missing headers should be rejected")
