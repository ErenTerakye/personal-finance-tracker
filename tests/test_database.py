import sqlite3

from finance_tracker.database import SCHEMA_VERSION, connect, initialize_database


def test_initialize_database_creates_transactions_table(tmp_path):
    db_path = tmp_path / "finance.sqlite3"

    initialize_database(db_path)

    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'"
        ).fetchone()

    assert row["name"] == "transactions"


def test_initialize_database_creates_budgets_table(tmp_path):
    db_path = tmp_path / "finance.sqlite3"

    initialize_database(db_path)

    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budgets'"
        ).fetchone()

    assert row["name"] == "budgets"


def test_database_rejects_unknown_transaction_type(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        try:
            connection.execute(
                """
                INSERT INTO transactions (type, amount, category, description, date)
                VALUES ('bonus', '100.00', 'Other', '', '2026-06-01')
                """
            )
        except Exception as exc:
            assert "CHECK constraint failed" in str(exc)
        else:
            raise AssertionError("Expected SQLite CHECK constraint to reject invalid type.")


def test_database_enforces_budget_period_category_uniqueness_case_insensitively(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO budgets (category, month, year, amount)
            VALUES ('Food', 6, 2026, '100.00')
            """
        )

        try:
            connection.execute(
                """
                INSERT INTO budgets (category, month, year, amount)
                VALUES ('food', 6, 2026, '150.00')
                """
            )
        except Exception as exc:
            assert "UNIQUE constraint failed" in str(exc)
        else:
            raise AssertionError("Expected SQLite UNIQUE constraint to reject duplicate budget.")


def test_database_enforces_budget_month_and_year_constraints(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        for month, year in [(13, 2026), (6, 0)]:
            try:
                connection.execute(
                    """
                    INSERT INTO budgets (category, month, year, amount)
                    VALUES ('Food', ?, ?, '100.00')
                    """,
                    (month, year),
                )
            except Exception as exc:
                assert "CHECK constraint failed" in str(exc)
            else:
                raise AssertionError("Expected SQLite CHECK constraint to reject invalid budget.")


def test_database_creates_rules_and_recurring_tables_with_constraints(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO category_rules (alias, category)
            VALUES ('groceries', 'Food')
            """
        )
        connection.execute(
            """
            INSERT INTO recurring_templates
                (type, amount, category, description, day_of_month, active)
            VALUES ('expense', '1200.00', 'Rent', 'Monthly rent', 31, 1)
            """
        )

        try:
            connection.execute(
                """
                INSERT INTO category_rules (alias, category)
                VALUES ('GROCERIES', 'Food')
                """
            )
        except Exception as exc:
            assert "UNIQUE constraint failed" in str(exc)
        else:
            raise AssertionError("Expected SQLite UNIQUE constraint to reject duplicate alias.")

        try:
            connection.execute(
                """
                INSERT INTO recurring_templates
                    (type, amount, category, description, day_of_month, active)
                VALUES ('expense', '1200.00', 'Rent', '', 32, 1)
                """
            )
        except Exception as exc:
            assert "CHECK constraint failed" in str(exc)
        else:
            raise AssertionError("Expected SQLite CHECK constraint to reject invalid day.")


def test_initialize_database_creates_settings_table_and_defaults_currency(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        table_row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'"
        ).fetchone()
        setting_row = connection.execute(
            "SELECT value FROM settings WHERE key = 'currency'"
        ).fetchone()

    assert table_row["name"] == "settings"
    assert setting_row["value"] == "USD"


def test_initialize_database_versions_and_preserves_unversioned_ledger(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                amount TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            INSERT INTO transactions (type, amount, category, description, date)
            VALUES ('expense', '12.34', 'Food', 'Preserve me', '2026-07-10')
            """
        )

    initialize_database(db_path)

    with connect(db_path) as connection:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        row = connection.execute("SELECT amount, description FROM transactions").fetchone()
    assert version == SCHEMA_VERSION
    assert dict(row) == {"amount": "12.34", "description": "Preserve me"}


def test_connect_applies_financial_ledger_pragmas(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        assert connection.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert connection.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert connection.execute("PRAGMA synchronous").fetchone()[0] == 1
        assert connection.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
