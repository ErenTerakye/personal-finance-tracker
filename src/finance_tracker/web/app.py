"""FastAPI JSON API and static SPA host for the local finance tracker."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

from finance_tracker.exceptions import (
    BudgetNotFoundError,
    FinanceTrackerError,
    TransactionNotFoundError,
)
from finance_tracker.models import Budget, Transaction
from finance_tracker.reports import (
    MonthlyReport,
    TrendReport,
    build_monthly_report,
    build_trend_report,
)
from finance_tracker.services import BudgetService, BudgetStatus, TransactionService

WEB_DIR = Path(__file__).parent
STATIC_DIR = WEB_DIR / "static"
ASSETS_DIR = STATIC_DIR / "spa" / "assets"
INDEX_PATH = STATIC_DIR / "spa" / "index.html"

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


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class ErrorResponse(ApiModel):
    error: str


class NoticeResponse(ApiModel):
    notice: str


class TransactionRequest(ApiModel):
    type: Literal["income", "expense"]
    amount: str
    category: str
    description: str = ""
    date: str


class TransactionPatchRequest(ApiModel):
    type: Literal["income", "expense"] | None = None
    amount: str | None = None
    category: str | None = None
    description: str | None = None
    date: str | None = None


class BudgetRequest(ApiModel):
    category: str
    amount: str
    month: int
    year: int


class TransactionResponse(ApiModel):
    id: int
    type: str
    amount: str
    category: str
    description: str
    date: str
    created_at: str | None


class BudgetResponse(ApiModel):
    id: int
    category: str
    amount: str
    month: int
    year: int
    created_at: str | None


class BudgetStatusResponse(ApiModel):
    budget: BudgetResponse
    actual_expenses: str
    remaining: str
    percent_used: str
    status: str


class MonthlyReportResponse(ApiModel):
    month: int
    year: int
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    income_by_category: dict[str, str]
    expenses_by_category: dict[str, str]


class TrendMonthResponse(ApiModel):
    month: int
    year: int
    label: str
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    savings_rate: str


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


class TransactionListResponse(ApiModel):
    transactions: list[TransactionResponse]


class TransactionMutationResponse(ApiModel):
    notice: str
    transaction: TransactionResponse


class BudgetListResponse(ApiModel):
    budgets: list[BudgetResponse]


class BudgetMutationResponse(ApiModel):
    notice: str
    budget: BudgetResponse


class BudgetStatusListResponse(ApiModel):
    statuses: list[BudgetStatusResponse]


def create_app(db_path: Path | str) -> FastAPI:
    app = FastAPI(title="Personal Finance Tracker")
    app.state.db_path = Path(db_path)

    if ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.exception_handler(FinanceTrackerError)
    async def handle_finance_error(_request: Request, exc: FinanceTrackerError) -> JSONResponse:
        status_code = (
            status.HTTP_404_NOT_FOUND
            if isinstance(exc, (BudgetNotFoundError, TransactionNotFoundError))
            else status.HTTP_400_BAD_REQUEST
        )
        return JSONResponse(status_code=status_code, content={"error": str(exc)})

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get(
        "/api/dashboard",
        response_model=DashboardResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def dashboard(
        request: Request,
        month: int | None = None,
        year: int | None = None,
    ) -> DashboardResponse:
        period = _period(month, year)
        transactions = _transaction_service(request).list_transactions(
            month=period["month"],
            year=period["year"],
        )
        all_transactions = _transaction_service(request).list_transactions()
        report = build_monthly_report(transactions, month=period["month"], year=period["year"])
        trend = build_trend_report(
            all_transactions,
            months=6,
            end_month=period["month"],
            end_year=period["year"],
        )
        statuses = _budget_service(request).budget_statuses(period["month"], period["year"])

        return DashboardResponse(
            month=period["month"],
            year=period["year"],
            period_label=_period_label(period),
            report=_monthly_report_response(report),
            trend=_trend_report_response(trend),
            savings_rate=_moneyless_decimal(_savings_rate(report)),
            recent_transactions=[
                _transaction_response(transaction)
                for transaction in all_transactions[:5]
            ],
            budget_statuses=[_budget_status_response(item) for item in statuses],
        )

    @app.get(
        "/api/transactions",
        response_model=TransactionListResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def list_transactions(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        transaction_type: Literal["income", "expense"] | None = None,
    ) -> TransactionListResponse:
        transactions = _transaction_service(request).list_transactions(
            month=month,
            year=year,
            category=category or None,
            transaction_type=transaction_type,
        )
        return TransactionListResponse(
            transactions=[_transaction_response(transaction) for transaction in transactions]
        )

    @app.post(
        "/api/transactions",
        response_model=TransactionMutationResponse,
        status_code=status.HTTP_201_CREATED,
        responses={400: {"model": ErrorResponse}},
    )
    def create_transaction(
        request: Request,
        payload: TransactionRequest,
    ) -> TransactionMutationResponse:
        transaction = _transaction_service(request).add_transaction(
            transaction_type=payload.type,
            amount=payload.amount,
            category=payload.category,
            description=payload.description,
            transaction_date=payload.date,
        )
        return TransactionMutationResponse(
            notice="Transaction added to the local ledger.",
            transaction=_transaction_response(transaction),
        )

    @app.patch(
        "/api/transactions/{transaction_id}",
        response_model=TransactionMutationResponse,
        responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
    )
    def update_transaction(
        request: Request,
        transaction_id: int,
        payload: TransactionPatchRequest,
    ) -> TransactionMutationResponse:
        transaction = _transaction_service(request).edit_transaction(
            transaction_id=transaction_id,
            transaction_type=payload.type,
            amount=payload.amount,
            category=payload.category,
            description=payload.description,
            transaction_date=payload.date,
        )
        return TransactionMutationResponse(
            notice="Transaction changes saved.",
            transaction=_transaction_response(transaction),
        )

    @app.delete(
        "/api/transactions/{transaction_id}",
        response_model=NoticeResponse,
        responses={404: {"model": ErrorResponse}},
    )
    def delete_transaction(request: Request, transaction_id: int) -> NoticeResponse:
        _transaction_service(request).delete_transaction(transaction_id)
        return NoticeResponse(notice="Transaction removed from the local ledger.")

    @app.get(
        "/api/budgets",
        response_model=BudgetListResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def list_budgets(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
    ) -> BudgetListResponse:
        budgets = _budget_service(request).list_budgets(
            month=month,
            year=year,
            category=category or None,
        )
        return BudgetListResponse(budgets=[_budget_response(budget) for budget in budgets])

    @app.post(
        "/api/budgets",
        response_model=BudgetMutationResponse,
        status_code=status.HTTP_201_CREATED,
        responses={400: {"model": ErrorResponse}},
    )
    def set_budget(request: Request, payload: BudgetRequest) -> BudgetMutationResponse:
        budget = _budget_service(request).set_budget(
            category=payload.category,
            amount=payload.amount,
            month=payload.month,
            year=payload.year,
        )
        return BudgetMutationResponse(
            notice="Budget saved for the selected month.",
            budget=_budget_response(budget),
        )

    @app.get(
        "/api/budgets/status",
        response_model=BudgetStatusListResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def budget_status(request: Request, month: int, year: int) -> BudgetStatusListResponse:
        statuses = _budget_service(request).budget_statuses(month=month, year=year)
        return BudgetStatusListResponse(
            statuses=[_budget_status_response(item) for item in statuses]
        )

    @app.delete(
        "/api/budgets/{budget_id}",
        response_model=NoticeResponse,
        responses={404: {"model": ErrorResponse}},
    )
    def delete_budget(request: Request, budget_id: int) -> NoticeResponse:
        _budget_service(request).delete_budget(budget_id)
        return NoticeResponse(notice="Budget removed from the local ledger.")

    @app.get("/", include_in_schema=False)
    def spa_index() -> FileResponse:
        return _spa_response()

    @app.get("/{path:path}", include_in_schema=False)
    def spa_fallback(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "Not found."},
            )
        return _spa_response()

    return app


def _transaction_service(request: Request) -> TransactionService:
    return TransactionService(request.app.state.db_path)


def _budget_service(request: Request) -> BudgetService:
    return BudgetService(request.app.state.db_path)


def _period(month: int | None, year: int | None) -> dict[str, int]:
    today = date.today()
    return {"month": month or today.month, "year": year or today.year}


def _period_label(period: dict[str, int]) -> str:
    return f"{MONTH_NAMES[period['month']]} {period['year']}"


def _transaction_response(transaction: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=_require_id(transaction.id),
        type=transaction.type.value,
        amount=_money_decimal(transaction.amount),
        category=transaction.category,
        description=transaction.description,
        date=transaction.date.isoformat(),
        created_at=_datetime_response(transaction.created_at),
    )


def _budget_response(budget: Budget) -> BudgetResponse:
    return BudgetResponse(
        id=_require_id(budget.id),
        category=budget.category,
        amount=_money_decimal(budget.amount),
        month=budget.month,
        year=budget.year,
        created_at=_datetime_response(budget.created_at),
    )


def _budget_status_response(status_item: BudgetStatus) -> BudgetStatusResponse:
    return BudgetStatusResponse(
        budget=_budget_response(status_item.budget),
        actual_expenses=_money_decimal(status_item.actual_expenses),
        remaining=_money_decimal(status_item.remaining),
        percent_used=_moneyless_decimal(status_item.percent_used),
        status=status_item.status,
    )


def _monthly_report_response(report: MonthlyReport) -> MonthlyReportResponse:
    return MonthlyReportResponse(
        month=report.month,
        year=report.year,
        total_income=_money_decimal(report.total_income),
        total_expenses=_money_decimal(report.total_expenses),
        net_savings=_money_decimal(report.net_savings),
        transaction_count=report.transaction_count,
        income_by_category=_decimal_map(report.income_by_category),
        expenses_by_category=_decimal_map(report.expenses_by_category),
    )


def _trend_report_response(report: TrendReport) -> TrendReportResponse:
    return TrendReportResponse(
        months=[
            TrendMonthResponse(
                month=item.month,
                year=item.year,
                label=f"{item.year}-{item.month:02d}",
                total_income=_money_decimal(item.total_income),
                total_expenses=_money_decimal(item.total_expenses),
                net_savings=_money_decimal(item.net_savings),
                transaction_count=item.transaction_count,
                savings_rate=_moneyless_decimal(item.savings_rate),
            )
            for item in report.months
        ],
        total_income=_money_decimal(report.total_income),
        total_expenses=_money_decimal(report.total_expenses),
        net_savings=_money_decimal(report.net_savings),
        transaction_count=report.transaction_count,
        top_expense_categories=_decimal_map(report.top_expense_categories),
    )


def _decimal_map(values: dict[str, Decimal]) -> dict[str, str]:
    return {key: _money_decimal(value) for key, value in values.items()}


def _savings_rate(report: MonthlyReport) -> Decimal:
    if report.total_income <= 0:
        return Decimal("0.0")
    return (report.net_savings / report.total_income * Decimal("100")).quantize(Decimal("0.1"))


def _money_decimal(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01'))}"


def _moneyless_decimal(value: Decimal) -> str:
    return str(value)


def _datetime_response(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _require_id(value: int | None) -> int:
    if value is None:
        raise ValueError("Stored records must have an id.")
    return value


def _spa_response() -> FileResponse:
    if INDEX_PATH.exists():
        return FileResponse(INDEX_PATH)
    fallback_path = STATIC_DIR / "fallback.html"
    return FileResponse(fallback_path)
