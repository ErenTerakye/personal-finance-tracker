"""Frozen SQLite schema and migration behavior."""

import sqlite3
from contextlib import closing

import pytest

import finance_tracker.database as database

EXPECTED_SCHEMA = {
    ("index", "idx_account_balance_snapshots_account_date"): (
        "CREATE INDEX idx_account_balance_snapshots_account_date "
        "ON account_balance_snapshots(account_id, effective_date DESC)"
    ),
    ("index", "idx_account_balance_snapshots_date"): (
        "CREATE INDEX idx_account_balance_snapshots_date "
        "ON account_balance_snapshots(effective_date)"
    ),
    ("index", "idx_accounts_type_active"): (
        "CREATE INDEX idx_accounts_type_active ON accounts(type, archived_on)"
    ),
    ("index", "idx_budgets_period"): (
        "CREATE INDEX idx_budgets_period ON budgets(year, month)"
    ),
    ("index", "idx_budgets_period_category"): (
        "CREATE UNIQUE INDEX idx_budgets_period_category "
        "ON budgets(year, month, LOWER(category))"
    ),
    ("index", "idx_category_rules_alias"): (
        "CREATE UNIQUE INDEX idx_category_rules_alias ON category_rules(LOWER(alias))"
    ),
    ("index", "idx_recurring_templates_active"): (
        "CREATE INDEX idx_recurring_templates_active ON recurring_templates(active)"
    ),
    ("index", "idx_transactions_category"): (
        "CREATE INDEX idx_transactions_category ON transactions(category)"
    ),
    ("index", "idx_transactions_date"): (
        "CREATE INDEX idx_transactions_date ON transactions(date)"
    ),
    ("index", "idx_transactions_duplicate"): (
        "CREATE INDEX idx_transactions_duplicate "
        "ON transactions(type, amount, LOWER(category), description, date)"
    ),
    ("index", "idx_transactions_filter"): (
        "CREATE INDEX idx_transactions_filter ON transactions(date, LOWER(category), type)"
    ),
    ("index", "idx_transactions_type"): (
        "CREATE INDEX idx_transactions_type ON transactions(type)"
    ),
    ("table", "budgets"): (
        "CREATE TABLE budgets ( id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "category TEXT NOT NULL, month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12), "
        "year INTEGER NOT NULL CHECK (year > 0), amount TEXT NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )"
    ),
    ("table", "account_balance_snapshots"): (
        "CREATE TABLE account_balance_snapshots ( "
        "id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, "
        "amount TEXT NOT NULL, effective_date TEXT NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, "
        "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, "
        "FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE, "
        "UNIQUE (account_id, effective_date) )"
    ),
    ("table", "accounts"): (
        "CREATE TABLE accounts ( id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "name TEXT NOT NULL, "
        "type TEXT NOT NULL CHECK (type IN ('asset', 'liability')), "
        "archived_on TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )"
    ),
    ("table", "category_rules"): (
        "CREATE TABLE category_rules ( id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "alias TEXT NOT NULL, category TEXT NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )"
    ),
    ("table", "recurring_templates"): (
        "CREATE TABLE recurring_templates ( id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "type TEXT NOT NULL CHECK (type IN ('income', 'expense')), amount TEXT NOT NULL, "
        "category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', "
        "day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31), "
        "active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)), "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )"
    ),
    ("table", "settings"): (
        "CREATE TABLE settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL )"
    ),
    ("table", "transactions"): (
        "CREATE TABLE transactions ( id INTEGER PRIMARY KEY AUTOINCREMENT, "
        "type TEXT NOT NULL CHECK (type IN ('income', 'expense')), amount TEXT NOT NULL, "
        "category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, "
        "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP )"
    ),
}


def _normalized_schema(connection: sqlite3.Connection) -> dict[tuple[str, str], str]:
    rows = connection.execute(
        """
        SELECT type, name, sql
        FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY type, name
        """
    ).fetchall()
    return {(row[0], row[1]): " ".join(row[2].split()) for row in rows}


def test_fresh_database_matches_the_frozen_schema_and_index_manifest(tmp_path):
    db_path = tmp_path / "fresh.sqlite3"

    database.initialize_database(db_path)

    with closing(sqlite3.connect(db_path)) as connection, connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert _normalized_schema(connection) == EXPECTED_SCHEMA


def test_current_v2_database_is_not_migrated_again(tmp_path, monkeypatch):
    db_path = tmp_path / "current.sqlite3"
    database.initialize_database(db_path)
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute(
            """
            INSERT INTO transactions (type, amount, category, description, date)
            VALUES ('expense', '12.34', 'Food', 'Keep me', '2026-07-10')
            """
        )

    monkeypatch.setattr(database, "MIGRATIONS", ("THIS MUST NOT EXECUTE",))

    database.initialize_database(db_path)

    with closing(sqlite3.connect(db_path)) as connection, connection:
        row = connection.execute(
            "SELECT amount, description FROM transactions WHERE id = 1"
        ).fetchone()
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert row == ("12.34", "Keep me")


def test_current_v1_database_upgrades_and_preserves_rows_and_settings(tmp_path):
    db_path = tmp_path / "version-one.sqlite3"
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.executescript(database.SCHEMA_SQL)
        connection.execute(
            "INSERT INTO settings (key, value) VALUES ('currency', 'TRY')"
        )
        connection.execute(
            """
            INSERT INTO transactions (type, amount, category, description, date)
            VALUES ('expense', '12.34', 'Food', 'Keep me', '2026-07-10')
            """
        )
        connection.execute("PRAGMA user_version = 1")

    database.initialize_database(db_path)

    with closing(sqlite3.connect(db_path)) as connection, connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
        assert connection.execute(
            "SELECT amount, description FROM transactions"
        ).fetchone() == ("12.34", "Keep me")
        assert connection.execute(
            "SELECT value FROM settings WHERE key = 'currency'"
        ).fetchone()[0] == "TRY"
        assert connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
        ).fetchone()[0] == "accounts"


def test_database_rejects_a_future_schema_version_without_mutation(tmp_path):
    db_path = tmp_path / "future.sqlite3"
    database.initialize_database(db_path)
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute(f"PRAGMA user_version = {database.SCHEMA_VERSION + 1}")
        before = _normalized_schema(connection)

    with pytest.raises(RuntimeError, match="newer than supported version"):
        database.initialize_database(db_path)

    with closing(sqlite3.connect(db_path)) as connection, connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == (
            database.SCHEMA_VERSION + 1
        )
        assert _normalized_schema(connection) == before


def test_failed_migration_rolls_back_all_schema_changes(tmp_path, monkeypatch):
    db_path = tmp_path / "failed.sqlite3"
    monkeypatch.setattr(
        database,
        "MIGRATIONS",
        ("CREATE TABLE partially_created (id INTEGER); THIS IS INVALID SQL;",),
    )

    with pytest.raises(sqlite3.OperationalError, match='near "THIS"'):
        database.initialize_database(db_path)

    with closing(sqlite3.connect(db_path)) as connection, connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 0
        assert _normalized_schema(connection) == {}
