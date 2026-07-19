"""Validation shared by domain models."""

from datetime import date as Date
from decimal import Decimal, InvalidOperation

from finance_tracker.exceptions import ValidationError

MAX_SAFE_MONEY = Decimal("90071992547409.91")


def validate_money_range(amount: Decimal, field_name: str) -> Decimal:
    """Keep cent values within JavaScript's exact safe-integer range."""
    if abs(amount) > MAX_SAFE_MONEY:
        raise ValidationError(f"{field_name} must be no greater than {MAX_SAFE_MONEY}.")
    return amount


def parse_amount(value: str | int | float | Decimal) -> Decimal:
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError("Amount must be a valid number.") from exc

    if amount <= 0:
        raise ValidationError("Amount must be greater than zero.")
    return validate_money_range(amount, "Amount")


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


def parse_date(value: str | Date) -> Date:
    if isinstance(value, Date):
        return value
    try:
        return Date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError("Date must use YYYY-MM-DD format.") from exc


def validate_text(value: str, field_name: str) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"{field_name.capitalize()} is required.")
    return text
