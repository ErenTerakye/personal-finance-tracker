"""Exact CSV and report text compatibility snapshots."""

from finance_tracker.csv_io import export_budgets_csv_text, export_transactions_csv_text
from finance_tracker.models import Budget, Transaction
from finance_tracker.reports import (
    build_monthly_report,
    build_trend_report,
    format_monthly_report,
    format_trend_report,
)


def _transaction(
    transaction_type: str,
    amount: str,
    category: str,
    description: str,
    transaction_date: str,
) -> Transaction:
    return Transaction.create(
        transaction_type,
        amount,
        category,
        description,
        transaction_date,
    )


def _report_transactions() -> list[Transaction]:
    return [
        _transaction("income", "2800", "Salary", "May salary", "2026-05-01"),
        _transaction("expense", "800", "Rent", "May rent", "2026-05-02"),
        _transaction("income", "3000", "Salary", "June salary", "2026-06-01"),
        _transaction("expense", "900", "Rent", "June rent", "2026-06-02"),
        _transaction("expense", "100", "Food", "June food", "2026-06-03"),
    ]


def test_transaction_csv_export_has_the_frozen_header_order_and_rows():
    transactions = _report_transactions()

    assert export_transactions_csv_text([transactions[2], transactions[4]]) == (
        "type,amount,category,description,date\r\n"
        "income,3000.00,Salary,June salary,2026-06-01\r\n"
        "expense,100.00,Food,June food,2026-06-03\r\n"
    )


def test_budget_csv_export_has_the_frozen_header_order_and_rows():
    budgets = [
        Budget.create("Food", "400", 6, 2026),
        Budget.create("Rent", "1200", 6, 2026),
    ]

    assert export_budgets_csv_text(budgets) == (
        "category,amount,month,year\r\n"
        "Food,400.00,6,2026\r\n"
        "Rent,1200.00,6,2026\r\n"
    )


def test_monthly_report_text_matches_the_frozen_snapshot():
    transactions = _report_transactions()
    report = build_monthly_report(
        transactions[2:],
        month=6,
        year=2026,
        context_transactions=transactions,
    )

    assert format_monthly_report(report) == """Monthly report for 2026-06

Income:       $3,000.00
Expenses:     $1,000.00
Net savings:  $2,000.00
Transactions: 3

YTD income:    $5,800.00
YTD expenses:  $1,800.00
YTD net:       $4,000.00
MoM income:    +$200.00
MoM expenses:  +$200.00
MoM net:       +$0.00

Income by category:
  - Salary: $3,000.00

Expenses by category:
  - Food: $100.00
  - Rent: $900.00"""


def test_trend_report_text_matches_the_frozen_snapshot():
    report = build_trend_report(_report_transactions(), months=2, end_month=6, end_year=2026)

    assert format_trend_report(report) == """Trend report for 2026-05 through 2026-06

Month    Income     Expenses   Net savings  MoM net     Savings  Transactions
-------  ---------  ---------  -----------  ----------  -------  ------------
2026-05  $2,800.00  $800.00    $2,000.00    +$2,000.00  71.4%    2
2026-06  $3,000.00  $1,000.00  $2,000.00    +$0.00      66.7%    3

Total income:       $5,800.00
Total expenses:     $1,800.00
Total net savings:  $4,000.00
Transactions:       5

Top expense categories:
  - Rent: $1,700.00
  - Food: $100.00"""
