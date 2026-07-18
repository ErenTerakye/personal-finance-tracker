"""Account and balance snapshot domain models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.common import parse_date, validate_money_range, validate_text


class AccountType(StrEnum):
    ASSET = "asset"
    LIABILITY = "liability"


def parse_account_type(value: str | AccountType) -> AccountType:
    if isinstance(value, AccountType):
        return value
    try:
        return AccountType(value)
    except ValueError as exc:
        raise ValidationError("Account type must be asset or liability.") from exc


def parse_balance(value: str | int | float | Decimal) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError("Balance must be a valid number.") from exc
    if amount < 0:
        raise ValidationError("Balance must be zero or greater.")
    return validate_money_range(amount, "Balance")


def parse_snapshot_date(value: str | date) -> date:
    parsed = parse_date(value)
    if parsed > date.today():
        raise ValidationError("Balance date cannot be in the future.")
    return parsed


@dataclass(frozen=True)
class Account:
    name: str
    type: AccountType
    id: int | None = None
    archived_on: date | None = None
    created_at: datetime | None = None

    @classmethod
    def create(cls, name: str, account_type: str | AccountType) -> Account:
        return cls(
            name=validate_text(name, "account name"),
            type=parse_account_type(account_type),
        )

    @property
    def active(self) -> bool:
        return self.archived_on is None


@dataclass(frozen=True)
class BalanceSnapshot:
    account_id: int
    amount: Decimal
    effective_date: date
    id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def create(
        cls,
        account_id: int,
        amount: str | int | float | Decimal,
        effective_date: str | date,
    ) -> BalanceSnapshot:
        return cls(
            account_id=account_id,
            amount=parse_balance(amount),
            effective_date=parse_snapshot_date(effective_date),
        )


@dataclass(frozen=True)
class ResolvedAccount:
    account: Account
    as_of: date
    balance: Decimal | None
    balance_date: date | None
