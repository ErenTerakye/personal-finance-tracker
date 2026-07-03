"""Domain models for the finance tracker."""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from finance_tracker.exceptions import ValidationError


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


@dataclass(frozen=True)
class Transaction:
    type: TransactionType
    amount: Decimal
    category: str
    description: str
    date: date
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        transaction_type: str,
        amount: str | int | float | Decimal,
        category: str,
        description: str,
        transaction_date: str | date,
    ) -> Transaction:
        return cls(
            type=parse_transaction_type(transaction_type),
            amount=parse_amount(amount),
            category=validate_text(category, "category"),
            description=(description or "").strip(),
            date=parse_date(transaction_date),
        )


@dataclass(frozen=True)
class Budget:
    category: str
    month: int
    year: int
    amount: Decimal
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        category: str,
        amount: str | int | float | Decimal,
        month: int,
        year: int,
    ) -> Budget:
        return cls(
            category=validate_text(category, "category"),
            amount=parse_amount(amount),
            month=validate_month(month),
            year=validate_year(year),
        )


@dataclass(frozen=True)
class CategoryRule:
    alias: str
    category: str
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(cls, alias: str, category: str) -> CategoryRule:
        alias_text = validate_text(alias, "alias")
        category_text = validate_text(category, "category")
        if alias_text.lower() == category_text.lower():
            raise ValidationError("Alias and category must be different.")
        return cls(alias=alias_text, category=category_text)


@dataclass(frozen=True)
class RecurringTemplate:
    type: TransactionType
    amount: Decimal
    category: str
    description: str
    day_of_month: int
    active: bool = True
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        transaction_type: str,
        amount: str | int | float | Decimal,
        category: str,
        description: str,
        day_of_month: int,
        active: bool = True,
    ) -> RecurringTemplate:
        return cls(
            type=parse_transaction_type(transaction_type),
            amount=parse_amount(amount),
            category=validate_text(category, "category"),
            description=(description or "").strip(),
            day_of_month=validate_day_of_month(day_of_month),
            active=bool(active),
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


@dataclass(frozen=True)
class BudgetFilters:
    month: int | None = None
    year: int | None = None
    category: str | None = None

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


def parse_amount(value: str | int | float | Decimal) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError("Amount must be a valid number.") from exc

    if amount <= 0:
        raise ValidationError("Amount must be greater than zero.")
    return amount


def validate_month(value: int) -> int:
    if not 1 <= value <= 12:
        raise ValidationError("Month must be between 1 and 12.")
    return value


def validate_year(value: int) -> int:
    if value < 1:
        raise ValidationError("Year must be a positive integer.")
    return value


def validate_day_of_month(value: int) -> int:
    if not 1 <= value <= 31:
        raise ValidationError("Day of month must be between 1 and 31.")
    return value


def parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError("Date must use YYYY-MM-DD format.") from exc


def validate_text(value: str, field_name: str) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"{field_name.capitalize()} is required.")
    return text
