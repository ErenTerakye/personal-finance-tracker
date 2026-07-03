from finance_tracker.database import connect, initialize_database


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
