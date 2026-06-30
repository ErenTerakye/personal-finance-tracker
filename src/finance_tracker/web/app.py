"""FastAPI web application for the local finance tracker."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, Form, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.models import Transaction
from finance_tracker.reports import (
    MonthlyReport,
    TrendReport,
    build_monthly_report,
    build_trend_report,
    format_money,
)
from finance_tracker.services import BudgetService, BudgetStatus, TransactionService

WEB_DIR = Path(__file__).parent
templates = Jinja2Templates(directory=WEB_DIR / "templates")
templates.env.filters["money"] = format_money


def create_app(db_path: Path | str) -> FastAPI:
    app = FastAPI(title="Personal Finance Tracker")
    app.state.db_path = Path(db_path)
    app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")

    @app.get("/", response_class=HTMLResponse)
    def dashboard(
        request: Request,
        month: int | None = None,
        year: int | None = None,
    ) -> HTMLResponse:
        period = _period(month, year)
        transaction_service = _transaction_service(request)
        budget_service = _budget_service(request)
        transactions = transaction_service.list_transactions(
            month=period["month"],
            year=period["year"],
        )
        recent_transactions = transaction_service.list_transactions()[:5]
        monthly_report = build_monthly_report(
            transactions,
            month=period["month"],
            year=period["year"],
        )
        trend_report = build_trend_report(
            transaction_service.list_transactions(),
            months=6,
            end_month=period["month"],
            end_year=period["year"],
        )
        budget_statuses = budget_service.budget_statuses(period["month"], period["year"])

        return templates.TemplateResponse(
            request,
            "dashboard.html",
            {
                **_base_context("dashboard", period),
                "report": monthly_report,
                "savings_rate": _savings_rate(monthly_report),
                "recent_transactions": recent_transactions,
                "budget_statuses": budget_statuses,
                "chart_data": _json(
                    {
                        "monthly": _monthly_chart_data(monthly_report),
                        "trend": _trend_chart_data(trend_report),
                        "budgets": _budget_chart_data(budget_statuses),
                    }
                ),
            },
        )

    @app.get("/transactions", response_class=HTMLResponse)
    def transactions_page(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        transaction_type: str | None = None,
    ) -> HTMLResponse:
        return _render_transactions(
            request,
            month=month,
            year=year,
            category=category,
            transaction_type=transaction_type,
        )

    @app.post("/transactions", response_class=HTMLResponse)
    def create_transaction(
        request: Request,
        transaction_type: Annotated[str, Form(alias="type")],
        amount: Annotated[str, Form()],
        category: Annotated[str, Form()],
        description: Annotated[str, Form()] = "",
        transaction_date: Annotated[str, Form(alias="date")] = "",
    ) -> Response:
        try:
            _transaction_service(request).add_transaction(
                transaction_type=transaction_type,
                amount=amount,
                category=category,
                description=description,
                transaction_date=transaction_date,
            )
        except FinanceTrackerError as exc:
            return _render_transactions(
                request,
                error=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return _redirect("/transactions")

    @app.post("/transactions/{transaction_id}", response_class=HTMLResponse)
    def update_transaction(
        request: Request,
        transaction_id: int,
        transaction_type: Annotated[str, Form(alias="type")],
        amount: Annotated[str, Form()],
        category: Annotated[str, Form()],
        description: Annotated[str, Form()] = "",
        transaction_date: Annotated[str, Form(alias="date")] = "",
    ) -> Response:
        try:
            _transaction_service(request).edit_transaction(
                transaction_id=transaction_id,
                transaction_type=transaction_type,
                amount=amount,
                category=category,
                description=description,
                transaction_date=transaction_date,
            )
        except FinanceTrackerError as exc:
            return _render_transactions(
                request,
                error=str(exc),
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return _redirect("/transactions")

    @app.post("/transactions/{transaction_id}/delete")
    def delete_transaction(request: Request, transaction_id: int) -> RedirectResponse:
        _transaction_service(request).delete_transaction(transaction_id)
        return _redirect("/transactions")

    @app.get("/budgets", response_class=HTMLResponse)
    def budgets_page(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
    ) -> HTMLResponse:
        return _render_budgets(request, month=month, year=year, category=category)

    @app.post("/budgets", response_class=HTMLResponse)
    def set_budget(
        request: Request,
        category: Annotated[str, Form()],
        amount: Annotated[str, Form()],
        month: Annotated[int, Form()],
        year: Annotated[int, Form()],
    ) -> Response:
        try:
            _budget_service(request).set_budget(
                category=category,
                amount=amount,
                month=month,
                year=year,
            )
        except FinanceTrackerError as exc:
            return _render_budgets(request, error=str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return _redirect(f"/budgets?month={month}&year={year}")

    @app.post("/budgets/{budget_id}/delete")
    def delete_budget(request: Request, budget_id: int) -> RedirectResponse:
        _budget_service(request).delete_budget(budget_id)
        return _redirect("/budgets")

    return app


def _render_transactions(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    transaction_type: str | None = None,
    error: str | None = None,
    status_code: int = status.HTTP_200_OK,
) -> HTMLResponse:
    period = _period(month, year)
    transactions = _transaction_service(request).list_transactions(
        month=month,
        year=year,
        category=category or None,
        transaction_type=transaction_type or None,
    )
    categories = sorted(
        {
            transaction.category
            for transaction in _transaction_service(request).list_transactions()
        }
    )
    return templates.TemplateResponse(
        request,
        "transactions.html",
        {
            **_base_context("transactions", period),
            "transactions": transactions,
            "categories": categories,
            "filters": {
                "month": month or "",
                "year": year or "",
                "category": category or "",
                "transaction_type": transaction_type or "",
            },
            "today": date.today().isoformat(),
            "error": error,
        },
        status_code=status_code,
    )


def _render_budgets(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    error: str | None = None,
    status_code: int = status.HTTP_200_OK,
) -> HTMLResponse:
    period = _period(month, year)
    budget_service = _budget_service(request)
    budgets = budget_service.list_budgets(month=month, year=year, category=category or None)
    statuses = budget_service.budget_statuses(period["month"], period["year"])
    return templates.TemplateResponse(
        request,
        "budgets.html",
        {
            **_base_context("budgets", period),
            "budgets": budgets,
            "budget_statuses": statuses,
            "filters": {
                "month": month or "",
                "year": year or "",
                "category": category or "",
            },
            "error": error,
        },
        status_code=status_code,
    )


def _transaction_service(request: Request) -> TransactionService:
    return TransactionService(request.app.state.db_path)


def _budget_service(request: Request) -> BudgetService:
    return BudgetService(request.app.state.db_path)


def _period(month: int | None, year: int | None) -> dict[str, int]:
    today = date.today()
    return {"month": month or today.month, "year": year or today.year}


def _base_context(active_page: str, period: dict[str, int]) -> dict[str, Any]:
    return {
        "active_page": active_page,
        "selected_month": period["month"],
        "selected_year": period["year"],
        "months": range(1, 13),
    }


def _redirect(path: str) -> RedirectResponse:
    return RedirectResponse(path, status_code=status.HTTP_303_SEE_OTHER)


def _monthly_chart_data(report: MonthlyReport) -> dict[str, Any]:
    return {
        "totals": [
            {"label": "Income", "value": report.total_income},
            {"label": "Expenses", "value": report.total_expenses},
            {"label": "Net", "value": report.net_savings},
        ],
        "expenses": [
            {"label": category, "value": amount}
            for category, amount in report.expenses_by_category.items()
        ],
    }


def _trend_chart_data(report: TrendReport) -> list[dict[str, Any]]:
    return [
        {
            "label": f"{period.year}-{period.month:02d}",
            "income": period.total_income,
            "expenses": period.total_expenses,
            "net": period.net_savings,
        }
        for period in report.months
    ]


def _budget_chart_data(statuses: list[BudgetStatus]) -> list[dict[str, Any]]:
    return [
        {
            "category": status.budget.category,
            "budget": status.budget.amount,
            "actual": status.actual_expenses,
            "percent": status.percent_used,
            "status": status.status,
        }
        for status in statuses
    ]


def _savings_rate(report: MonthlyReport) -> Decimal:
    if report.total_income <= 0:
        return Decimal("0.0")
    return (report.net_savings / report.total_income * Decimal("100")).quantize(Decimal("0.1"))


def _json(value: Any) -> str:
    return json.dumps(value, default=_json_default)


def _json_default(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Transaction):
        return asdict(value)
    return str(value)
