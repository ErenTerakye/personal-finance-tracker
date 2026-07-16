"""Net worth summary and history HTTP routes."""

from datetime import date

from fastapi import APIRouter, Query, Request

from finance_tracker.models import parse_snapshot_date
from finance_tracker.reports import build_net_worth_history, build_net_worth_summary
from finance_tracker.web.dependencies import account_service, settings_service
from finance_tracker.web.responses import (
    net_worth_history_response,
    net_worth_summary_response,
)
from finance_tracker.web.schemas import (
    ErrorResponse,
    NetWorthHistoryResponse,
    NetWorthSummaryResponse,
)

router = APIRouter()


@router.get(
    "/api/net-worth",
    response_model=NetWorthSummaryResponse,
    responses={400: {"model": ErrorResponse}},
)
def net_worth_summary(
    request: Request,
    as_of: date | None = None,
) -> NetWorthSummaryResponse:
    resolved_date = parse_snapshot_date(as_of or date.today())
    accounts, snapshots = account_service(request).report_data(resolved_date)
    summary = build_net_worth_summary(accounts, snapshots, resolved_date)
    return net_worth_summary_response(
        summary,
        settings_service(request).get_currency(),
    )


@router.get(
    "/api/net-worth/history",
    response_model=NetWorthHistoryResponse,
    responses={400: {"model": ErrorResponse}},
)
def net_worth_history(
    request: Request,
    as_of: date | None = None,
    months: int = Query(default=12, ge=1, le=120),
) -> NetWorthHistoryResponse:
    resolved_date = parse_snapshot_date(as_of or date.today())
    accounts, snapshots = account_service(request).report_data(resolved_date)
    history = build_net_worth_history(accounts, snapshots, resolved_date, months)
    return net_worth_history_response(
        history,
        settings_service(request).get_currency(),
    )
