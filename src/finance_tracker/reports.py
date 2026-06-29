"""Monthly report calculations."""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from finance_tracker.exceptions import ValidationError
from finance_tracker.models import Transaction, TransactionType, validate_month, validate_year


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


@dataclass(frozen=True)
class TrendMonth:
    month: int
    year: int
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    savings_rate: Decimal


@dataclass(frozen=True)
class TrendReport:
    months: list[TrendMonth]
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    top_expense_categories: dict[str, Decimal] = field(default_factory=dict)


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


def build_trend_report(
    transactions: list[Transaction],
    months: int,
    end_month: int,
    end_year: int,
    top_category_count: int = 5,
) -> TrendReport:
    if months < 1:
        raise ValidationError("Months must be a positive integer.")

    periods = _month_window(months=months, end_month=end_month, end_year=end_year)
    transactions_by_period: dict[tuple[int, int], list[Transaction]] = {
        (year, month): [] for year, month in periods
    }

    for transaction in transactions:
        period = (transaction.date.year, transaction.date.month)
        if period in transactions_by_period:
            transactions_by_period[period].append(transaction)

    trend_months = [
        _build_trend_month(
            transactions=transactions_by_period[(year, month)],
            month=month,
            year=year,
        )
        for year, month in periods
    ]

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


def format_trend_report(report: TrendReport) -> str:
    if not report.months:
        return "No trend periods found."

    start = report.months[0]
    end = report.months[-1]
    lines = [
        f"Trend report for {start.year}-{start.month:02d} through {end.year}-{end.month:02d}",
        "",
        "Month    Income      Expenses    Net savings  Savings  Transactions",
        "-------  ----------  ----------  -----------  -------  ------------",
    ]

    for period in report.months:
        lines.append(
            f"{period.year}-{period.month:02d}  {format_money(period.total_income):<10}  "
            f"{format_money(period.total_expenses):<10}  "
            f"{format_money(period.net_savings):<11}  "
            f"{period.savings_rate:.1f}%".ljust(7)
            + f"  {period.transaction_count}"
        )

    lines.extend(
        [
            "",
            f"Total income:       {format_money(report.total_income)}",
            f"Total expenses:     {format_money(report.total_expenses)}",
            f"Total net savings:  {format_money(report.net_savings)}",
            f"Transactions:       {report.transaction_count}",
        ]
    )

    if report.top_expense_categories:
        lines.extend(["", "Top expense categories:"])
        lines.extend(
            f"  - {category}: {format_money(amount)}"
            for category, amount in report.top_expense_categories.items()
        )

    return "\n".join(lines)


def _build_trend_month(transactions: list[Transaction], month: int, year: int) -> TrendMonth:
    monthly_report = build_monthly_report(transactions, month=month, year=year)
    return TrendMonth(
        month=month,
        year=year,
        total_income=monthly_report.total_income,
        total_expenses=monthly_report.total_expenses,
        net_savings=monthly_report.net_savings,
        transaction_count=monthly_report.transaction_count,
        savings_rate=_savings_rate(monthly_report.total_income, monthly_report.net_savings),
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


def _savings_rate(total_income: Decimal, net_savings: Decimal) -> Decimal:
    if total_income <= 0:
        return Decimal("0.0")
    return (net_savings / total_income * Decimal("100")).quantize(Decimal("0.1"))


def _top_expense_categories(
    transactions: list[Transaction],
    periods: set[tuple[int, int]],
    limit: int,
) -> dict[str, Decimal]:
    expenses_by_category: dict[str, Decimal] = {}
    category_names: dict[str, str] = {}

    for transaction in transactions:
        period = (transaction.date.year, transaction.date.month)
        if transaction.type != TransactionType.EXPENSE or period not in periods:
            continue

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
        category_names[category_key]: amount
        for category_key, amount in sorted_expenses[:limit]
    }
