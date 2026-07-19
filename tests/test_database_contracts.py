import sqlite3

from finance_tracker.database import (
    SCHEMA_VERSION,
    connect,
    initialize_database,
    schema_contract_violations,
)


def test_fresh_v3_database_matches_schema_contract(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    initialize_database(path)
    with connect(path) as connection:
        assert schema_contract_violations(connection, SCHEMA_VERSION) == ()


def test_schema_contract_detects_missing_posting_foreign_key_table(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    initialize_database(path)
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = OFF")
    connection.execute("DROP TABLE activity_postings")
    connection.commit()
    violations = schema_contract_violations(connection, SCHEMA_VERSION)
    connection.close()
    assert "missing table activity_postings" in violations


def test_raw_activity_and_recurring_shape_constraints(tmp_path):
    path = tmp_path / "ledger.sqlite3"
    initialize_database(path)
    with connect(path) as connection:
        connection.execute(
            "INSERT INTO accounts (name, type, subtype) VALUES ('Cash', 'asset', 'cash')"
        )
        try:
            connection.execute(
                "INSERT INTO activities (kind, amount, category, effective_date) "
                "VALUES ('transfer', '10.00', 'Food', '2026-01-01')"
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("transfer category constraint was not enforced")
        try:
            connection.execute(
                "INSERT INTO recurring_templates "
                "(kind, amount, category, day_of_month, account_id) "
                "VALUES ('transfer', '10.00', NULL, 1, 1)"
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("recurring transfer shape was not enforced")
