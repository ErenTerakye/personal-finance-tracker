"""Deterministic multi-month financial trend calculations."""

from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.activities import ActivityKind
from finance_tracker.models.common import validate_month, validate_year
from finance_tracker.reports.models import TrendMonth, TrendReport
from finance_tracker.reports.monthly import (
    CashflowEntry,
    _cashflow_kind,
    build_monthly_report,
    calculate_savings_rate,
)


def build_trend_report(
    transactions: Sequence[CashflowEntry],
    months: int,
    end_month: int,
    end_year: int,
    top_category_count: int = 5,
) -> TrendReport:
    if months < 1:
        raise ValidationError("Months must be a positive integer.")

    periods = _month_window(months=months, end_month=end_month, end_year=end_year)
    transactions_by_period: dict[tuple[int, int], list[CashflowEntry]] = {
        (year, month): [] for year, month in periods
    }

    for transaction in transactions:
        period = (transaction.date.year, transaction.date.month)
        if period in transactions_by_period:
            transactions_by_period[period].append(transaction)

    trend_months: list[TrendMonth] = []
    previous_totals: dict[str, Decimal] | None = None
    for year, month in periods:
        trend_month = _build_trend_month(
            transactions=transactions_by_period[(year, month)],
            month=month,
            year=year,
            previous_totals=previous_totals,
        )
        trend_months.append(trend_month)
        previous_totals = {
            "income": trend_month.total_income,
            "expenses": trend_month.total_expenses,
            "net": trend_month.net_savings,
        }

    total_income = sum((period.total_income for period in trend_months), Decimal("0.00"))
    total_expenses = sum((period.total_expenses for period in trend_months), Decimal("0.00"))
    transaction_count = sum(period.transaction_count for period in trend_months)
    top_expense_categories = _top_expense_categories(
        transactions=transactions,
        periods=set(periods),
        limit=top_category_count,
    )

    return TrendReport(
        months=trend_months,
        total_income=total_income,
        total_expenses=total_expenses,
        net_savings=total_income - total_expenses,
        transaction_count=transaction_count,
        top_expense_categories=top_expense_categories,
    )


def _build_trend_month(
    transactions: Sequence[CashflowEntry],
    month: int,
    year: int,
    previous_totals: dict[str, Decimal] | None = None,
) -> TrendMonth:
    monthly_report = build_monthly_report(transactions, month=month, year=year)
    previous_totals = previous_totals or {
        "income": Decimal("0.00"),
        "expenses": Decimal("0.00"),
        "net": Decimal("0.00"),
    }
    return TrendMonth(
        month=month,
        year=year,
        total_income=monthly_report.total_income,
        total_expenses=monthly_report.total_expenses,
        net_savings=monthly_report.net_savings,
        transaction_count=monthly_report.transaction_count,
        savings_rate=calculate_savings_rate(
            monthly_report.total_income,
            monthly_report.net_savings,
        ),
        income_delta=monthly_report.total_income - previous_totals["income"],
        expenses_delta=monthly_report.total_expenses - previous_totals["expenses"],
        net_savings_delta=monthly_report.net_savings - previous_totals["net"],
    )


def _month_window(months: int, end_month: int, end_year: int) -> list[tuple[int, int]]:
    validate_month(end_month)
    validate_year(end_year)
    end = date(end_year, end_month, 1)
    periods: list[tuple[int, int]] = []

    year = end.year
    month = end.month
    for _ in range(months):
        periods.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1

    return list(reversed(periods))


def _top_expense_categories(
    transactions: Sequence[CashflowEntry],
    periods: set[tuple[int, int]],
    limit: int,
) -> dict[str, Decimal]:
    expenses_by_category: dict[str, Decimal] = {}
    category_names: dict[str, str] = {}

    for transaction in transactions:
        period = (transaction.date.year, transaction.date.month)
        if _cashflow_kind(transaction) is not ActivityKind.EXPENSE or period not in periods:
            continue

        assert transaction.category is not None
        category_key = transaction.category.lower()
        if category_key not in category_names or (
            category_names[category_key].islower() and not transaction.category.islower()
        ):
            category_names[category_key] = transaction.category
        expenses_by_category[category_key] = (
            expenses_by_category.get(category_key, Decimal("0.00")) + transaction.amount
        )

    sorted_expenses = sorted(
        expenses_by_category.items(),
        key=lambda item: (-item[1], category_names[item[0]].lower()),
    )
    return {
        category_names[category_key]: amount for category_key, amount in sorted_expenses[:limit]
    }
