"""Monthly report calculations."""

from dataclasses import dataclass, field
from decimal import Decimal

from finance_tracker.models import Transaction, TransactionType


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


def build_monthly_report(transactions: list[Transaction], month: int, year: int) -> MonthlyReport:
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

    return MonthlyReport(
        month=month,
        year=year,
        total_income=total_income,
        total_expenses=total_expenses,
        net_savings=total_income - total_expenses,
        transaction_count=len(transactions),
        income_by_category=dict(sorted(income_by_category.items())),
        expenses_by_category=dict(sorted(expenses_by_category.items())),
    )


def format_money(value: Decimal) -> str:
    return f"${value:,.2f}"


def format_monthly_report(report: MonthlyReport) -> str:
    lines = [
        f"Monthly report for {report.year}-{report.month:02d}",
        "",
        f"Income:       {format_money(report.total_income)}",
        f"Expenses:     {format_money(report.total_expenses)}",
        f"Net savings:  {format_money(report.net_savings)}",
        f"Transactions: {report.transaction_count}",
    ]

    if report.income_by_category:
        lines.extend(["", "Income by category:"])
        lines.extend(
            f"  - {category}: {format_money(amount)}"
            for category, amount in report.income_by_category.items()
        )

    if report.expenses_by_category:
        lines.extend(["", "Expenses by category:"])
        lines.extend(
            f"  - {category}: {format_money(amount)}"
            for category, amount in report.expenses_by_category.items()
        )

    return "\n".join(lines)
