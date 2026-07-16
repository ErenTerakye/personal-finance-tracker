"""Deterministic total net worth summaries and monthly history."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import Account, AccountType, BalanceSnapshot


@dataclass(frozen=True)
class NetWorthSummary:
    as_of: date
    total_assets: Decimal
    total_liabilities: Decimal
    total_net_worth: Decimal
    active_account_count: int
    archived_account_count: int
    resolved_asset_count: int
    resolved_liability_count: int
    unresolved_account_count: int


@dataclass(frozen=True)
class NetWorthHistory:
    as_of: date
    months: int
    points: list[NetWorthSummary]
    change_amount: Decimal | None
    change_percent: Decimal | None


def build_net_worth_summary(
    accounts: list[Account],
    snapshots: list[BalanceSnapshot],
    as_of: date,
) -> NetWorthSummary:
    latest: dict[int, BalanceSnapshot] = {}
    for snapshot in snapshots:
        if snapshot.effective_date > as_of:
            continue
        current = latest.get(snapshot.account_id)
        if current is None or snapshot.effective_date >= current.effective_date:
            latest[snapshot.account_id] = snapshot

    total_assets = Decimal("0.00")
    total_liabilities = Decimal("0.00")
    resolved_asset_count = 0
    resolved_liability_count = 0
    unresolved = 0
    for account in accounts:
        assert account.id is not None
        resolved_snapshot = latest.get(account.id)
        if resolved_snapshot is None:
            unresolved += 1
            continue
        if account.type is AccountType.ASSET:
            total_assets += resolved_snapshot.amount
            resolved_asset_count += 1
        else:
            total_liabilities += resolved_snapshot.amount
            resolved_liability_count += 1

    return NetWorthSummary(
        as_of=as_of,
        total_assets=total_assets.quantize(Decimal("0.01")),
        total_liabilities=total_liabilities.quantize(Decimal("0.01")),
        total_net_worth=(total_assets - total_liabilities).quantize(Decimal("0.01")),
        active_account_count=sum(account.active for account in accounts),
        archived_account_count=sum(not account.active for account in accounts),
        resolved_asset_count=resolved_asset_count,
        resolved_liability_count=resolved_liability_count,
        unresolved_account_count=unresolved,
    )


def build_net_worth_history(
    accounts: list[Account],
    snapshots: list[BalanceSnapshot],
    as_of: date,
    months: int = 12,
) -> NetWorthHistory:
    if not 1 <= months <= 120:
        raise ValidationError("Months must be between 1 and 120.")
    point_dates = [_history_date(as_of, offset) for offset in reversed(range(months))]
    points = [
        build_net_worth_summary(accounts, snapshots, point_date)
        for point_date in point_dates
    ]
    change_amount: Decimal | None = None
    change_percent: Decimal | None = None
    if len(points) > 1:
        previous = points[-2].total_net_worth
        change_amount = (points[-1].total_net_worth - previous).quantize(
            Decimal("0.01")
        )
        if previous != 0:
            change_percent = (change_amount / abs(previous) * Decimal("100")).quantize(
                Decimal("0.1")
            )
    return NetWorthHistory(
        as_of=as_of,
        months=months,
        points=points,
        change_amount=change_amount,
        change_percent=change_percent,
    )


def _history_date(as_of: date, months_before: int) -> date:
    if months_before == 0:
        return as_of
    month_index = as_of.year * 12 + as_of.month - 1 - months_before
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    return date(year, month, calendar.monthrange(year, month)[1])
