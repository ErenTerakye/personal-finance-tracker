"""Business logic for transactions."""

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from finance_tracker.database import connect, initialize_database
from finance_tracker.models import (
    Budget,
    BudgetFilters,
    Transaction,
    TransactionFilters,
    TransactionType,
    parse_transaction_type,
)
from finance_tracker.repositories import BudgetRepository, TransactionRepository


@dataclass(frozen=True)
class BudgetStatus:
    budget: Budget
    actual_expenses: Decimal
    remaining: Decimal
    percent_used: Decimal
    status: str


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

    def edit_transaction(
        self,
        transaction_id: int,
        transaction_type: str | None = None,
        amount: str | None = None,
        category: str | None = None,
        description: str | None = None,
        transaction_date: str | None = None,
    ) -> Transaction:
        with connect(self.db_path) as connection:
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
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).list(filters)

    def delete_transaction(self, transaction_id: int) -> None:
        with connect(self.db_path) as connection:
            TransactionRepository(connection).delete(transaction_id)

    def count_transactions(self) -> int:
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).count()


class BudgetService:
    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)
        initialize_database(self.db_path)

    def set_budget(self, category: str, amount: str, month: int, year: int) -> Budget:
        budget = Budget.create(category=category, amount=amount, month=month, year=year)
        with connect(self.db_path) as connection:
            return BudgetRepository(connection).set(budget)

    def list_budgets(
        self,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
    ) -> list[Budget]:
        filters = BudgetFilters(month=month, year=year, category=category)
        with connect(self.db_path) as connection:
            return BudgetRepository(connection).list(filters)

    def delete_budget(self, budget_id: int) -> None:
        with connect(self.db_path) as connection:
            BudgetRepository(connection).delete(budget_id)

    def budget_statuses(self, month: int, year: int) -> list[BudgetStatus]:
        filters = BudgetFilters(month=month, year=year)
        with connect(self.db_path) as connection:
            budgets = BudgetRepository(connection).list(filters)
            transactions = TransactionRepository(connection).list(
                TransactionFilters(
                    month=month,
                    year=year,
                    transaction_type=TransactionType.EXPENSE,
                )
            )

        expenses_by_category: dict[str, Decimal] = {}
        for transaction in transactions:
            category_key = transaction.category.lower()
            expenses_by_category[category_key] = (
                expenses_by_category.get(category_key, Decimal("0.00")) + transaction.amount
            )

        return [
            self._build_status(
                budget=budget,
                actual_expenses=expenses_by_category.get(budget.category.lower(), Decimal("0.00")),
            )
            for budget in budgets
        ]

    @staticmethod
    def _build_status(budget: Budget, actual_expenses: Decimal) -> BudgetStatus:
        remaining = budget.amount - actual_expenses
        percent_used = (actual_expenses / budget.amount * Decimal("100")).quantize(Decimal("0.1"))

        if actual_expenses > budget.amount:
            status = "over budget"
        elif percent_used >= Decimal("90.0"):
            status = "near limit"
        else:
            status = "ok"

        return BudgetStatus(
            budget=budget,
            actual_expenses=actual_expenses,
            remaining=remaining,
            percent_used=percent_used,
            status=status,
        )
