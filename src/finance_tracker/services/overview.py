"""Cross-capability read model used by local user interfaces."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from finance_tracker.models import Transaction
from finance_tracker.reports import (
    MonthlyReport,
    NetWorthSummary,
    TrendReport,
    build_monthly_report,
    build_net_worth_summary,
    build_trend_report,
)
from finance_tracker.services.accounts import AccountService
from finance_tracker.services.budgets import BudgetService, BudgetStatus
from finance_tracker.services.settings import SettingsService
from finance_tracker.services.transactions import TransactionService


@dataclass(frozen=True)
class OverviewSnapshot:
    month: int
    year: int
    currency: str
    report: MonthlyReport
    trend: TrendReport
    recent_transactions: list[Transaction]
    budget_statuses: list[BudgetStatus]
    net_worth: NetWorthSummary


class OverviewService:
    """Build a deterministic overview without depending on an inbound adapter."""

    def __init__(self, db_path: Path | str) -> None:
        self.db_path = Path(db_path)

    def get(self, month: int, year: int, *, as_of: date | None = None) -> OverviewSnapshot:
        resolved_date = as_of or date.today()
        transaction_service = TransactionService(self.db_path)
        all_transactions = transaction_service.list_transactions()
        period_transactions = transaction_service.list_transactions(month=month, year=year)
        report = build_monthly_report(
            period_transactions,
            month=month,
            year=year,
            context_transactions=all_transactions,
        )
        accounts, snapshots = AccountService(self.db_path).report_data(resolved_date)
        return OverviewSnapshot(
            month=month,
            year=year,
            currency=SettingsService(self.db_path).get_currency(),
            report=report,
            trend=build_trend_report(
                all_transactions,
                months=6,
                end_month=month,
                end_year=year,
            ),
            recent_transactions=all_transactions[:5],
            budget_statuses=BudgetService(self.db_path).budget_statuses(month, year),
            net_worth=build_net_worth_summary(accounts, snapshots, resolved_date),
        )
