"""Budget domain models and validation."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from finance_tracker.models.common import parse_amount, validate_month, validate_text, validate_year


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
class BudgetFilters:
    month: int | None = None
    year: int | None = None
    category: str | None = None

    def __post_init__(self) -> None:
        if self.month is not None:
            validate_month(self.month)
        if self.year is not None:
            validate_year(self.year)
