from decimal import Decimal

import pytest

from finance_tracker.exceptions import TransactionNotFoundError, ValidationError
from finance_tracker.services import TransactionService


def test_add_and_filter_transactions(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")

    income = service.add_transaction("income", "2500", "Salary", "June salary", "2026-06-01")
    service.add_transaction("expense", "45.90", "Food", "Groceries", "2026-06-12")
    service.add_transaction("expense", "20", "Food", "Lunch", "2026-07-01")

    june_transactions = service.list_transactions(month=6, year=2026)
    food_transactions = service.list_transactions(category="food", transaction_type="expense")

    assert income.id is not None
    assert len(june_transactions) == 2
    assert len(food_transactions) == 2
    assert food_transactions[0].amount == Decimal("20.00")


@pytest.mark.parametrize(
    ("transaction_type", "amount", "category", "transaction_date", "message"),
    [
        ("bonus", "10", "Other", "2026-06-01", "income'.*expense"),
        ("income", "-10", "Salary", "2026-06-01", "greater than zero"),
        ("income", "abc", "Salary", "2026-06-01", "valid number"),
        ("income", "10", "", "2026-06-01", "Category is required"),
        ("income", "10", "Salary", "06-01-2026", "YYYY-MM-DD"),
    ],
)
def test_add_transaction_validates_input(
    tmp_path, transaction_type, amount, category, transaction_date, message
):
    service = TransactionService(tmp_path / "finance.sqlite3")

    with pytest.raises(ValidationError, match=message):
        service.add_transaction(transaction_type, amount, category, "", transaction_date)


def test_delete_transaction(tmp_path):
    service = TransactionService(tmp_path / "finance.sqlite3")
    transaction = service.add_transaction("expense", "15", "Food", "Coffee", "2026-06-02")

    service.delete_transaction(transaction.id)

    assert service.count_transactions() == 0
    with pytest.raises(TransactionNotFoundError):
        service.delete_transaction(transaction.id)
