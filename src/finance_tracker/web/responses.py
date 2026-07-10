"""Domain-to-HTTP response construction helpers."""

from datetime import date, datetime
from decimal import Decimal

from fastapi.responses import Response

from finance_tracker.csv_io import (
    ImportResult,
    TransactionImportPreview,
    TransactionImportPreviewRow,
)
from finance_tracker.models import Budget, CategoryRule, RecurringTemplate, Transaction
from finance_tracker.reports import MonthlyReport, TrendReport
from finance_tracker.services import BudgetStatus, RecurringApplyResult
from finance_tracker.web.schemas import (
    BudgetResponse,
    BudgetStatusResponse,
    CategoryRuleResponse,
    ImportSummaryResponse,
    MonthlyReportResponse,
    RecurringApplyResponse,
    RecurringTemplateResponse,
    TransactionImportPreviewResponse,
    TransactionImportPreviewRowResponse,
    TransactionPreviewRecordResponse,
    TransactionResponse,
    TrendMonthResponse,
    TrendReportResponse,
)


def download_response(content: str | bytes, filename: str, media_type: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def period_filename(prefix: str, month: int | None, year: int | None, extension: str) -> str:
    if month is not None and year is not None:
        return f"{prefix}-{year}-{month:02d}.{extension}"
    return f"{prefix}.{extension}"


def resolve_period(month: int | None, year: int | None) -> dict[str, int]:
    """Resolve omitted request period values to the current local month and year."""

    today = date.today()
    return {"month": month or today.month, "year": year or today.year}


def import_summary_response(
    notice_code: str, notice: str, result: ImportResult
) -> ImportSummaryResponse:
    return ImportSummaryResponse(
        notice=notice,
        notice_code=notice_code,
        imported_count=result.imported_count,
        skipped_count=result.skipped_count,
        errors=result.errors,
    )


def transaction_response(transaction: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=_require_id(transaction.id),
        type=transaction.type.value,
        amount=money_decimal(transaction.amount),
        category=transaction.category,
        description=transaction.description,
        date=transaction.date.isoformat(),
        created_at=_datetime_response(transaction.created_at),
    )


def budget_response(budget: Budget) -> BudgetResponse:
    return BudgetResponse(
        id=_require_id(budget.id),
        category=budget.category,
        amount=money_decimal(budget.amount),
        month=budget.month,
        year=budget.year,
        created_at=_datetime_response(budget.created_at),
    )


def category_rule_response(rule: CategoryRule) -> CategoryRuleResponse:
    return CategoryRuleResponse(
        id=_require_id(rule.id),
        alias=rule.alias,
        category=rule.category,
        created_at=_datetime_response(rule.created_at),
    )


def recurring_template_response(template: RecurringTemplate) -> RecurringTemplateResponse:
    return RecurringTemplateResponse(
        id=_require_id(template.id),
        type=template.type.value,
        amount=money_decimal(template.amount),
        category=template.category,
        description=template.description,
        day_of_month=template.day_of_month,
        active=template.active,
        created_at=_datetime_response(template.created_at),
    )


def budget_status_response(status_item: BudgetStatus) -> BudgetStatusResponse:
    return BudgetStatusResponse(
        budget=budget_response(status_item.budget),
        actual_expenses=money_decimal(status_item.actual_expenses),
        remaining=money_decimal(status_item.remaining),
        percent_used=moneyless_decimal(status_item.percent_used),
        status=status_item.status,
    )


def monthly_report_response(report: MonthlyReport) -> MonthlyReportResponse:
    return MonthlyReportResponse(
        month=report.month,
        year=report.year,
        total_income=money_decimal(report.total_income),
        total_expenses=money_decimal(report.total_expenses),
        net_savings=money_decimal(report.net_savings),
        transaction_count=report.transaction_count,
        income_by_category=_decimal_map(report.income_by_category),
        expenses_by_category=_decimal_map(report.expenses_by_category),
        ytd_income=money_decimal(report.ytd_income),
        ytd_expenses=money_decimal(report.ytd_expenses),
        ytd_net_savings=money_decimal(report.ytd_net_savings),
        income_delta=money_decimal(report.income_delta),
        expenses_delta=money_decimal(report.expenses_delta),
        net_savings_delta=money_decimal(report.net_savings_delta),
    )


def trend_report_response(report: TrendReport) -> TrendReportResponse:
    return TrendReportResponse(
        months=[
            TrendMonthResponse(
                month=item.month,
                year=item.year,
                label=f"{item.year}-{item.month:02d}",
                total_income=money_decimal(item.total_income),
                total_expenses=money_decimal(item.total_expenses),
                net_savings=money_decimal(item.net_savings),
                transaction_count=item.transaction_count,
                savings_rate=moneyless_decimal(item.savings_rate),
                income_delta=money_decimal(item.income_delta),
                expenses_delta=money_decimal(item.expenses_delta),
                net_savings_delta=money_decimal(item.net_savings_delta),
            )
            for item in report.months
        ],
        total_income=money_decimal(report.total_income),
        total_expenses=money_decimal(report.total_expenses),
        net_savings=money_decimal(report.net_savings),
        transaction_count=report.transaction_count,
        top_expense_categories=_decimal_map(report.top_expense_categories),
    )


def recurring_apply_response(result: RecurringApplyResult) -> RecurringApplyResponse:
    return RecurringApplyResponse(
        notice=(
            f"Created {len(result.created)} recurring transaction(s); "
            f"skipped {result.skipped_duplicates} duplicate(s)."
        ),
        notice_code="recurring_template.applied",
        created_count=len(result.created),
        skipped_duplicates=result.skipped_duplicates,
        transactions=[transaction_response(transaction) for transaction in result.created],
    )


def transaction_import_preview_response(
    preview: TransactionImportPreview,
) -> TransactionImportPreviewResponse:
    return TransactionImportPreviewResponse(
        valid_count=preview.valid_count,
        duplicate_count=preview.duplicate_count,
        invalid_count=preview.invalid_count,
        rows=[transaction_import_preview_row_response(row) for row in preview.rows],
    )


def transaction_import_preview_row_response(
    row: TransactionImportPreviewRow,
) -> TransactionImportPreviewRowResponse:
    return TransactionImportPreviewRowResponse(
        line_number=row.line_number,
        status=row.status,
        transaction=(
            transaction_preview_record_response(row.transaction)
            if row.transaction is not None
            else None
        ),
        original_category=row.original_category,
        error=row.error,
    )


def transaction_preview_record_response(
    transaction: Transaction,
) -> TransactionPreviewRecordResponse:
    return TransactionPreviewRecordResponse(
        type=transaction.type.value,
        amount=money_decimal(transaction.amount),
        category=transaction.category,
        description=transaction.description,
        date=transaction.date.isoformat(),
    )


def money_decimal(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01'))}"


def moneyless_decimal(value: Decimal) -> str:
    return str(value)


def _decimal_map(values: dict[str, Decimal]) -> dict[str, str]:
    return {key: money_decimal(value) for key, value in values.items()}


def _datetime_response(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _require_id(value: int | None) -> int:
    if value is None:
        raise ValueError("Stored records must have an id.")
    return value
