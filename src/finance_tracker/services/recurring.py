"""Recurring template use cases and transaction boundaries."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.models.common import validate_month, validate_year
from finance_tracker.models.recurring import RecurringTemplate
from finance_tracker.models.transactions import Transaction
from finance_tracker.repositories.category_rules import CategoryRuleRepository
from finance_tracker.repositories.recurring import RecurringTemplateRepository
from finance_tracker.repositories.transactions import TransactionRepository


@dataclass(frozen=True)
class RecurringApplyResult:
    created: list[Transaction]
    skipped_duplicates: int


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
        with database_transaction(self.db_path) as connection:
            template = _canonical_template(connection, template)
            return RecurringTemplateRepository(connection).add(template)

    def list_templates(self, active_only: bool = False) -> list[RecurringTemplate]:
        with database_transaction(self.db_path) as connection:
            return RecurringTemplateRepository(connection).list(active_only=active_only)

    def delete_template(self, template_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            RecurringTemplateRepository(connection).delete(template_id)

    def apply_templates(self, month: int, year: int) -> RecurringApplyResult:
        validate_month(month)
        validate_year(year)
        _, last_day = monthrange(year, month)
        created: list[Transaction] = []
        skipped_duplicates = 0
        with database_transaction(self.db_path) as connection:
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
