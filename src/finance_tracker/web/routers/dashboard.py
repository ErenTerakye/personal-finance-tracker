"""Dashboard aggregate route."""

from datetime import date

from fastapi import APIRouter, Request

from finance_tracker.reports import (
    build_monthly_report,
    build_net_worth_summary,
    build_trend_report,
)
from finance_tracker.reports.monthly import calculate_savings_rate
from finance_tracker.web.dependencies import (
    account_service,
    budget_service,
    settings_service,
    transaction_service,
)
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
    transactions = transaction_service(request).list_transactions(
        month=selected_period["month"],
        year=selected_period["year"],
    )
    all_transactions = transaction_service(request).list_transactions()
    report = build_monthly_report(
        transactions,
        month=selected_period["month"],
        year=selected_period["year"],
        context_transactions=all_transactions,
    )
    trend = build_trend_report(
        all_transactions,
        months=6,
        end_month=selected_period["month"],
        end_year=selected_period["year"],
    )
    statuses = budget_service(request).budget_statuses(
        selected_period["month"], selected_period["year"]
    )
    currency = settings_service(request).get_currency()
    today = date.today()
    accounts, snapshots = account_service(request).report_data(today)

    return DashboardResponse(
        month=selected_period["month"],
        year=selected_period["year"],
        period_label=f"{MONTH_NAMES[selected_period['month']]} {selected_period['year']}",
        report=monthly_report_response(report),
        trend=trend_report_response(trend),
        savings_rate=moneyless_decimal(
            calculate_savings_rate(report.total_income, report.net_savings)
        ),
        recent_transactions=[transaction_response(item) for item in all_transactions[:5]],
        budget_statuses=[budget_status_response(item) for item in statuses],
        net_worth=net_worth_summary_response(
            build_net_worth_summary(accounts, snapshots, today),
            currency,
        ),
        currency=currency,
    )
