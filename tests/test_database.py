import sqlite3

import pytest

from finance_tracker.database import SCHEMA_VERSION, connect, initialize_database
from finance_tracker.exceptions import ValidationError
from finance_tracker.services import AccountService


def test_fresh_database_creates_schema_v3_activity_ledger(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    initialize_database(path)
    with connect(path) as connection:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_schema WHERE type = 'table'")
        }
    assert version == SCHEMA_VERSION == 3
    assert {"accounts", "activities", "activity_postings", "recurring_templates"} <= tables
    assert "transactions" not in tables
    assert "account_balance_snapshots" not in tables


@pytest.mark.parametrize("version", [1, 2])
def test_old_ledger_is_rejected_without_mutation(tmp_path, version):
    path = tmp_path / "old.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE legacy (value TEXT)")
    connection.execute("INSERT INTO legacy VALUES ('keep me')")
    connection.execute(f"PRAGMA user_version = {version}")
    connection.commit()
    connection.close()

    with pytest.raises(RuntimeError, match="intentional clean break"):
        initialize_database(path)

    connection = sqlite3.connect(path)
    assert connection.execute("SELECT value FROM legacy").fetchone()[0] == "keep me"
    assert connection.execute("PRAGMA user_version").fetchone()[0] == version
    connection.close()


def test_unversioned_populated_ledger_is_rejected_with_backup_guidance(tmp_path):
    path = tmp_path / "old.sqlite3"
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE transactions (id INTEGER)")
    connection.commit()
    connection.close()
    with pytest.raises(RuntimeError, match="back up this file"):
        initialize_database(path)


def test_case_insensitive_account_names_and_subtype_constraints(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    accounts = AccountService(path)
    accounts.create_account("Checking", "asset", "0", "2026-01-01", "cash")
    with pytest.raises(ValidationError, match="unique"):
        accounts.create_account("checking", "asset", "0", "2026-01-01", "cash")
    with pytest.raises(Exception, match="subtype"):
        accounts.create_account("Bad", "asset", "0", "2026-01-01", "loan")


def test_foreign_keys_restrict_accounts_and_cascade_postings(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    account = AccountService(path).create_account("Cash", "asset", "0", "2026-01-01", "cash")
    with connect(path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("DELETE FROM accounts WHERE id = ?", (account.id,))
        activity_id = connection.execute(
            "SELECT id FROM activities WHERE kind = 'opening'"
        ).fetchone()[0]
        connection.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
        assert connection.execute("SELECT COUNT(*) FROM activity_postings").fetchone()[0] == 0
