import sqlite3

import pytest

from finance_tracker.exceptions import ValidationError
from finance_tracker.services import AccountService, ActivityService, LedgerRecoveryService


def test_v3_backup_verify_and_restore_preserve_complete_activity_ledger(tmp_path):
    active = tmp_path / "active.sqlite3"
    account = AccountService(active).create_account(
        "Checking", "asset", "100", "2026-01-01", "cash"
    )
    ActivityService(active).add_activity("expense", "10", "Food", "Lunch", "2026-01-02", account.id)
    recovery = LedgerRecoveryService(active)
    backup = tmp_path / "backup.sqlite3"

    verified = recovery.backup(backup)
    ActivityService(active).add_activity("expense", "5", "Food", "Snack", "2026-01-03", account.id)
    restored = recovery.restore(backup)

    assert verified.schema_version == restored.schema_version == 3
    assert ActivityService(active).count_activities() == 2
    assert (
        AccountService(active).get_resolved_account(account.id, "2026-01-03").balance.__str__()
        == "90.00"
    )


def test_verify_rejects_old_or_incomplete_ledgers(tmp_path):
    old = tmp_path / "old.sqlite3"
    connection = sqlite3.connect(old)
    connection.execute("CREATE TABLE transactions (id INTEGER)")
    connection.execute("PRAGMA user_version = 2")
    connection.commit()
    connection.close()
    with pytest.raises(ValidationError, match="requires schema version 3"):
        LedgerRecoveryService.verify(old)

    current = tmp_path / "current.sqlite3"
    AccountService(current)
    connection = sqlite3.connect(current)
    connection.execute("DROP TABLE activity_postings")
    connection.commit()
    connection.close()
    with pytest.raises(ValidationError, match="missing table activity_postings"):
        LedgerRecoveryService.verify(current)


def test_failed_restore_does_not_replace_active_ledger(tmp_path):
    active = tmp_path / "active.sqlite3"
    account = AccountService(active).create_account(
        "Checking", "asset", "100", "2026-01-01", "cash"
    )
    invalid = tmp_path / "invalid.sqlite3"
    invalid.write_text("not sqlite", encoding="utf-8")
    with pytest.raises(ValidationError):
        LedgerRecoveryService(active).restore(invalid)
    assert AccountService(active).get_account(account.id).name == "Checking"
