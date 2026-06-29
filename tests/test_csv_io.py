from finance_tracker.csv_io import export_transactions_csv, import_transactions_csv
from finance_tracker.exceptions import CsvFormatError
from finance_tracker.services import TransactionService


def test_import_transactions_csv_skips_invalid_rows(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    csv_path = tmp_path / "transactions.csv"
    csv_path.write_text(
        "\n".join(
            [
                "type,amount,category,description,date",
                "income,1000,Salary,Paycheck,2026-06-01",
                "expense,-20,Food,Invalid expense,2026-06-02",
                "expense,25,Food,Dinner,2026-06-03",
            ]
        ),
        encoding="utf-8",
    )

    result = import_transactions_csv(csv_path, service)

    assert result.imported_count == 2
    assert result.skipped_count == 1
    assert "greater than zero" in result.errors[0]
    assert service.count_transactions() == 2


def test_import_transactions_csv_requires_expected_columns(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    csv_path = tmp_path / "bad.csv"
    csv_path.write_text("type,amount,date\nincome,10,2026-06-01\n", encoding="utf-8")

    try:
        import_transactions_csv(csv_path, service)
    except CsvFormatError as exc:
        assert "missing required columns" in str(exc)
    else:
        raise AssertionError("Expected CsvFormatError.")


def test_export_transactions_csv_can_be_imported_again(tmp_path):
    service = TransactionService(tmp_path / "source.sqlite3")
    service.add_transaction("income", "1000", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "25.50", "Food", "Dinner", "2026-06-03")
    export_path = tmp_path / "exports" / "transactions.csv"

    export_transactions_csv(export_path, service.list_transactions())
    new_service = TransactionService(tmp_path / "target.sqlite3")
    result = import_transactions_csv(export_path, new_service)

    assert result.imported_count == 2
    assert result.skipped_count == 0
    assert new_service.count_transactions() == 2
