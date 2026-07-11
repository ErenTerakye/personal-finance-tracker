"""Immutable report value models."""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class MonthlyReport:
    month: int
    year: int
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    income_by_category: dict[str, Decimal] = field(default_factory=dict)
    expenses_by_category: dict[str, Decimal] = field(default_factory=dict)
    ytd_income: Decimal = Decimal("0.00")
    ytd_expenses: Decimal = Decimal("0.00")
    ytd_net_savings: Decimal = Decimal("0.00")
    income_delta: Decimal = Decimal("0.00")
    expenses_delta: Decimal = Decimal("0.00")
    net_savings_delta: Decimal = Decimal("0.00")


@dataclass(frozen=True)
class TrendMonth:
    month: int
    year: int
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    savings_rate: Decimal
    income_delta: Decimal = Decimal("0.00")
    expenses_delta: Decimal = Decimal("0.00")
    net_savings_delta: Decimal = Decimal("0.00")


@dataclass(frozen=True)
class TrendReport:
    months: list[TrendMonth]
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    top_expense_categories: dict[str, Decimal] = field(default_factory=dict)
