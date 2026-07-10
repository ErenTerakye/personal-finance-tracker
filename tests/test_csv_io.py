from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.csv_io import (
    export_budgets_csv,
    export_transactions_csv,
    import_budgets_csv,
    import_transactions_csv,
    preview_transactions_csv_text,
)
from finance_tracker.exceptions import CsvFormatError
from finance_tracker.services import BudgetService, TransactionService


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


def test_import_transactions_csv_previews_and_skips_duplicates(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("expense", "25", "Food", "Dinner", "2026-06-03")
    csv_path = tmp_path / "transactions.csv"
    csv_text = "\n".join(
        [
            "type,amount,category,description,date",
            "expense,25,Food,Dinner,2026-06-03",
            "expense,25,food,Dinner,2026-06-03",
            "expense,30,Food,Groceries,2026-06-04",
        ]
    )
    csv_path.write_text(csv_text, encoding="utf-8")

    preview = preview_transactions_csv_text(csv_text, service)
    result = import_transactions_csv(csv_path, service)

    assert preview.valid_count == 1
    assert preview.duplicate_count == 2
    assert preview.invalid_count == 0
    assert result.imported_count == 1
    assert result.skipped_count == 2
    assert service.count_transactions() == 2


def test_import_transactions_csv_can_allow_duplicates(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    service.add_transaction("expense", "25", "Food", "Dinner", "2026-06-03")
    csv_path = tmp_path / "transactions.csv"
    csv_path.write_text(
        "\n".join(
            [
                "type,amount,category,description,date",
                "expense,25,Food,Dinner,2026-06-03",
            ]
        ),
        encoding="utf-8",
    )

    result = import_transactions_csv(csv_path, service, allow_duplicates=True)

    assert result.imported_count == 1
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


def test_import_budgets_csv_creates_budgets_and_updates_duplicates(tmp_path):
    service = BudgetService(tmp_path / "finance.sqlite3")
    csv_path = tmp_path / "budgets.csv"
    csv_path.write_text(
        "\n".join(
            [
                "category,amount,month,year",
                "Food,100,6,2026",
                "food,150,6,2026",
                "Rent,1200,6,2026",
            ]
        ),
        encoding="utf-8",
    )

    result = import_budgets_csv(csv_path, service)
    budgets = service.list_budgets(month=6, year=2026)

    assert result.imported_count == 3
    assert result.skipped_count == 0
    assert len(budgets) == 2
    assert str(service.list_budgets(category="food")[0].amount) == "150.00"


def test_import_budgets_csv_skips_invalid_rows(tmp_path):
    service = BudgetService(tmp_path / "finance.sqlite3")
    csv_path = tmp_path / "budgets.csv"
    csv_path.write_text(
        "\n".join(
            [
                "category,amount,month,year",
                "Food,400,6,2026",
                "Rent,-100,6,2026",
                "Transport,100,soon,2026",
                "Utilities,80,13,2026",
            ]
        ),
        encoding="utf-8",
    )

    result = import_budgets_csv(csv_path, service)

    assert result.imported_count == 1
    assert result.skipped_count == 3
    assert "Line 3: Amount must be greater than zero." in result.errors
    assert "Line 4: Month must be a valid integer." in result.errors
    assert "Line 5: Month must be between 1 and 12." in result.errors
    assert len(service.list_budgets()) == 1


def test_import_budgets_csv_requires_expected_columns(tmp_path):
    service = BudgetService(tmp_path / "finance.sqlite3")
    csv_path = tmp_path / "bad-budgets.csv"
    csv_path.write_text("category,amount,year\nFood,400,2026\n", encoding="utf-8")

    try:
        import_budgets_csv(csv_path, service)
    except CsvFormatError as exc:
        assert "missing required columns" in str(exc)
        assert "month" in str(exc)
    else:
        raise AssertionError("Expected CsvFormatError.")


def test_export_budgets_csv_can_be_imported_again(tmp_path):
    service = BudgetService(tmp_path / "source.sqlite3")
    service.set_budget("Food", "400", 6, 2026)
    service.set_budget("Rent", "1200", 6, 2026)
    export_path = tmp_path / "exports" / "budgets.csv"

    export_budgets_csv(export_path, service.list_budgets())
    new_service = BudgetService(tmp_path / "target.sqlite3")
    result = import_budgets_csv(export_path, new_service)

    assert result.imported_count == 2
    assert result.skipped_count == 0
    assert len(new_service.list_budgets(month=6, year=2026)) == 2


def test_cli_budget_csv_import_and_export_flow(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"
    import_path = tmp_path / "budgets.csv"
    export_path = tmp_path / "exports" / "june-budgets.csv"
    import_path.write_text(
        "\n".join(
            [
                "category,amount,month,year",
                "Food,400,6,2026",
                "Rent,1200,6,2026",
                "Travel,300,7,2026",
            ]
        ),
        encoding="utf-8",
    )

    import_result = runner.invoke(
        app,
        ["import-budgets-csv", str(import_path), "--db-path", str(db_path)],
    )
    export_result = runner.invoke(
        app,
        [
            "export-budgets-csv",
            str(export_path),
            "--month",
            "6",
            "--year",
            "2026",
            "--db-path",
            str(db_path),
        ],
    )

    assert import_result.exit_code == 0
    assert export_result.exit_code == 0
    assert "Imported 3 budget(s)." in import_result.output
    assert "Exported 2 budget(s)" in export_result.output
    exported_text = export_path.read_text(encoding="utf-8")
    assert "Food,400.00,6,2026" in exported_text
    assert "Rent,1200.00,6,2026" in exported_text
    assert "Travel" not in exported_text
