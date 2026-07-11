"""Deterministic monthly financial report calculations."""

from decimal import Decimal

from finance_tracker.models.transactions import Transaction, TransactionType
from finance_tracker.reports.models import MonthlyReport


def build_monthly_report(
    transactions: list[Transaction],
    month: int,
    year: int,
    context_transactions: list[Transaction] | None = None,
) -> MonthlyReport:
    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")
    income_by_category: dict[str, Decimal] = {}
    expenses_by_category: dict[str, Decimal] = {}

    for transaction in transactions:
        if transaction.type == TransactionType.INCOME:
            total_income += transaction.amount
            income_by_category[transaction.category] = (
                income_by_category.get(transaction.category, Decimal("0.00")) + transaction.amount
            )
        else:
            total_expenses += transaction.amount
            expenses_by_category[transaction.category] = (
                expenses_by_category.get(transaction.category, Decimal("0.00")) + transaction.amount
            )

    context = context_transactions if context_transactions is not None else transactions
    previous_year, previous_month = _previous_month(year=year, month=month)
    previous_report = _totals_for_period(context, month=previous_month, year=previous_year)
    ytd_report = _totals_for_year_to_month(context, month=month, year=year)

    return MonthlyReport(
        month=month,
        year=year,
        total_income=total_income,
        total_expenses=total_expenses,
        net_savings=total_income - total_expenses,
        transaction_count=len(transactions),
        income_by_category=dict(sorted(income_by_category.items())),
        expenses_by_category=dict(sorted(expenses_by_category.items())),
        ytd_income=ytd_report["income"],
        ytd_expenses=ytd_report["expenses"],
        ytd_net_savings=ytd_report["income"] - ytd_report["expenses"],
        income_delta=total_income - previous_report["income"],
        expenses_delta=total_expenses - previous_report["expenses"],
        net_savings_delta=(total_income - total_expenses)
        - (previous_report["income"] - previous_report["expenses"]),
    )


def calculate_savings_rate(total_income: Decimal, net_savings: Decimal) -> Decimal:
    """Return net savings as a percentage of income."""

    if total_income <= 0:
        return Decimal("0.0")
    return (net_savings / total_income * Decimal("100")).quantize(Decimal("0.1"))


def _previous_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _totals_for_period(
    transactions: list[Transaction],
    month: int,
    year: int,
) -> dict[str, Decimal]:
    income = Decimal("0.00")
    expenses = Decimal("0.00")
    for transaction in transactions:
        if transaction.date.month != month or transaction.date.year != year:
            continue
        if transaction.type == TransactionType.INCOME:
            income += transaction.amount
        else:
            expenses += transaction.amount
    return {"income": income, "expenses": expenses}


def _totals_for_year_to_month(
    transactions: list[Transaction],
    month: int,
    year: int,
) -> dict[str, Decimal]:
    income = Decimal("0.00")
    expenses = Decimal("0.00")
    for transaction in transactions:
        if transaction.date.year != year or transaction.date.month > month:
            continue
        if transaction.type == TransactionType.INCOME:
            income += transaction.amount
        else:
            expenses += transaction.amount
    return {"income": income, "expenses": expenses}
