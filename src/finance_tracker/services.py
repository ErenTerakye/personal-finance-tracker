"""Business logic for transactions."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from finance_tracker.database import connect, initialize_database
from finance_tracker.exceptions import ValidationError
from finance_tracker.models import (
    Budget,
    BudgetFilters,
    CategoryRule,
    RecurringTemplate,
    Transaction,
    TransactionFilters,
    TransactionType,
    parse_transaction_type,
    validate_month,
    validate_year,
)
from finance_tracker.repositories import (
    BudgetRepository,
    CategoryRuleRepository,
    RecurringTemplateRepository,
    SettingsRepository,
    TransactionRepository,
)


@dataclass(frozen=True)
class BudgetStatus:
    budget: Budget
    actual_expenses: Decimal
    remaining: Decimal
    percent_used: Decimal
    status: str


@dataclass(frozen=True)
class RecurringApplyResult:
    created: list[Transaction]
    skipped_duplicates: int


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
        with connect(self.db_path) as connection:
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
        with connect(self.db_path) as connection:
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
        with connect(self.db_path) as connection:
            repository = TransactionRepository(connection)
            return repository.list(filters, limit=limit, offset=offset), repository.count_filtered(
                filters
            )

    def delete_transaction(self, transaction_id: int) -> None:
        with connect(self.db_path) as connection:
            TransactionRepository(connection).delete(transaction_id)

    def transaction_exists(self, transaction: Transaction) -> bool:
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).exists_matching(
                _canonical_transaction(connection, transaction)
            )

    def prepare_transaction(self, transaction: Transaction) -> Transaction:
        with connect(self.db_path) as connection:
            return _canonical_transaction(connection, transaction)

    def add_transaction_if_new(self, transaction: Transaction) -> Transaction | None:
        with connect(self.db_path) as connection:
            repository = TransactionRepository(connection)
            canonical = _canonical_transaction(connection, transaction)
            if repository.exists_matching(canonical):
                return None
            return repository.add(canonical)

    def count_transactions(self) -> int:
        with connect(self.db_path) as connection:
            return TransactionRepository(connection).count()


class BudgetService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def set_budget(self, category: str, amount: str, month: int, year: int) -> Budget:
        budget = Budget.create(category=category, amount=amount, month=month, year=year)
        with connect(self.db_path) as connection:
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
        with connect(self.db_path) as connection:
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
        with connect(self.db_path) as connection:
            repository = BudgetRepository(connection)
            return repository.list(filters, limit=limit, offset=offset), repository.count_filtered(
                filters
            )

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


class CategoryRuleService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def set_rule(self, alias: str, category: str) -> CategoryRule:
        rule = CategoryRule.create(alias=alias, category=category)
        with connect(self.db_path) as connection:
            repository = CategoryRuleRepository(connection)
            canonical_category = repository.resolve_category(rule.category)
            rule = CategoryRule.create(alias=rule.alias, category=canonical_category)
            return repository.set(rule)

    def list_rules(self) -> list[CategoryRule]:
        with connect(self.db_path) as connection:
            return CategoryRuleRepository(connection).list()

    def delete_rule(self, rule_id: int) -> None:
        with connect(self.db_path) as connection:
            CategoryRuleRepository(connection).delete(rule_id)


class RecurringTemplateService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def add_template(
        self,
        transaction_type: str,
        amount: str,
        category: str,
        description: str,
        day_of_month: int,
    ) -> RecurringTemplate:
        template = RecurringTemplate.create(
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            description=description,
            day_of_month=day_of_month,
        )
        with connect(self.db_path) as connection:
            template = _canonical_template(connection, template)
            return RecurringTemplateRepository(connection).add(template)

    def list_templates(self, active_only: bool = False) -> list[RecurringTemplate]:
        with connect(self.db_path) as connection:
            return RecurringTemplateRepository(connection).list(active_only=active_only)

    def delete_template(self, template_id: int) -> None:
        with connect(self.db_path) as connection:
            RecurringTemplateRepository(connection).delete(template_id)

    def apply_templates(self, month: int, year: int) -> RecurringApplyResult:
        # Transaction.create validates the clamped date and all money fields.
        validate_month(month)
        validate_year(year)
        _, last_day = monthrange(year, month)
        created: list[Transaction] = []
        skipped_duplicates = 0
        with connect(self.db_path) as connection:
            templates = RecurringTemplateRepository(connection).list(active_only=True)
            transactions = TransactionRepository(connection)
            for template in templates:
                day = min(template.day_of_month, last_day)
                transaction = Transaction.create(
                    transaction_type=template.type.value,
                    amount=template.amount,
                    category=template.category,
                    description=template.description,
                    transaction_date=date(year, month, day),
                )
                transaction = _canonical_transaction(connection, transaction)
                if transactions.exists_matching(transaction):
                    skipped_duplicates += 1
                    continue
                created.append(transactions.add(transaction))
        return RecurringApplyResult(created=created, skipped_duplicates=skipped_duplicates)


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


def _canonical_template(connection, template: RecurringTemplate) -> RecurringTemplate:
    category = CategoryRuleRepository(connection).resolve_category(template.category)
    if category == template.category:
        return template
    return RecurringTemplate(
        id=template.id,
        type=template.type,
        amount=template.amount,
        category=category,
        description=template.description,
        day_of_month=template.day_of_month,
        active=template.active,
        created_at=template.created_at,
    )


class SettingsService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def get_currency(self) -> str:
        with connect(self.db_path) as connection:
            return SettingsRepository(connection).get("currency", "USD")

    def set_currency(self, currency_code: str) -> str:
        currency = currency_code.strip().upper()
        if len(currency) != 3 or not currency.isalpha():
            raise ValidationError("Currency must be a valid 3-letter ISO code.")
        with connect(self.db_path) as connection:
            SettingsRepository(connection).set("currency", currency)
            return currency
