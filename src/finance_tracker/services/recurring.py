"""Recurring activity template use cases."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.exceptions import ValidationError
from finance_tracker.models.activities import (
    Activity,
    ActivityKind,
    ActivityRecord,
    parse_activity_kind,
)
from finance_tracker.models.common import validate_month, validate_year
from finance_tracker.models.recurring import RecurringTemplate
from finance_tracker.repositories.accounts import AccountRepository
from finance_tracker.repositories.activities import ActivityRepository
from finance_tracker.repositories.category_rules import CategoryRuleRepository
from finance_tracker.repositories.recurring import RecurringTemplateRepository
from finance_tracker.services.activities import _record_by_id, _require_active


@dataclass(frozen=True)
class RecurringApplyResult:
    created: list[ActivityRecord]
    skipped_duplicates: int


class RecurringTemplateService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def add_template(
        self,
        kind: str,
        amount: str,
        category: str | None,
        description: str,
        day_of_month: int,
        *,
        account_id: int | None = None,
        from_account_id: int | None = None,
        to_account_id: int | None = None,
    ) -> RecurringTemplate:
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection)
            resolved_kind = parse_activity_kind(kind)
            if resolved_kind is ActivityKind.TRANSFER:
                if from_account_id is None or to_account_id is None:
                    raise ValidationError(
                        "Recurring transfer requires source and destination accounts."
                    )
                _require_active(accounts.get(from_account_id))
                _require_active(accounts.get(to_account_id))
                canonical_category = None
            else:
                if resolved_kind not in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
                    raise ValidationError("Only income, expense, and transfer can recur.")
                if account_id is None:
                    raise ValidationError("Recurring income and expense require an account.")
                _require_active(accounts.get(account_id))
                canonical_category = CategoryRuleRepository(connection).resolve_category(
                    category or ""
                )
            template = RecurringTemplate.create(
                kind,
                amount,
                canonical_category,
                description,
                day_of_month,
                account_id=account_id,
                from_account_id=from_account_id,
                to_account_id=to_account_id,
            )
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
        created: list[ActivityRecord] = []
        skipped_duplicates = 0
        with database_transaction(self.db_path) as connection:
            templates = RecurringTemplateRepository(connection).list(active_only=True)
            activities = ActivityRepository(connection)
            accounts = AccountRepository(connection)
            for template in templates:
                activity_date = date(year, month, min(template.day_of_month, last_day))
                if template.kind is ActivityKind.TRANSFER:
                    source = accounts.get(_required(template.from_account_id))
                    destination = accounts.get(_required(template.to_account_id))
                    activity = Activity.transfer(
                        template.amount,
                        template.description,
                        activity_date,
                        _required(template.from_account_id),
                        source.type,
                        _required(template.to_account_id),
                        destination.type,
                    )
                else:
                    account = accounts.get(_required(template.account_id))
                    activity = Activity.income_or_expense(
                        template.kind,
                        template.amount,
                        template.category or "",
                        template.description,
                        activity_date,
                        _required(template.account_id),
                        account.type,
                    )
                if activities.exists_matching(activity):
                    skipped_duplicates += 1
                    continue
                stored = activities.add(activity)
                assert stored.id is not None
                created.append(_record_by_id(connection, stored.id))
        return RecurringApplyResult(created, skipped_duplicates)


def _required(value: int | None) -> int:
    assert value is not None
    return value
