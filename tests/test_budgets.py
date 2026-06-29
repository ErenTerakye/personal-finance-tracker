from decimal import Decimal

import pytest
from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.database import connect, initialize_database
from finance_tracker.exceptions import BudgetNotFoundError, ValidationError
from finance_tracker.models import Budget
from finance_tracker.repositories import BudgetRepository
from finance_tracker.services import BudgetService, TransactionService


def test_budget_validates_input():
    budget = Budget.create("Food", "250", 6, 2026)

    assert budget.category == "Food"
    assert budget.amount == Decimal("250.00")
    assert budget.month == 6
    assert budget.year == 2026


@pytest.mark.parametrize(
    ("category", "amount", "month", "year", "message"),
    [
        ("", "250", 6, 2026, "Category is required"),
        ("Food", "0", 6, 2026, "greater than zero"),
        ("Food", "abc", 6, 2026, "valid number"),
        ("Food", "250", 13, 2026, "Month must be between 1 and 12"),
        ("Food", "250", 6, 0, "Year must be a positive integer"),
    ],
)
def test_budget_validation_rejects_invalid_input(category, amount, month, year, message):
    with pytest.raises(ValidationError, match=message):
        Budget.create(category, amount, month, year)


def test_budget_repository_sets_lists_updates_and_deletes_budget(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    initialize_database(db_path)

    with connect(db_path) as connection:
        repository = BudgetRepository(connection)

        created = repository.set(Budget.create("Food", "250", 6, 2026))
        updated = repository.set(Budget.create("food", "300", 6, 2026))
        budgets = repository.list()

        assert created.id == updated.id
        assert updated.amount == Decimal("300.00")
        assert updated.category == "food"
        assert budgets == [updated]

        repository.delete(updated.id)

        assert repository.list() == []
        with pytest.raises(BudgetNotFoundError):
            repository.delete(updated.id)


def test_budget_statuses_compare_budgets_to_expenses(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)

    budgets.set_budget("Food", "100", 6, 2026)
    budgets.set_budget("Rent", "1000", 6, 2026)
    budgets.set_budget("Travel", "50", 6, 2026)
    budgets.set_budget("Food", "200", 7, 2026)
    transactions.add_transaction("expense", "40", "food", "Groceries", "2026-06-02")
    transactions.add_transaction("expense", "50", "Food", "Dinner", "2026-06-03")
    transactions.add_transaction("expense", "1000", "Rent", "June rent", "2026-06-01")
    transactions.add_transaction("expense", "75", "Travel", "Taxi", "2026-06-04")
    transactions.add_transaction("income", "500", "Food", "Ignored income", "2026-06-05")

    statuses = {status.budget.category: status for status in budgets.budget_statuses(6, 2026)}

    assert statuses["Food"].actual_expenses == Decimal("90.00")
    assert statuses["Food"].remaining == Decimal("10.00")
    assert statuses["Food"].percent_used == Decimal("90.0")
    assert statuses["Food"].status == "near limit"
    assert statuses["Rent"].remaining == Decimal("0.00")
    assert statuses["Rent"].status == "near limit"
    assert statuses["Travel"].remaining == Decimal("-25.00")
    assert statuses["Travel"].status == "over budget"


def test_cli_budget_flow(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"

    set_result = runner.invoke(
        app,
        [
            "budget-set",
            "Food",
            "100",
            "--month",
            "6",
            "--year",
            "2026",
            "--db-path",
            str(db_path),
        ],
    )
    add_result = runner.invoke(
        app,
        [
            "add",
            "expense",
            "90",
            "--category",
            "food",
            "--description",
            "Groceries",
            "--date",
            "2026-06-12",
            "--db-path",
            str(db_path),
        ],
    )
    list_result = runner.invoke(
        app,
        ["budget-list", "--month", "6", "--year", "2026", "--db-path", str(db_path)],
    )
    status_result = runner.invoke(
        app,
        ["budget-status", "--month", "6", "--year", "2026", "--db-path", str(db_path)],
    )
    delete_result = runner.invoke(app, ["budget-delete", "1", "--db-path", str(db_path)])

    assert set_result.exit_code == 0
    assert add_result.exit_code == 0
    assert list_result.exit_code == 0
    assert status_result.exit_code == 0
    assert delete_result.exit_code == 0
    assert "Set budget #1: Food $100.00 for 2026-06" in set_result.output
    assert "Food" in list_result.output
    assert "$100.00" in list_result.output
    assert "$90.00" in status_result.output
    assert "90.0%" in status_result.output
    assert "near limit" in status_result.output
    assert "Deleted budget #1" in delete_result.output
