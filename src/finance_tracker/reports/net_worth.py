"""Deterministic net-worth reports derived exclusively from account activity."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import Account, AccountType, balance_state
from finance_tracker.models.activities import Activity, ActivityKind, PostingKind


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
    account_state_warning_count: int

    @property
    def unresolved_account_count(self) -> int:
        """Compatibility property; v3 accounts always have an opening activity."""
        return 0


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
    balance_state: str


@dataclass(frozen=True)
class NetWorthAttribution:
    cashflow: Decimal
    adjustments: Decimal
    transfers: Decimal


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
    attribution: NetWorthAttribution


def build_net_worth_summary(
    accounts: list[Account], activities: list[Activity], as_of: date
) -> NetWorthSummary:
    balances = _balances_as_of(accounts, activities, as_of)
    total_assets = sum(
        (
            balances[account.id]
            for account in accounts
            if account.type is AccountType.ASSET and account.id in balances
        ),
        Decimal("0.00"),
    )
    total_liabilities = sum(
        (
            balances[account.id]
            for account in accounts
            if account.type is AccountType.LIABILITY and account.id in balances
        ),
        Decimal("0.00"),
    )
    resolved_assets = sum(
        account.type is AccountType.ASSET and account.id in balances for account in accounts
    )
    resolved_liabilities = sum(
        account.type is AccountType.LIABILITY and account.id in balances for account in accounts
    )
    warnings = sum(balance < 0 for balance in balances.values())
    return NetWorthSummary(
        as_of=as_of,
        total_assets=total_assets.quantize(Decimal("0.01")),
        total_liabilities=total_liabilities.quantize(Decimal("0.01")),
        total_net_worth=(total_assets - total_liabilities).quantize(Decimal("0.01")),
        active_account_count=sum(account.active for account in accounts),
        archived_account_count=sum(not account.active for account in accounts),
        resolved_asset_count=resolved_assets,
        resolved_liability_count=resolved_liabilities,
        account_state_warning_count=warnings,
    )


def build_net_worth_history(
    accounts: list[Account],
    activities: list[Activity],
    as_of: date,
    months: int = 12,
) -> NetWorthHistory:
    if not 1 <= months <= 120:
        raise ValidationError("Months must be between 1 and 120.")
    points = [
        build_net_worth_summary(accounts, activities, point_date)
        for point_date in [_history_date(as_of, offset) for offset in reversed(range(months))]
    ]
    change_amount: Decimal | None = None
    change_percent: Decimal | None = None
    if len(points) > 1:
        previous = points[-2].total_net_worth
        change_amount = (points[-1].total_net_worth - previous).quantize(Decimal("0.01"))
        if previous != 0:
            change_percent = (change_amount / abs(previous) * Decimal("100")).quantize(
                Decimal("0.1")
            )
    return NetWorthHistory(as_of, months, points, change_amount, change_percent)


def build_net_worth_overview(
    accounts: list[Account],
    activities: list[Activity],
    as_of: date,
    months: int = 12,
    *,
    include_archived: bool = False,
) -> NetWorthOverview:
    history = build_net_worth_history(accounts, activities, as_of, months)
    summary = history.points[-1]
    start_date = history.points[0].as_of
    start_balances = _balances_as_of(accounts, activities, start_date)
    end_balances = _balances_as_of(accounts, activities, as_of)
    activity_dates = _latest_activity_dates(activities, as_of)
    start_activity_dates = _latest_activity_dates(activities, start_date)
    visible = [account for account in accounts if include_archived or account.active]
    analytics: list[NetWorthAccountAnalytics] = []
    resolved_dates: list[date] = []
    for account in visible:
        assert account.id is not None
        start = start_balances.get(account.id)
        end = end_balances.get(account.id)
        if account.id in activity_dates:
            resolved_dates.append(activity_dates[account.id])
        direction = Decimal("1") if account.type is AccountType.ASSET else Decimal("-1")
        contribution = (
            ((end - start) * direction).quantize(Decimal("0.01"))
            if start is not None and end is not None
            else None
        )
        type_total = (
            summary.total_assets if account.type is AccountType.ASSET else summary.total_liabilities
        )
        composition = (
            (end / type_total * Decimal("100")).quantize(Decimal("0.1"))
            if end is not None and type_total != 0
            else None
        )
        analytics.append(
            NetWorthAccountAnalytics(
                account_id=account.id,
                name=account.name,
                type=account.type,
                archived_on=account.archived_on,
                current_balance=end,
                current_balance_date=activity_dates.get(account.id),
                comparison_balance=start,
                comparison_balance_date=start_activity_dates.get(account.id),
                contribution_change=contribution,
                composition_percent=composition,
                balance_state=balance_state(account.type, end or Decimal("0.00")).value,
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
    comparison_available = bool(visible) and all(
        account.id in start_balances and account.id in end_balances for account in visible
    )
    change = (
        (summary.total_net_worth - history.points[0].total_net_worth).quantize(Decimal("0.01"))
        if comparison_available
        else None
    )
    percent = (
        (change / abs(history.points[0].total_net_worth) * Decimal("100")).quantize(Decimal("0.1"))
        if change is not None and history.points[0].total_net_worth != 0
        else None
    )
    return NetWorthOverview(
        summary=summary,
        history=history,
        comparison_start=start_date,
        comparison_end=as_of,
        comparison_available=comparison_available,
        comparison_start_value=history.points[0].total_net_worth if comparison_available else None,
        comparison_end_value=summary.total_net_worth if comparison_available else None,
        comparison_change_amount=change,
        comparison_change_percent=percent,
        accounts=analytics,
        oldest_balance_date=min(resolved_dates) if resolved_dates else None,
        attribution=_attribution(accounts, activities, start_date, as_of),
    )


def _balances_as_of(
    accounts: list[Account], activities: list[Activity], as_of: date
) -> dict[int, Decimal]:
    account_ids = {account.id for account in accounts}
    balances: dict[int, Decimal] = {}
    ordered = sorted(
        (activity for activity in activities if activity.date <= as_of),
        key=lambda item: (
            item.date,
            0 if item.kind is ActivityKind.OPENING else 1,
            item.id or 0,
        ),
    )
    for activity in ordered:
        for posting in activity.postings:
            if posting.account_id not in account_ids:
                continue
            if posting.posting_kind is PostingKind.SET_BALANCE:
                balances[posting.account_id] = posting.amount
            elif posting.account_id in balances:
                balances[posting.account_id] = (
                    balances[posting.account_id] + posting.amount
                ).quantize(Decimal("0.01"))
    return balances


def _latest_activity_dates(activities: list[Activity], as_of: date) -> dict[int, date]:
    result: dict[int, date] = {}
    for activity in activities:
        if activity.date > as_of:
            continue
        for posting in activity.postings:
            result[posting.account_id] = max(
                result.get(posting.account_id, activity.date), activity.date
            )
    return result


def _attribution(
    accounts: list[Account], activities: list[Activity], start: date, end: date
) -> NetWorthAttribution:
    account_types = {account.id: account.type for account in accounts}
    balances = _balances_as_of(accounts, activities, start)
    cashflow = Decimal("0.00")
    adjustments = Decimal("0.00")
    transfers = Decimal("0.00")
    ordered = sorted(
        (activity for activity in activities if start < activity.date <= end),
        key=lambda item: (item.date, 0 if item.kind is ActivityKind.OPENING else 1, item.id or 0),
    )
    for activity in ordered:
        impact = Decimal("0.00")
        for posting in activity.postings:
            before = balances.get(posting.account_id, Decimal("0.00"))
            after = (
                posting.amount
                if posting.posting_kind is PostingKind.SET_BALANCE
                else before + posting.amount
            )
            balances[posting.account_id] = after.quantize(Decimal("0.01"))
            sign = (
                Decimal("1")
                if account_types[posting.account_id] is AccountType.ASSET
                else Decimal("-1")
            )
            impact += (after - before) * sign
        if activity.kind in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
            cashflow += impact
        elif activity.kind is ActivityKind.TRANSFER:
            transfers += impact
        else:
            adjustments += impact
    return NetWorthAttribution(
        cashflow.quantize(Decimal("0.01")),
        adjustments.quantize(Decimal("0.01")),
        transfers.quantize(Decimal("0.01")),
    )


def _history_date(as_of: date, months_before: int) -> date:
    if months_before == 0:
        return as_of
    month_index = as_of.year * 12 + as_of.month - 1 - months_before
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    return date(year, month, calendar.monthrange(year, month)[1])
