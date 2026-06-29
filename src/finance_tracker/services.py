"""Business logic for transactions."""

from pathlib import Path

from finance_tracker.database import connect, initialize_database
from finance_tracker.models import (
    Transaction,
    TransactionFilters,
    parse_transaction_type,
)
from finance_tracker.repositories import TransactionRepository


class TransactionService:
    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)
        initialize_database(self.db_path)

    def add_transaction(
        self,
        transaction_type: str,
        amount: str,
        category: str,
        description: str,
        transaction_date: str,
    ) -> Transaction:
        transaction = Transaction.create(
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            transaction_date=transaction_date,
        )
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).add(transaction)

    def list_transactions(
        self,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        transaction_type: str | None = None,
    ) -> list[Transaction]:
        filters = TransactionFilters(
            month=month,
            year=year,
            category=category,
            transaction_type=parse_transaction_type(transaction_type) if transaction_type else None,
        )
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).list(filters)

    def delete_transaction(self, transaction_id: int) -> None:
        with connect(self.db_path) as connection:
            TransactionRepository(connection).delete(transaction_id)

    def count_transactions(self) -> int:
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).count()
