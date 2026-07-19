"""Recurring income, expense, and transfer templates."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.activities import ActivityKind, parse_activity_kind
from finance_tracker.models.common import parse_amount, validate_day_of_month, validate_text


@dataclass(frozen=True)
class RecurringTemplate:
    kind: ActivityKind
    amount: Decimal
    category: str | None
    description: str
    day_of_month: int
    account_id: int | None = None
    from_account_id: int | None = None
    to_account_id: int | None = None
    active: bool = True
    id: int | None = None
    created_at: datetime | None = None

    @classmethod
    def create(
        cls,
        kind: str,
        amount: str | int | float | Decimal,
        category: str | None,
        description: str,
        day_of_month: int,
        *,
        account_id: int | None = None,
        from_account_id: int | None = None,
        to_account_id: int | None = None,
        active: bool = True,
    ) -> RecurringTemplate:
        resolved_kind = parse_activity_kind(kind)
        if resolved_kind not in {
            ActivityKind.INCOME,
            ActivityKind.EXPENSE,
            ActivityKind.TRANSFER,
        }:
            raise ValidationError("Only income, expense, and transfer can recur.")
        if resolved_kind is ActivityKind.TRANSFER:
            if from_account_id is None or to_account_id is None:
                raise ValidationError(
                    "Recurring transfer requires source and destination accounts."
                )
            if from_account_id == to_account_id:
                raise ValidationError("Transfer accounts must be different.")
            clean_category = None
        else:
            if account_id is None:
                raise ValidationError("Recurring income and expense require an account.")
            clean_category = validate_text(category or "", "category")
        return cls(
            kind=resolved_kind,
            amount=parse_amount(amount),
            category=clean_category,
            description=(description or "").strip(),
            day_of_month=validate_day_of_month(day_of_month),
            account_id=account_id if resolved_kind is not ActivityKind.TRANSFER else None,
            from_account_id=from_account_id if resolved_kind is ActivityKind.TRANSFER else None,
            to_account_id=to_account_id if resolved_kind is ActivityKind.TRANSFER else None,
            active=bool(active),
        )

    @property
    def type(self) -> ActivityKind:
        """Compatibility alias for terminal rendering."""
        return self.kind
