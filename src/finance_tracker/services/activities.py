"""Activity-ledger use cases and deterministic balance calculation."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import Account
from finance_tracker.models.activities import (
    Activity,
    ActivityFilters,
    ActivityKind,
    ActivityRecord,
    PostingEffect,
    PostingKind,
    parse_activity_kind,
)
from finance_tracker.repositories.accounts import AccountRepository
from finance_tracker.repositories.activities import ActivityRepository
from finance_tracker.repositories.category_rules import CategoryRuleRepository


@dataclass(frozen=True)
class ActivityPage:
    activities: list[ActivityRecord]
    total: int
    limit: int
    offset: int


class ActivityService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def add_activity(
        self,
        kind: str,
        amount: str,
        category: str,
        description: str,
        activity_date: str | date,
        account_id: int,
    ) -> ActivityRecord:
        resolved_kind = parse_activity_kind(kind)
        if resolved_kind not in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
            raise ValidationError("Use transfer or account adjust for this activity kind.")
        with database_transaction(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            _require_active(account)
            canonical_category = CategoryRuleRepository(connection).resolve_category(category)
            activity = Activity.income_or_expense(
                resolved_kind,
                amount,
                canonical_category,
                description,
                activity_date,
                account_id,
                account.type,
            )
            stored = ActivityRepository(connection).add(activity)
            return _record_by_id(connection, _required_id(stored))

    def add_transfer(
        self,
        amount: str,
        description: str,
        activity_date: str | date,
        from_account_id: int,
        to_account_id: int,
    ) -> ActivityRecord:
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection)
            source = accounts.get(from_account_id)
            destination = accounts.get(to_account_id)
            _require_active(source)
            _require_active(destination)
            activity = Activity.transfer(
                amount,
                description,
                activity_date,
                from_account_id,
                source.type,
                to_account_id,
                destination.type,
            )
            stored = ActivityRepository(connection).add(activity)
            return _record_by_id(connection, _required_id(stored))

    def adjust_account(
        self,
        account_id: int,
        observed_balance: str,
        effective_date: str | date,
        description: str = "Balance update",
    ) -> ActivityRecord:
        with database_transaction(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            _require_active(account)
            activity = Activity.set_balance(
                ActivityKind.ADJUSTMENT,
                observed_balance,
                description,
                effective_date,
                account_id,
            )
            stored = ActivityRepository(connection).add(activity)
            return _record_by_id(connection, _required_id(stored))

    def get_activity(self, activity_id: int) -> ActivityRecord:
        with database_transaction(self.db_path) as connection:
            ActivityRepository(connection).get(activity_id)
            return _record_by_id(connection, activity_id)

    def edit_activity(
        self,
        activity_id: int,
        *,
        kind: str,
        amount: str,
        description: str,
        activity_date: str | date,
        category: str | None = None,
        account_id: int | None = None,
        from_account_id: int | None = None,
        to_account_id: int | None = None,
    ) -> ActivityRecord:
        requested_kind = parse_activity_kind(kind)
        with database_transaction(self.db_path) as connection:
            activities = ActivityRepository(connection)
            current = activities.get(activity_id)
            if current.kind is ActivityKind.OPENING:
                raise ValidationError("Opening activities are read-only.")
            if current.kind in {ActivityKind.TRANSFER, ActivityKind.ADJUSTMENT}:
                if requested_kind is not current.kind:
                    raise ValidationError(
                        f"{current.kind.value.title()} activity kind cannot change."
                    )
            elif requested_kind not in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
                raise ValidationError(
                    "Income and expense may only be reclassified between each other."
                )

            accounts = AccountRepository(connection)
            if requested_kind in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
                if account_id is None or category is None:
                    raise ValidationError("Income and expense require an account and category.")
                account = accounts.get(account_id)
                _require_active(account)
                updated = Activity.income_or_expense(
                    requested_kind,
                    amount,
                    CategoryRuleRepository(connection).resolve_category(category),
                    description,
                    activity_date,
                    account_id,
                    account.type,
                )
            elif requested_kind is ActivityKind.TRANSFER:
                if from_account_id is None or to_account_id is None:
                    raise ValidationError("Transfer requires source and destination accounts.")
                source = accounts.get(from_account_id)
                destination = accounts.get(to_account_id)
                _require_active(source)
                _require_active(destination)
                updated = Activity.transfer(
                    amount,
                    description,
                    activity_date,
                    from_account_id,
                    source.type,
                    to_account_id,
                    destination.type,
                )
            else:
                current_posting = current.postings[0]
                target_id = account_id if account_id is not None else current_posting.account_id
                account = accounts.get(target_id)
                _require_active(account)
                updated = Activity.set_balance(
                    ActivityKind.ADJUSTMENT,
                    amount,
                    description,
                    activity_date,
                    target_id,
                )
            stored = activities.update(activity_id, updated)
            return _record_by_id(connection, _required_id(stored))

    def delete_activity(self, activity_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            repository = ActivityRepository(connection)
            activity = repository.get(activity_id)
            if activity.kind is ActivityKind.OPENING:
                raise ValidationError("Opening activities cannot be deleted.")
            for posting in activity.postings:
                _require_active(AccountRepository(connection).get(posting.account_id))
            repository.delete(activity_id)

    def list_activities(
        self,
        *,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        kind: str | None = None,
        account_id: int | None = None,
        search: str | None = None,
    ) -> list[ActivityRecord]:
        filters = ActivityFilters(
            month=month,
            year=year,
            category=category,
            kind=parse_activity_kind(kind) if kind else None,
            account_id=account_id,
            search=search.strip() if search else None,
        )
        with database_transaction(self.db_path) as connection:
            activities = ActivityRepository(connection).list(filters)
            records = _calculate_records(connection)
            by_id = {_required_id(record.activity): record for record in records}
            return [by_id[_required_id(activity)] for activity in activities]

    def list_activities_page(
        self,
        *,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        kind: str | None = None,
        account_id: int | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ActivityPage:
        if not 1 <= limit <= 500:
            raise ValidationError("Limit must be between 1 and 500.")
        if offset < 0:
            raise ValidationError("Offset cannot be negative.")
        filters = ActivityFilters(
            month=month,
            year=year,
            category=category,
            kind=parse_activity_kind(kind) if kind else None,
            account_id=account_id,
            search=search.strip() if search else None,
        )
        with database_transaction(self.db_path) as connection:
            repository = ActivityRepository(connection)
            selected = repository.list(filters, limit=limit, offset=offset)
            records = {
                _required_id(record.activity): record for record in _calculate_records(connection)
            }
            return ActivityPage(
                activities=[records[_required_id(activity)] for activity in selected],
                total=repository.count_filtered(filters),
                limit=limit,
                offset=offset,
            )

    def activity_exists(self, activity: Activity) -> bool:
        with database_transaction(self.db_path) as connection:
            return ActivityRepository(connection).exists_matching(activity)

    def project_activity(self, activity: Activity) -> ActivityRecord:
        """Calculate an unsaved activity's account effects at its ordered position."""
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection)
            effects: list[PostingEffect] = []
            for posting in activity.postings:
                account = accounts.get(posting.account_id)
                before = calculate_account_balance(connection, posting.account_id, activity.date)
                after = (
                    posting.amount
                    if posting.posting_kind is PostingKind.SET_BALANCE
                    else before + posting.amount
                ).quantize(Decimal("0.01"))
                effects.append(
                    PostingEffect(
                        account_id=posting.account_id,
                        account_name=account.name,
                        account_type=account.type,
                        account_subtype=account.subtype,
                        role=posting.role,
                        before_balance=before,
                        after_balance=after,
                        balance_effect=(after - before).quantize(Decimal("0.01")),
                    )
                )
            return ActivityRecord(activity, tuple(effects))

    def add_activity_if_new(self, activity: Activity) -> ActivityRecord | None:
        with database_transaction(self.db_path) as connection:
            repository = ActivityRepository(connection)
            if repository.exists_matching(activity):
                return None
            stored = repository.add(activity)
            return _record_by_id(connection, _required_id(stored))

    def prepare_activity(self, activity: Activity) -> Activity:
        if activity.kind not in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
            return activity
        with database_transaction(self.db_path) as connection:
            category = CategoryRuleRepository(connection).resolve_category(activity.category or "")
            if category == activity.category:
                return activity
            return Activity(
                kind=activity.kind,
                amount=activity.amount,
                category=category,
                description=activity.description,
                date=activity.date,
                postings=activity.postings,
                id=activity.id,
                created_at=activity.created_at,
                updated_at=activity.updated_at,
            )

    def count_activities(self) -> int:
        with database_transaction(self.db_path) as connection:
            return ActivityRepository(connection).count_filtered()


