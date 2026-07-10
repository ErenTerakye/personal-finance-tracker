"""Text report and PNG chart artifact routes."""

from fastapi import APIRouter, Request
from fastapi.responses import Response

from finance_tracker.charts import render_monthly_chart_png, render_trend_chart_png
from finance_tracker.reports import (
    MonthlyReport,
    TrendReport,
    build_monthly_report,
    build_trend_report,
    format_monthly_report,
    format_trend_report,
)
from finance_tracker.web.dependencies import transaction_service
from finance_tracker.web.responses import download_response, resolve_period
from finance_tracker.web.schemas import ErrorResponse

router = APIRouter()


def monthly_report(request: Request, month: int, year: int) -> MonthlyReport:
    transactions = transaction_service(request).list_transactions(month=month, year=year)
    all_transactions = transaction_service(request).list_transactions()
    return build_monthly_report(
        transactions,
        month=month,
        year=year,
        context_transactions=all_transactions,
    )


def trend_report(request: Request, months: int, end_month: int, end_year: int) -> TrendReport:
    transactions = transaction_service(request).list_transactions()
    return build_trend_report(
        transactions,
        months=months,
        end_month=end_month,
        end_year=end_year,
    )


@router.get("/api/reports/monthly.txt", responses={400: {"model": ErrorResponse}})
def download_monthly_report(request: Request, month: int, year: int) -> Response:
    report = monthly_report(request, month, year)
    return download_response(
        format_monthly_report(report),
        filename=f"monthly-report-{year}-{month:02d}.txt",
        media_type="text/plain; charset=utf-8",
    )


@router.get("/api/reports/trends.txt", responses={400: {"model": ErrorResponse}})
def download_trend_report(
    request: Request,
    months: int = 6,
    end_month: int | None = None,
    end_year: int | None = None,
) -> Response:
    selected_period = resolve_period(end_month, end_year)
    trend = trend_report(
        request,
        months=months,
        end_month=selected_period["month"],
        end_year=selected_period["year"],
    )
    return download_response(
        format_trend_report(trend),
        filename=f"trend-report-{selected_period['year']}-{selected_period['month']:02d}.txt",
        media_type="text/plain; charset=utf-8",
    )


@router.get("/api/charts/monthly.png", responses={400: {"model": ErrorResponse}})
def download_monthly_chart(request: Request, month: int, year: int) -> Response:
    report = monthly_report(request, month, year)
    return download_response(
        render_monthly_chart_png(report),
        filename=f"monthly-chart-{year}-{month:02d}.png",
        media_type="image/png",
    )


@router.get("/api/charts/trends.png", responses={400: {"model": ErrorResponse}})
def download_trend_chart(
    request: Request,
    months: int = 6,
    end_month: int | None = None,
    end_year: int | None = None,
) -> Response:
    selected_period = resolve_period(end_month, end_year)
    trend = trend_report(
        request,
        months=months,
        end_month=selected_period["month"],
        end_year=selected_period["year"],
    )
    return download_response(
        render_trend_chart_png(trend),
        filename=f"trend-chart-{selected_period['year']}-{selected_period['month']:02d}.png",
        media_type="image/png",
    )
