"""Financial activity and posting domain models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date as Date
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import AccountSubtype, AccountType, parse_balance
from finance_tracker.models.common import (
    parse_amount,
    parse_date,
    validate_month,
    validate_text,
    validate_year,
)


class ActivityKind(StrEnum):
    OPENING = "opening"
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"


class PostingKind(StrEnum):
    DELTA = "delta"
    SET_BALANCE = "set_balance"


class PostingRole(StrEnum):
    ACCOUNT = "account"
    SOURCE = "source"
    DESTINATION = "destination"


def parse_activity_kind(value: str | ActivityKind) -> ActivityKind:
    try:
        return value if isinstance(value, ActivityKind) else ActivityKind(value.lower())
    except ValueError as exc:
        raise ValidationError(
            "Activity kind must be opening, income, expense, transfer, or adjustment."
        ) from exc


@dataclass(frozen=True)
class Posting:
    account_id: int
    posting_kind: PostingKind
    role: PostingRole
    amount: Decimal
    id: int | None = None
    activity_id: int | None = None


@dataclass(frozen=True)
class Activity:
    kind: ActivityKind
    amount: Decimal
    category: str | None
    description: str
    date: Date
    postings: tuple[Posting, ...]
    id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def income_or_expense(
        cls,
        kind: str | ActivityKind,
        amount: str | int | float | Decimal,
        category: str,
        description: str,
        activity_date: str | Date,
        account_id: int,
        account_type: AccountType,
    ) -> Activity:
        resolved_kind = parse_activity_kind(kind)
        if resolved_kind not in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
            raise ValidationError("This activity must be income or expense.")
        resolved_amount = parse_amount(amount)
        net_worth_delta = (
            resolved_amount if resolved_kind is ActivityKind.INCOME else -resolved_amount
        )
        account_sign = Decimal("1") if account_type is AccountType.ASSET else Decimal("-1")
        return cls(
            kind=resolved_kind,
            amount=resolved_amount,
            category=validate_text(category, "category"),
            description=(description or "").strip(),
            date=parse_date(activity_date),
            postings=(
                Posting(
                    account_id=account_id,
                    posting_kind=PostingKind.DELTA,
                    role=PostingRole.ACCOUNT,
                    amount=(net_worth_delta / account_sign).quantize(Decimal("0.01")),
                ),
            ),
        )

    @classmethod
    def transfer(
        cls,
        amount: str | int | float | Decimal,
        description: str,
        activity_date: str | Date,
        from_account_id: int,
        from_account_type: AccountType,
        to_account_id: int,
        to_account_type: AccountType,
    ) -> Activity:
        if from_account_id == to_account_id:
            raise ValidationError("Transfer accounts must be different.")
        resolved_amount = parse_amount(amount)
        source_sign = Decimal("1") if from_account_type is AccountType.ASSET else Decimal("-1")
        destination_sign = Decimal("1") if to_account_type is AccountType.ASSET else Decimal("-1")
        return cls(
            kind=ActivityKind.TRANSFER,
            amount=resolved_amount,
            category=None,
            description=(description or "").strip(),
            date=parse_date(activity_date),
            postings=(
                Posting(
                    account_id=from_account_id,
                    posting_kind=PostingKind.DELTA,
                    role=PostingRole.SOURCE,
                    amount=(-resolved_amount / source_sign).quantize(Decimal("0.01")),
                ),
                Posting(
                    account_id=to_account_id,
                    posting_kind=PostingKind.DELTA,
                    role=PostingRole.DESTINATION,
                    amount=(resolved_amount / destination_sign).quantize(Decimal("0.01")),
                ),
            ),
        )

    @classmethod
    def set_balance(
        cls,
        kind: ActivityKind,
        observed_balance: str | int | float | Decimal,
        description: str,
        activity_date: str | Date,
        account_id: int,
    ) -> Activity:
        if kind not in {ActivityKind.OPENING, ActivityKind.ADJUSTMENT}:
            raise ValidationError("Only openings and adjustments can set a balance.")
        balance = parse_balance(observed_balance)
        return cls(
            kind=kind,
            amount=balance,
            category=None,
            description=(description or "").strip(),
            date=parse_date(activity_date),
            postings=(
                Posting(
                    account_id=account_id,
                    posting_kind=PostingKind.SET_BALANCE,
                    role=PostingRole.ACCOUNT,
                    amount=balance,
                ),
            ),
        )

    def posting(self, role: PostingRole) -> Posting | None:
        return next((posting for posting in self.postings if posting.role is role), None)


@dataclass(frozen=True)
class PostingEffect:
    account_id: int
    account_name: str
    account_type: AccountType
    account_subtype: AccountSubtype
    role: PostingRole
    before_balance: Decimal
    after_balance: Decimal
    balance_effect: Decimal


@dataclass(frozen=True)
class ActivityRecord:
    activity: Activity
    effects: tuple[PostingEffect, ...]

    def effect(self, role: PostingRole) -> PostingEffect | None:
        return next((effect for effect in self.effects if effect.role is role), None)


@dataclass(frozen=True)
class ActivityFilters:
    month: int | None = None
    year: int | None = None
    category: str | None = None
    kind: ActivityKind | None = None
    account_id: int | None = None
    search: str | None = None

    def __post_init__(self) -> None:
        if self.month is not None:
            validate_month(self.month)
        if self.year is not None:
            validate_year(self.year)
