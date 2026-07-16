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


@dataclass(frozen=True)
class NetWorthAccountAnalytics:
    account_id: int
    name: str
    type: AccountType
    archived_on: date | None
    current_balance: Decimal | None
    current_balance_date: date | None
    comparison_balance: Decimal | None
    comparison_balance_date: date | None
    contribution_change: Decimal | None
    composition_percent: Decimal | None


@dataclass(frozen=True)
class NetWorthOverview:
    summary: NetWorthSummary
    history: NetWorthHistory
    comparison_start: date
    comparison_end: date
    comparison_available: bool
    comparison_start_value: Decimal | None
    comparison_end_value: Decimal | None
    comparison_change_amount: Decimal | None
    comparison_change_percent: Decimal | None
    accounts: list[NetWorthAccountAnalytics]
    oldest_balance_date: date | None


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


def build_net_worth_overview(
    accounts: list[Account],
    snapshots: list[BalanceSnapshot],
    as_of: date,
    months: int = 12,
    *,
    include_archived: bool = False,
) -> NetWorthOverview:
    history = build_net_worth_history(accounts, snapshots, as_of, months)
    summary = history.points[-1]
    comparison_start = history.points[0]
    start_snapshots = _latest_snapshots(snapshots, comparison_start.as_of)
    end_snapshots = _latest_snapshots(snapshots, as_of)
    visible_accounts = [
        account for account in accounts if include_archived or account.active
    ]
    analytics: list[NetWorthAccountAnalytics] = []
    resolved_dates: list[date] = []

    for account in visible_accounts:
        assert account.id is not None
        start = start_snapshots.get(account.id)
        end = end_snapshots.get(account.id)
        if end is not None:
            resolved_dates.append(end.effective_date)
        contribution: Decimal | None = None
        if start is not None and end is not None:
            direction = Decimal("1") if account.type is AccountType.ASSET else Decimal("-1")
            contribution = ((end.amount - start.amount) * direction).quantize(
                Decimal("0.01")
            )
        type_total = (
            summary.total_assets
            if account.type is AccountType.ASSET
            else summary.total_liabilities
        )
        composition_percent = (
            (end.amount / type_total * Decimal("100")).quantize(Decimal("0.1"))
            if end is not None and type_total != 0
            else None
        )
        analytics.append(
            NetWorthAccountAnalytics(
                account_id=account.id,
                name=account.name,
                type=account.type,
                archived_on=account.archived_on,
                current_balance=end.amount if end is not None else None,
                current_balance_date=end.effective_date if end is not None else None,
                comparison_balance=start.amount if start is not None else None,
                comparison_balance_date=(
                    start.effective_date if start is not None else None
                ),
                contribution_change=contribution,
                composition_percent=composition_percent,
            )
        )

    analytics.sort(
        key=lambda item: (
            item.contribution_change is None,
            -abs(item.contribution_change or Decimal("0")),
            item.type.value,
            item.name.casefold(),
            item.account_id,
        )
    )
    comparison_available = bool(visible_accounts) and all(
        account.id in start_snapshots and account.id in end_snapshots
        for account in visible_accounts
    )
    change = (
        (summary.total_net_worth - comparison_start.total_net_worth).quantize(
            Decimal("0.01")
        )
        if comparison_available
        else None
    )
    percent = (
        (
            change
            / abs(comparison_start.total_net_worth)
            * Decimal("100")
        ).quantize(Decimal("0.1"))
        if change is not None and comparison_start.total_net_worth != 0
        else None
    )
    return NetWorthOverview(
        summary=summary,
        history=history,
        comparison_start=comparison_start.as_of,
        comparison_end=as_of,
        comparison_available=comparison_available,
        comparison_start_value=(
            comparison_start.total_net_worth if comparison_available else None
        ),
        comparison_end_value=summary.total_net_worth if comparison_available else None,
        comparison_change_amount=change,
        comparison_change_percent=percent,
        accounts=analytics,
        oldest_balance_date=min(resolved_dates) if resolved_dates else None,
    )


def _latest_snapshots(
    snapshots: list[BalanceSnapshot],
    as_of: date,
) -> dict[int, BalanceSnapshot]:
    latest: dict[int, BalanceSnapshot] = {}
    for snapshot in snapshots:
        if snapshot.effective_date > as_of:
            continue
        current = latest.get(snapshot.account_id)
        if current is None or snapshot.effective_date >= current.effective_date:
            latest[snapshot.account_id] = snapshot
    return latest


def _history_date(as_of: date, months_before: int) -> date:
    if months_before == 0:
        return as_of
    month_index = as_of.year * 12 + as_of.month - 1 - months_before
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    return date(year, month, calendar.monthrange(year, month)[1])