def calculate_account_balance(
    connection: sqlite3.Connection, account_id: int, as_of: date
) -> Decimal:
    balance = Decimal("0.00")
    for activity in ActivityRepository(connection).list_for_account(
        account_id, through=as_of, descending=False
    ):
        posting = next(item for item in activity.postings if item.account_id == account_id)
        if posting.posting_kind is PostingKind.SET_BALANCE:
            balance = posting.amount
        else:
            balance += posting.amount
        balance = balance.quantize(Decimal("0.01"))
    return balance


def _calculate_records(connection: sqlite3.Connection) -> list[ActivityRecord]:
    accounts = {
        _required_account_id(account): account
        for account in AccountRepository(connection).list_all(include_archived=True)
    }
    balances: dict[int, Decimal] = {}
    records: list[ActivityRecord] = []
    for activity in ActivityRepository(connection).list(descending=False):
        effects: list[PostingEffect] = []
        for posting in activity.postings:
            account = accounts[posting.account_id]
            before = balances.get(posting.account_id, Decimal("0.00"))
            after = (
                posting.amount
                if posting.posting_kind is PostingKind.SET_BALANCE
                else before + posting.amount
            ).quantize(Decimal("0.01"))
            balances[posting.account_id] = after
            effects.append(
                PostingEffect(
                    account_id=posting.account_id,
                    account_name=account.name,
                    account_type=account.type,
                    account_subtype=account.subtype,
                    role=posting.role,
                    before_balance=before,
                    after_balance=after,
                    balance_effect=(after - before).quantize(Decimal("0.01")),
                )
            )
        records.append(ActivityRecord(activity=activity, effects=tuple(effects)))
    return records


def _record_by_id(connection: sqlite3.Connection, activity_id: int) -> ActivityRecord:
    for record in _calculate_records(connection):
        if record.activity.id == activity_id:
            return record
    raise AssertionError(f"Stored activity {activity_id} was not found during calculation.")


def _required_id(activity: Activity) -> int:
    assert activity.id is not None
    return activity.id


def _required_account_id(account: Account) -> int:
    assert account.id is not None
    return account.id


def _require_active(account: Account) -> None:
    if not account.active:
        raise ValidationError("Archived accounts cannot be changed.")
