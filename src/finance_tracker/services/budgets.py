"""Budget use cases and transaction boundaries."""

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.models.activities import ActivityFilters, ActivityKind
from finance_tracker.models.budgets import Budget, BudgetFilters
from finance_tracker.repositories.activities import ActivityRepository
from finance_tracker.repositories.budgets import BudgetRepository
from finance_tracker.repositories.category_rules import CategoryRuleRepository


@dataclass(frozen=True)
class BudgetStatus:
    budget: Budget
    actual_expenses: Decimal
    remaining: Decimal
    percent_used: Decimal
    status: str


class BudgetService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def set_budget(self, category: str, amount: str, month: int, year: int) -> Budget:
        budget = Budget.create(category=category, amount=amount, month=month, year=year)
        with database_transaction(self.db_path) as connection:
            budget = Budget(
                category=CategoryRuleRepository(connection).resolve_category(budget.category),
                amount=budget.amount,
                month=budget.month,
                year=budget.year,
            )
            return BudgetRepository(connection).set(budget)

    def list_budgets(
        self,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
    ) -> list[Budget]:
        filters = BudgetFilters(month=month, year=year, category=category)
        with database_transaction(self.db_path) as connection:
            return BudgetRepository(connection).list(filters)

    def list_budgets_page(
        self,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Budget], int]:
        filters = BudgetFilters(month=month, year=year, category=category)
        with database_transaction(self.db_path) as connection:
            repository = BudgetRepository(connection)
            return repository.list(filters, limit=limit, offset=offset), repository.count_filtered(
                filters
            )

    def delete_budget(self, budget_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            BudgetRepository(connection).delete(budget_id)

    def budget_statuses(self, month: int, year: int) -> list[BudgetStatus]:
        filters = BudgetFilters(month=month, year=year)
        with database_transaction(self.db_path) as connection:
            budgets = BudgetRepository(connection).list(filters)
            transactions = ActivityRepository(connection).list(
                ActivityFilters(
                    month=month,
                    year=year,
                    kind=ActivityKind.EXPENSE,
                )
            )

        expenses_by_category: dict[str, Decimal] = {}
        for transaction in transactions:
            assert transaction.category is not None
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
