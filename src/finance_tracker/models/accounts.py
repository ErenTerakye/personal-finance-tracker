"""Account domain models for the schema-v3 activity ledger."""

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


class AccountSubtype(StrEnum):
    CASH = "cash"
    INVESTMENT = "investment"
    PROPERTY = "property"
    CREDIT_CARD = "credit_card"
    LOAN = "loan"
    OTHER = "other"


class BalanceState(StrEnum):
    NORMAL = "normal"
    OVERDRAWN = "overdrawn"
    CREDIT_BALANCE = "credit_balance"


_COMPATIBLE_SUBTYPES = {
    AccountType.ASSET: {
        AccountSubtype.CASH,
        AccountSubtype.INVESTMENT,
        AccountSubtype.PROPERTY,
        AccountSubtype.OTHER,
    },
    AccountType.LIABILITY: {
        AccountSubtype.CREDIT_CARD,
        AccountSubtype.LOAN,
        AccountSubtype.OTHER,
    },
}


def parse_account_type(value: str | AccountType) -> AccountType:
    if isinstance(value, AccountType):
        return value
    try:
        return AccountType(value.lower())
    except ValueError as exc:
        raise ValidationError("Account type must be asset or liability.") from exc


def parse_account_subtype(
    value: str | AccountSubtype, account_type: str | AccountType
) -> AccountSubtype:
    resolved_type = parse_account_type(account_type)
    try:
        subtype = value if isinstance(value, AccountSubtype) else AccountSubtype(value.lower())
    except ValueError as exc:
        raise ValidationError("Account subtype is not recognized.") from exc
    if subtype not in _COMPATIBLE_SUBTYPES[resolved_type]:
        raise ValidationError(
            f"Account subtype '{subtype.value}' is not compatible with {resolved_type.value}."
        )
    return subtype


def parse_balance(value: str | int | float | Decimal) -> Decimal:
    """Parse an observed balance; calculated balances may also be negative."""
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError("Balance must be a valid number.") from exc
    return validate_money_range(amount, "Balance")


def parse_balance_date(value: str | date) -> date:
    parsed = parse_date(value)
    if parsed > date.today():
        raise ValidationError("Balance date cannot be in the future.")
    return parsed


# Compatibility name used by a few adapters while the public wording is "balance date".
parse_snapshot_date = parse_balance_date


@dataclass(frozen=True)
class Account:
    name: str
    type: AccountType
    subtype: AccountSubtype
    id: int | None = None
    archived_on: date | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        name: str,
        account_type: str | AccountType,
        subtype: str | AccountSubtype = AccountSubtype.OTHER,
    ) -> Account:
        resolved_type = parse_account_type(account_type)
        return cls(
            name=validate_text(name, "account name"),
            type=resolved_type,
            subtype=parse_account_subtype(subtype, resolved_type),
        )

    @property
    def active(self) -> bool:
        return self.archived_on is None

    @property
    def net_worth_sign(self) -> Decimal:
        return Decimal("1") if self.type is AccountType.ASSET else Decimal("-1")


@dataclass(frozen=True)
class ResolvedAccount:
    account: Account
    as_of: date
    balance: Decimal
    balance_state: BalanceState
    opening_balance: Decimal
    opening_date: date
    opening_activity_id: int

    @property
    def balance_date(self) -> date:
        """Compatibility alias; the balance is calculated through ``as_of``."""
        return self.as_of


def balance_state(account_type: AccountType, balance: Decimal) -> BalanceState:
    if balance >= 0:
        return BalanceState.NORMAL
    if account_type is AccountType.ASSET:
        return BalanceState.OVERDRAWN
    return BalanceState.CREDIT_BALANCE
