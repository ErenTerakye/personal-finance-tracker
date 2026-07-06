"""FastAPI JSON API and static SPA host for the local finance tracker."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

from finance_tracker.charts import render_monthly_chart_png, render_trend_chart_png
from finance_tracker.csv_io import (
    ImportResult,
    TransactionImportPreview,
    TransactionImportPreviewRow,
    export_budgets_csv_text,
    export_transactions_csv_text,
    import_budgets_csv_text,
    import_transactions_csv_text,
    preview_transactions_csv_text,
)
from finance_tracker.exceptions import (
    BudgetNotFoundError,
    CategoryRuleNotFoundError,
    FinanceTrackerError,
    RecurringTemplateNotFoundError,
    TransactionNotFoundError,
)
from finance_tracker.models import Budget, CategoryRule, RecurringTemplate, Transaction
from finance_tracker.reports import (
    MonthlyReport,
    TrendReport,
    build_monthly_report,
    build_trend_report,
    format_monthly_report,
    format_trend_report,
)
from finance_tracker.services import (
    BudgetService,
    BudgetStatus,
    CategoryRuleService,
    RecurringApplyResult,
    RecurringTemplateService,
    SettingsService,
    TransactionService,
)

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


class ImportSummaryResponse(ApiModel):
    notice: str
    imported_count: int
    skipped_count: int
    errors: list[str]


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


class CategoryRuleRequest(ApiModel):
    alias: str
    category: str


class RecurringTemplateRequest(ApiModel):
    type: Literal["income", "expense"]
    amount: str
    category: str
    description: str = ""
    day_of_month: int


class SettingsResponse(ApiModel):
    currency: str


class SettingsRequest(ApiModel):
    currency: str


class TransactionResponse(ApiModel):
    id: int
    type: str
    amount: str
    category: str
    description: str
    date: str
    created_at: str | None


class TransactionPreviewRecordResponse(ApiModel):
    type: str
    amount: str
    category: str
    description: str
    date: str


class BudgetResponse(ApiModel):
    id: int
    category: str
    amount: str
    month: int
    year: int
    created_at: str | None


class CategoryRuleResponse(ApiModel):
    id: int
    alias: str
    category: str
    created_at: str | None


class RecurringTemplateResponse(ApiModel):
    id: int
    type: str
    amount: str
    category: str
    description: str
    day_of_month: int
    active: bool
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
    ytd_income: str
    ytd_expenses: str
    ytd_net_savings: str
    income_delta: str
    expenses_delta: str
    net_savings_delta: str


class TrendMonthResponse(ApiModel):
    month: int
    year: int
    label: str
    total_income: str
    total_expenses: str
    net_savings: str
    transaction_count: int
    savings_rate: str
    income_delta: str
    expenses_delta: str
    net_savings_delta: str


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
    currency: str


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


class CategoryRuleListResponse(ApiModel):
    rules: list[CategoryRuleResponse]


class CategoryRuleMutationResponse(ApiModel):
    notice: str
    rule: CategoryRuleResponse


class RecurringTemplateListResponse(ApiModel):
    templates: list[RecurringTemplateResponse]


class RecurringTemplateMutationResponse(ApiModel):
    notice: str
    template: RecurringTemplateResponse


class RecurringApplyResponse(ApiModel):
    notice: str
    created_count: int
    skipped_duplicates: int
    transactions: list[TransactionResponse]


class TransactionImportPreviewRowResponse(ApiModel):
    line_number: int
    status: str
    transaction: TransactionPreviewRecordResponse | None
    original_category: str | None
    error: str | None


class TransactionImportPreviewResponse(ApiModel):
    valid_count: int
    duplicate_count: int
    invalid_count: int
    rows: list[TransactionImportPreviewRowResponse]


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
            if isinstance(
                exc,
                (
                    BudgetNotFoundError,
                    CategoryRuleNotFoundError,
                    RecurringTemplateNotFoundError,
                    TransactionNotFoundError,
                ),
            )
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
        report = build_monthly_report(
            transactions,
            month=period["month"],
            year=period["year"],
            context_transactions=all_transactions,
        )
        trend = build_trend_report(
            all_transactions,
            months=6,
            end_month=period["month"],
            end_year=period["year"],
        )
        statuses = _budget_service(request).budget_statuses(period["month"], period["year"])
        currency = _settings_service(request).get_currency()

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
            currency=currency,
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
        "/api/transactions/import-csv",
        response_model=ImportSummaryResponse,
        responses={400: {"model": ErrorResponse}},
    )
    async def import_transactions(
        request: Request,
        allow_duplicates: bool = False,
    ) -> ImportSummaryResponse:
        csv_text = await _request_text(request)
        result = import_transactions_csv_text(
            csv_text,
            _transaction_service(request),
            allow_duplicates=allow_duplicates,
        )
        return _import_summary_response("Transaction CSV import finished.", result)

    @app.post(
        "/api/transactions/import-csv/preview",
        response_model=TransactionImportPreviewResponse,
        responses={400: {"model": ErrorResponse}},
    )
    async def preview_transaction_import(request: Request) -> TransactionImportPreviewResponse:
        csv_text = await _request_text(request)
        result = preview_transactions_csv_text(csv_text, _transaction_service(request))
        return _transaction_import_preview_response(result)

    @app.get(
        "/api/transactions/export-csv",
        responses={400: {"model": ErrorResponse}},
    )
    def export_transactions(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
        transaction_type: Literal["income", "expense"] | None = None,
    ) -> Response:
        transactions = _transaction_service(request).list_transactions(
            month=month,
            year=year,
            category=category or None,
            transaction_type=transaction_type,
        )
        filename = _period_filename("transactions", month, year, "csv")
        return _download_response(
            export_transactions_csv_text(transactions),
            filename=filename,
            media_type="text/csv; charset=utf-8",
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
        "/api/budgets/import-csv",
        response_model=ImportSummaryResponse,
        responses={400: {"model": ErrorResponse}},
    )
    async def import_budgets(request: Request) -> ImportSummaryResponse:
        csv_text = await _request_text(request)
        result = import_budgets_csv_text(csv_text, _budget_service(request))
        return _import_summary_response("Budget CSV import finished.", result)

    @app.get(
        "/api/budgets/export-csv",
        responses={400: {"model": ErrorResponse}},
    )
    def export_budgets(
        request: Request,
        month: int | None = None,
        year: int | None = None,
        category: str | None = None,
    ) -> Response:
        budgets = _budget_service(request).list_budgets(
            month=month,
            year=year,
            category=category or None,
        )
        filename = _period_filename("budgets", month, year, "csv")
        return _download_response(
            export_budgets_csv_text(budgets),
            filename=filename,
            media_type="text/csv; charset=utf-8",
        )

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

    @app.get(
        "/api/category-rules",
        response_model=CategoryRuleListResponse,
    )
    def list_category_rules(request: Request) -> CategoryRuleListResponse:
        rules = _category_rule_service(request).list_rules()
        return CategoryRuleListResponse(rules=[_category_rule_response(rule) for rule in rules])

    @app.post(
        "/api/category-rules",
        response_model=CategoryRuleMutationResponse,
        status_code=status.HTTP_201_CREATED,
        responses={400: {"model": ErrorResponse}},
    )
    def set_category_rule(
        request: Request,
        payload: CategoryRuleRequest,
    ) -> CategoryRuleMutationResponse:
        rule = _category_rule_service(request).set_rule(
            alias=payload.alias,
            category=payload.category,
        )
        return CategoryRuleMutationResponse(
            notice="Category rule saved.",
            rule=_category_rule_response(rule),
        )

    @app.delete(
        "/api/category-rules/{rule_id}",
        response_model=NoticeResponse,
        responses={404: {"model": ErrorResponse}},
    )
    def delete_category_rule(request: Request, rule_id: int) -> NoticeResponse:
        _category_rule_service(request).delete_rule(rule_id)
        return NoticeResponse(notice="Category rule removed.")

    @app.get(
        "/api/recurring-templates",
        response_model=RecurringTemplateListResponse,
    )
    def list_recurring_templates(request: Request) -> RecurringTemplateListResponse:
        templates = _recurring_template_service(request).list_templates()
        return RecurringTemplateListResponse(
            templates=[_recurring_template_response(template) for template in templates]
        )

    @app.post(
        "/api/recurring-templates",
        response_model=RecurringTemplateMutationResponse,
        status_code=status.HTTP_201_CREATED,
        responses={400: {"model": ErrorResponse}},
    )
    def create_recurring_template(
        request: Request,
        payload: RecurringTemplateRequest,
    ) -> RecurringTemplateMutationResponse:
        template = _recurring_template_service(request).add_template(
            transaction_type=payload.type,
            amount=payload.amount,
            category=payload.category,
            description=payload.description,
            day_of_month=payload.day_of_month,
        )
        return RecurringTemplateMutationResponse(
            notice="Recurring template saved.",
            template=_recurring_template_response(template),
        )

    @app.delete(
        "/api/recurring-templates/{template_id}",
        response_model=NoticeResponse,
        responses={404: {"model": ErrorResponse}},
    )
    def delete_recurring_template(request: Request, template_id: int) -> NoticeResponse:
        _recurring_template_service(request).delete_template(template_id)
        return NoticeResponse(notice="Recurring template removed.")

    @app.post(
        "/api/recurring-templates/apply",
        response_model=RecurringApplyResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def apply_recurring_templates(
        request: Request,
        month: int,
        year: int,
    ) -> RecurringApplyResponse:
        result = _recurring_template_service(request).apply_templates(month=month, year=year)
        return _recurring_apply_response(result)

    @app.get(
        "/api/reports/monthly.txt",
        responses={400: {"model": ErrorResponse}},
    )
    def download_monthly_report(request: Request, month: int, year: int) -> Response:
        report = _monthly_report(request, month, year)
        return _download_response(
            format_monthly_report(report),
            filename=f"monthly-report-{year}-{month:02d}.txt",
            media_type="text/plain; charset=utf-8",
        )

    @app.get(
        "/api/reports/trends.txt",
        responses={400: {"model": ErrorResponse}},
    )
    def download_trend_report(
        request: Request,
        months: int = 6,
        end_month: int | None = None,
        end_year: int | None = None,
    ) -> Response:
        period = _period(end_month, end_year)
        trend = _trend_report(
            request,
            months=months,
            end_month=period["month"],
            end_year=period["year"],
        )
        return _download_response(
            format_trend_report(trend),
            filename=f"trend-report-{period['year']}-{period['month']:02d}.txt",
            media_type="text/plain; charset=utf-8",
        )

    @app.get(
        "/api/charts/monthly.png",
        responses={400: {"model": ErrorResponse}},
    )
    def download_monthly_chart(request: Request, month: int, year: int) -> Response:
        report = _monthly_report(request, month, year)
        return _download_response(
            render_monthly_chart_png(report),
            filename=f"monthly-chart-{year}-{month:02d}.png",
            media_type="image/png",
        )

    @app.get(
        "/api/charts/trends.png",
        responses={400: {"model": ErrorResponse}},
    )
    def download_trend_chart(
        request: Request,
        months: int = 6,
        end_month: int | None = None,
        end_year: int | None = None,
    ) -> Response:
        period = _period(end_month, end_year)
        trend = _trend_report(
            request,
            months=months,
            end_month=period["month"],
            end_year=period["year"],
        )
        return _download_response(
            render_trend_chart_png(trend),
            filename=f"trend-chart-{period['year']}-{period['month']:02d}.png",
            media_type="image/png",
        )

    @app.get(
        "/api/settings",
        response_model=SettingsResponse,
    )
    def get_settings(request: Request) -> SettingsResponse:
        currency = _settings_service(request).get_currency()
        return SettingsResponse(currency=currency)

    @app.put(
        "/api/settings",
        response_model=NoticeResponse,
        responses={400: {"model": ErrorResponse}},
    )
    def update_settings(
        request: Request,
        payload: SettingsRequest,
    ) -> NoticeResponse:
        _settings_service(request).set_currency(payload.currency)
        return NoticeResponse(notice="Ledger currency updated successfully.")

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


def _category_rule_service(request: Request) -> CategoryRuleService:
    return CategoryRuleService(request.app.state.db_path)


def _recurring_template_service(request: Request) -> RecurringTemplateService:
    return RecurringTemplateService(request.app.state.db_path)


def _settings_service(request: Request) -> SettingsService:
    return SettingsService(request.app.state.db_path)


async def _request_text(request: Request) -> str:
    body = await request.body()
    try:
        return body.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "CSV upload must be UTF-8 text."},
        ) from exc


def _period(month: int | None, year: int | None) -> dict[str, int]:
    today = date.today()
    return {"month": month or today.month, "year": year or today.year}


def _period_label(period: dict[str, int]) -> str:
    return f"{MONTH_NAMES[period['month']]} {period['year']}"


def _monthly_report(request: Request, month: int, year: int) -> MonthlyReport:
    transactions = _transaction_service(request).list_transactions(month=month, year=year)
    all_transactions = _transaction_service(request).list_transactions()
    return build_monthly_report(
        transactions,
        month=month,
        year=year,
        context_transactions=all_transactions,
    )


def _trend_report(request: Request, months: int, end_month: int, end_year: int) -> TrendReport:
    transactions = _transaction_service(request).list_transactions()
    return build_trend_report(
        transactions,
        months=months,
        end_month=end_month,
        end_year=end_year,
    )


def _download_response(content: str | bytes, filename: str, media_type: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _period_filename(prefix: str, month: int | None, year: int | None, extension: str) -> str:
    if month is not None and year is not None:
        return f"{prefix}-{year}-{month:02d}.{extension}"
    return f"{prefix}.{extension}"


def _import_summary_response(notice: str, result: ImportResult) -> ImportSummaryResponse:
    return ImportSummaryResponse(
        notice=notice,
        imported_count=result.imported_count,
        skipped_count=result.skipped_count,
        errors=result.errors,
    )


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


def _category_rule_response(rule: CategoryRule) -> CategoryRuleResponse:
    return CategoryRuleResponse(
        id=_require_id(rule.id),
        alias=rule.alias,
        category=rule.category,
        created_at=_datetime_response(rule.created_at),
    )


def _recurring_template_response(template: RecurringTemplate) -> RecurringTemplateResponse:
    return RecurringTemplateResponse(
        id=_require_id(template.id),
        type=template.type.value,
        amount=_money_decimal(template.amount),
        category=template.category,
        description=template.description,
        day_of_month=template.day_of_month,
        active=template.active,
        created_at=_datetime_response(template.created_at),
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
        ytd_income=_money_decimal(report.ytd_income),
        ytd_expenses=_money_decimal(report.ytd_expenses),
        ytd_net_savings=_money_decimal(report.ytd_net_savings),
        income_delta=_money_decimal(report.income_delta),
        expenses_delta=_money_decimal(report.expenses_delta),
        net_savings_delta=_money_decimal(report.net_savings_delta),
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
                income_delta=_money_decimal(item.income_delta),
                expenses_delta=_money_decimal(item.expenses_delta),
                net_savings_delta=_money_decimal(item.net_savings_delta),
            )
            for item in report.months
        ],
        total_income=_money_decimal(report.total_income),
        total_expenses=_money_decimal(report.total_expenses),
        net_savings=_money_decimal(report.net_savings),
        transaction_count=report.transaction_count,
        top_expense_categories=_decimal_map(report.top_expense_categories),
    )


def _recurring_apply_response(result: RecurringApplyResult) -> RecurringApplyResponse:
    return RecurringApplyResponse(
        notice=(
            f"Created {len(result.created)} recurring transaction(s); "
            f"skipped {result.skipped_duplicates} duplicate(s)."
        ),
        created_count=len(result.created),
        skipped_duplicates=result.skipped_duplicates,
        transactions=[_transaction_response(transaction) for transaction in result.created],
    )


def _transaction_import_preview_response(
    preview: TransactionImportPreview,
) -> TransactionImportPreviewResponse:
    return TransactionImportPreviewResponse(
        valid_count=preview.valid_count,
        duplicate_count=preview.duplicate_count,
        invalid_count=preview.invalid_count,
        rows=[_transaction_import_preview_row_response(row) for row in preview.rows],
    )


def _transaction_import_preview_row_response(
    row: TransactionImportPreviewRow,
) -> TransactionImportPreviewRowResponse:
    return TransactionImportPreviewRowResponse(
        line_number=row.line_number,
        status=row.status,
        transaction=(
            _transaction_preview_record_response(row.transaction)
            if row.transaction is not None
            else None
        ),
        original_category=row.original_category,
        error=row.error,
    )


def _transaction_preview_record_response(
    transaction: Transaction,
) -> TransactionPreviewRecordResponse:
    return TransactionPreviewRecordResponse(
        type=transaction.type.value,
        amount=_money_decimal(transaction.amount),
        category=transaction.category,
        description=transaction.description,
        date=transaction.date.isoformat(),
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
