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


def format_money(value: Decimal) -> str:
    return f"${value:,.2f}"


def _format_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    widths = [
        max(len(header), *(len(row[index]) for row in rows))
        for index, header in enumerate(headers)
    ]

    def format_cell(index: int, value: str) -> str:
        if index == len(headers) - 1:
            return value
        return value.ljust(widths[index])

    lines = [
        "  ".join(format_cell(index, header) for index, header in enumerate(headers)),
        "  ".join("-" * width for width in widths),
    ]
    lines.extend(
        "  ".join(format_cell(index, value) for index, value in enumerate(row))
        for row in rows
    )
    return lines


def format_monthly_report(report: MonthlyReport) -> str:
    lines = [
        f"Monthly report for {report.year}-{report.month:02d}",
        "",
        f"Income:       {format_money(report.total_income)}",
        f"Expenses:     {format_money(report.total_expenses)}",
        f"Net savings:  {format_money(report.net_savings)}",
        f"Transactions: {report.transaction_count}",
        "",
        f"YTD income:    {format_money(report.ytd_income)}",
        f"YTD expenses:  {format_money(report.ytd_expenses)}",
        f"YTD net:       {format_money(report.ytd_net_savings)}",
        f"MoM income:    {_format_delta(report.income_delta)}",
        f"MoM expenses:  {_format_delta(report.expenses_delta)}",
        f"MoM net:       {_format_delta(report.net_savings_delta)}",
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
    rows = [
        [
            f"{period.year}-{period.month:02d}",
            format_money(period.total_income),
            format_money(period.total_expenses),
            format_money(period.net_savings),
            _format_delta(period.net_savings_delta),
            f"{period.savings_rate:.1f}%",
            str(period.transaction_count),
        ]
        for period in report.months
    ]
    lines = [
        f"Trend report for {start.year}-{start.month:02d} through {end.year}-{end.month:02d}",
        "",
    ]
    headers = ["Month", "Income", "Expenses", "Net savings", "MoM net", "Savings", "Transactions"]
    lines.extend(_format_table(headers, rows))

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


def _build_trend_month(
    transactions: list[Transaction],
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
        savings_rate=_savings_rate(monthly_report.total_income, monthly_report.net_savings),
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


def _savings_rate(total_income: Decimal, net_savings: Decimal) -> Decimal:
    if total_income <= 0:
        return Decimal("0.0")
    return (net_savings / total_income * Decimal("100")).quantize(Decimal("0.1"))


def _format_delta(value: Decimal) -> str:
    sign = "+" if value >= 0 else "-"
    return f"{sign}{format_money(abs(value))}"


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
