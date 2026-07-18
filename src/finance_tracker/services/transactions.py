"""Transaction use cases and transaction boundaries."""

from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.models.transactions import (
    Transaction,
    TransactionFilters,
    parse_transaction_type,
)
from finance_tracker.repositories.category_rules import CategoryRuleRepository
from finance_tracker.repositories.transactions import TransactionRepository


class TransactionService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
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
        with database_transaction(self.db_path) as connection:
            transaction = _canonical_transaction(connection, transaction)
            return TransactionRepository(connection).add(transaction)

    def edit_transaction(
        self,
        transaction_id: int,
        transaction_type: str | None = None,
        amount: str | None = None,
        category: str | None = None,
        description: str | None = None,
        transaction_date: str | None = None,
    ) -> Transaction:
        with database_transaction(self.db_path) as connection:
            repository = TransactionRepository(connection)
            current = repository.get(transaction_id)
            updated = Transaction.create(
                transaction_type=(
                    transaction_type if transaction_type is not None else current.type.value
                ),
                amount=amount if amount is not None else current.amount,
                category=category if category is not None else current.category,
                description=description if description is not None else current.description,
                transaction_date=(
                    transaction_date if transaction_date is not None else current.date
                ),
            )
            updated = _canonical_transaction(connection, updated)
            return repository.update(transaction_id, updated)

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
        with database_transaction(self.db_path) as connection:
            return TransactionRepository(connection).list(filters)

    def list_transactions_page(
        self,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        transaction_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Transaction], int]:
        filters = TransactionFilters(
            month=month,
            year=year,
            category=category,
            transaction_type=parse_transaction_type(transaction_type) if transaction_type else None,
        )
        with database_transaction(self.db_path) as connection:
            repository = TransactionRepository(connection)
            return repository.list(filters, limit=limit, offset=offset), repository.count_filtered(
                filters
            )

    def delete_transaction(self, transaction_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            TransactionRepository(connection).delete(transaction_id)

    def transaction_exists(self, transaction: Transaction) -> bool:
        with database_transaction(self.db_path) as connection:
            return TransactionRepository(connection).exists_matching(
                _canonical_transaction(connection, transaction)
            )

    def prepare_transaction(self, transaction: Transaction) -> Transaction:
        with database_transaction(self.db_path) as connection:
            return _canonical_transaction(connection, transaction)

    def add_transaction_if_new(self, transaction: Transaction) -> Transaction | None:
        with database_transaction(self.db_path) as connection:
            repository = TransactionRepository(connection)
            canonical = _canonical_transaction(connection, transaction)
            if repository.exists_matching(canonical):
                return None
            return repository.add(canonical)

    def count_transactions(self) -> int:
        with database_transaction(self.db_path) as connection:
            return TransactionRepository(connection).count()


def _canonical_transaction(connection, transaction: Transaction) -> Transaction:
    category = CategoryRuleRepository(connection).resolve_category(transaction.category)
    if category == transaction.category:
        return transaction
    return Transaction(
        id=transaction.id,
        type=transaction.type,
        amount=transaction.amount,
        category=category,
        description=transaction.description,
        date=transaction.date,
        created_at=transaction.created_at,
    )
