"""Transaction domain models and validation."""

from dataclasses import dataclass
from datetime import date as Date
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.common import (
    parse_amount,
    parse_date,
    validate_month,
    validate_text,
    validate_year,
)


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


@dataclass(frozen=True)
class Transaction:
    type: TransactionType
    amount: Decimal
    category: str
    description: str
    date: Date
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        transaction_type: str,
        amount: str | int | float | Decimal,
        category: str,
        description: str,
        transaction_date: str | Date,
    ) -> Transaction:
        return cls(
            type=parse_transaction_type(transaction_type),
            amount=parse_amount(amount),
            category=validate_text(category, "category"),
            description=(description or "").strip(),
            date=parse_date(transaction_date),
        )


@dataclass(frozen=True)
class TransactionFilters:
    month: int | None = None
    year: int | None = None
    category: str | None = None
    transaction_type: TransactionType | None = None

    def __post_init__(self) -> None:
        if self.month is not None:
            validate_month(self.month)
        if self.year is not None:
            validate_year(self.year)


def parse_transaction_type(value: str | TransactionType) -> TransactionType:
    try:
        return value if isinstance(value, TransactionType) else TransactionType(value.lower())
    except ValueError as exc:
        raise ValidationError("Transaction type must be 'income' or 'expense'.") from exc
