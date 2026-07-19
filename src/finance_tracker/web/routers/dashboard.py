"""Dashboard aggregate route."""

from datetime import date

from fastapi import APIRouter, Request

from finance_tracker.reports.monthly import calculate_savings_rate
from finance_tracker.services import OverviewService
from finance_tracker.web.responses import (
    budget_status_response,
    moneyless_decimal,
    monthly_report_response,
    net_worth_summary_response,
    resolve_period,
    transaction_response,
    trend_report_response,
)
from finance_tracker.web.schemas import DashboardResponse, ErrorResponse

router = APIRouter()

MONTH_NAMES = (
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)


@router.get(
    "/api/dashboard",
    response_model=DashboardResponse,
    responses={400: {"model": ErrorResponse}},
)
def dashboard(
    request: Request,
    month: int | None = None,
    year: int | None = None,
) -> DashboardResponse:
    selected_period = resolve_period(month, year)
    overview = OverviewService(request.app.state.db_path).get(
        selected_period["month"], selected_period["year"], as_of=date.today()
    )

    return DashboardResponse(
        month=selected_period["month"],
        year=selected_period["year"],
        period_label=f"{MONTH_NAMES[selected_period['month']]} {selected_period['year']}",
        report=monthly_report_response(overview.report),
        trend=trend_report_response(overview.trend),
        savings_rate=moneyless_decimal(
            calculate_savings_rate(overview.report.total_income, overview.report.net_savings)
        ),
        recent_transactions=[transaction_response(item) for item in overview.recent_transactions],
        budget_statuses=[budget_status_response(item) for item in overview.budget_statuses],
        net_worth=net_worth_summary_response(
            overview.net_worth,
            overview.currency,
        ),
        currency=overview.currency,
    )
