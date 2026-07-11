"""Deterministic text formatting for financial reports."""

from decimal import Decimal

from finance_tracker.reports.models import MonthlyReport, TrendReport

CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "TRY": "₺",
}


def format_money(value: Decimal, currency_code: str = "USD") -> str:
    symbol = CURRENCY_SYMBOLS.get(currency_code.upper(), f"{currency_code.upper()} ")
    return f"{symbol}{value:,.2f}"


def format_monthly_report(report: MonthlyReport, currency_code: str = "USD") -> str:
    lines = [
        f"Monthly report for {report.year}-{report.month:02d}",
        "",
        f"Income:       {format_money(report.total_income, currency_code)}",
        f"Expenses:     {format_money(report.total_expenses, currency_code)}",
        f"Net savings:  {format_money(report.net_savings, currency_code)}",
        f"Transactions: {report.transaction_count}",
        "",
        f"YTD income:    {format_money(report.ytd_income, currency_code)}",
        f"YTD expenses:  {format_money(report.ytd_expenses, currency_code)}",
        f"YTD net:       {format_money(report.ytd_net_savings, currency_code)}",
        f"MoM income:    {_format_delta(report.income_delta, currency_code)}",
        f"MoM expenses:  {_format_delta(report.expenses_delta, currency_code)}",
        f"MoM net:       {_format_delta(report.net_savings_delta, currency_code)}",
    ]

    if report.income_by_category:
        lines.extend(["", "Income by category:"])
        lines.extend(
            f"  - {category}: {format_money(amount, currency_code)}"
            for category, amount in report.income_by_category.items()
        )

    if report.expenses_by_category:
        lines.extend(["", "Expenses by category:"])
        lines.extend(
            f"  - {category}: {format_money(amount, currency_code)}"
            for category, amount in report.expenses_by_category.items()
        )

    return "\n".join(lines)


def format_trend_report(report: TrendReport, currency_code: str = "USD") -> str:
    if not report.months:
        return "No trend periods found."

    start = report.months[0]
    end = report.months[-1]
    rows = [
        [
            f"{period.year}-{period.month:02d}",
            format_money(period.total_income, currency_code),
            format_money(period.total_expenses, currency_code),
            format_money(period.net_savings, currency_code),
            _format_delta(period.net_savings_delta, currency_code),
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
            f"Total income:       {format_money(report.total_income, currency_code)}",
            f"Total expenses:     {format_money(report.total_expenses, currency_code)}",
            f"Total net savings:  {format_money(report.net_savings, currency_code)}",
            f"Transactions:       {report.transaction_count}",
        ]
    )

    if report.top_expense_categories:
        lines.extend(["", "Top expense categories:"])
        lines.extend(
            f"  - {category}: {format_money(amount, currency_code)}"
            for category, amount in report.top_expense_categories.items()
        )

    return "\n".join(lines)


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


def _format_delta(value: Decimal, currency_code: str = "USD") -> str:
    sign = "+" if value >= 0 else "-"
    return f"{sign}{format_money(abs(value), currency_code)}"
