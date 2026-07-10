"""Recurring template domain model and validation."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from finance_tracker.models.common import parse_amount, validate_day_of_month, validate_text
from finance_tracker.models.transactions import TransactionType, parse_transaction_type


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
