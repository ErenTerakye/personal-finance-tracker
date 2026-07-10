"""Dashboard and financial report schemas."""

from finance_tracker.web.schemas.budgets import BudgetStatusResponse
from finance_tracker.web.schemas.common import ApiModel
from finance_tracker.web.schemas.transactions import TransactionResponse


class MonthlyReportResponse(ApiModel):
    month: int
    year: int
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    income_by_category: dict[str, str]
    expenses_by_category: dict[str, str]
    ytd_income: str
    ytd_expenses: str
    ytd_net_savings: str
    income_delta: str
    expenses_delta: str
    net_savings_delta: str


class TrendMonthResponse(ApiModel):
    month: int
    year: int
    label: str
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    savings_rate: str
    income_delta: str
    expenses_delta: str
    net_savings_delta: str


class TrendReportResponse(ApiModel):
    months: list[TrendMonthResponse]
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    top_expense_categories: dict[str, str]


class DashboardResponse(ApiModel):
    month: int
    year: int
    period_label: str
    report: MonthlyReportResponse
    trend: TrendReportResponse
    savings_rate: str
    recent_transactions: list[TransactionResponse]
    budget_statuses: list[BudgetStatusResponse]
    currency: str
