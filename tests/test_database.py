from finance_tracker.database import connect, initialize_database


def test_initialize_database_creates_transactions_table(tmp_path):
    db_path = tmp_path / "finance.sqlite3"

    initialize_database(db_path)

    with connect(db_path) as connection:
        row = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'transactions'"
        ).fetchone()

    assert row["name"] == "transactions"


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
