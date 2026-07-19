"""Domain-to-HTTP response construction helpers."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, cast

from fastapi.responses import Response

from finance_tracker.csv_io import (
    ActivityImportPreview,
    ActivityImportPreviewRow,
    ImportResult,
    TransactionImportPreview,
    TransactionImportPreviewRow,
)
from finance_tracker.models import (
    ActivityKind,
    ActivityRecord,
    Budget,
    CategoryRule,
    RecurringTemplate,
    ResolvedAccount,
)
from finance_tracker.models.transactions import Transaction
from finance_tracker.reports import (
    MonthlyReport,
    NetWorthHistory,
    NetWorthOverview,
    NetWorthSummary,
    TrendReport,
)
from finance_tracker.services import BudgetStatus, RecurringApplyResult
from finance_tracker.web.schemas import (
    AccountResponse,
    ActivityAccountEffectResponse,
    ActivityImportPreviewResponse,
    ActivityImportPreviewRowResponse,
    ActivityPreviewRecordResponse,
    ActivityResponse,
    BudgetResponse,
    BudgetStatusResponse,
    CategoryRuleResponse,
    ImportSummaryResponse,
    MonthlyReportResponse,
    NetWorthAccountAnalyticsResponse,
    NetWorthAccountStateResponse,
    NetWorthAttributionResponse,
    NetWorthComparisonResponse,
    NetWorthHistoryPointResponse,
    NetWorthHistoryResponse,
    NetWorthOverviewResponse,
    NetWorthSummaryResponse,
    RecurringApplyResponse,
    RecurringTemplateResponse,
    TransactionImportPreviewResponse,
    TransactionImportPreviewRowResponse,
    TransactionPreviewRecordResponse,
    TransactionResponse,
    TrendMonthResponse,
    TrendReportResponse,
)


def account_response(resolved: ResolvedAccount, currency: str) -> AccountResponse:
    account = resolved.account
    return AccountResponse(
        id=_require_id(account.id),
        name=account.name,
        type=account.type.value,
        subtype=account.subtype.value,
        archived_on=account.archived_on.isoformat() if account.archived_on else None,
        created_at=_required_datetime_response(account.created_at),
        as_of=resolved.as_of.isoformat(),
        balance=money_decimal(resolved.balance),
        balance_state=resolved.balance_state.value,
        opening_balance=money_decimal(resolved.opening_balance),
        opening_date=resolved.opening_date.isoformat(),
        opening_activity_id=resolved.opening_activity_id,
        currency=currency,
    )


def net_worth_summary_response(
    summary: NetWorthSummary,
    currency: str,
) -> NetWorthSummaryResponse:
    return NetWorthSummaryResponse(
        as_of=summary.as_of.isoformat(),
        total_assets=money_decimal(summary.total_assets),
        total_liabilities=money_decimal(summary.total_liabilities),
        total_net_worth=money_decimal(summary.total_net_worth),
        active_account_count=summary.active_account_count,
        archived_account_count=summary.archived_account_count,
        resolved_asset_count=summary.resolved_asset_count,
        resolved_liability_count=summary.resolved_liability_count,
        account_state_warning_count=summary.account_state_warning_count,
        currency=currency,
    )


def net_worth_history_response(
    history: NetWorthHistory,
    currency: str,
) -> NetWorthHistoryResponse:
    return NetWorthHistoryResponse(
        as_of=history.as_of.isoformat(),
        months=history.months,
        points=[
            NetWorthHistoryPointResponse(
                as_of=point.as_of.isoformat(),
                total_assets=money_decimal(point.total_assets),
                total_liabilities=money_decimal(point.total_liabilities),
                total_net_worth=money_decimal(point.total_net_worth),
                resolved_asset_count=point.resolved_asset_count,
                resolved_liability_count=point.resolved_liability_count,
                account_state_warning_count=point.account_state_warning_count,
            )
            for point in history.points
        ],
        change_amount=(
            money_decimal(history.change_amount) if history.change_amount is not None else None
        ),
        change_percent=(
            moneyless_decimal(history.change_percent)
            if history.change_percent is not None
            else None
        ),
        currency=currency,
    )


def net_worth_overview_response(
    overview: NetWorthOverview,
    currency: str,
) -> NetWorthOverviewResponse:
    return NetWorthOverviewResponse(
        summary=net_worth_summary_response(overview.summary, currency),
        history=net_worth_history_response(overview.history, currency),
        comparison=NetWorthComparisonResponse(
            start_date=overview.comparison_start.isoformat(),
            end_date=overview.comparison_end.isoformat(),
            available=overview.comparison_available,
            start_value=(
                money_decimal(overview.comparison_start_value)
                if overview.comparison_start_value is not None
                else None
            ),
            end_value=(
                money_decimal(overview.comparison_end_value)
                if overview.comparison_end_value is not None
                else None
            ),
            change_amount=(
                money_decimal(overview.comparison_change_amount)
                if overview.comparison_change_amount is not None
                else None
            ),
            change_percent=(
                moneyless_decimal(overview.comparison_change_percent)
                if overview.comparison_change_percent is not None
                else None
            ),
        ),
        accounts=[
            NetWorthAccountAnalyticsResponse(
                account_id=account.account_id,
                name=account.name,
                type=account.type.value,
                archived_on=(account.archived_on.isoformat() if account.archived_on else None),
                current_balance=(
                    money_decimal(account.current_balance)
                    if account.current_balance is not None
                    else None
                ),
                current_balance_date=(
                    account.current_balance_date.isoformat()
                    if account.current_balance_date
                    else None
                ),
                comparison_balance=(
                    money_decimal(account.comparison_balance)
                    if account.comparison_balance is not None
                    else None
                ),
                comparison_balance_date=(
                    account.comparison_balance_date.isoformat()
                    if account.comparison_balance_date
                    else None
                ),
                contribution_change=(
                    money_decimal(account.contribution_change)
                    if account.contribution_change is not None
                    else None
                ),
                composition_percent=(
                    moneyless_decimal(account.composition_percent)
                    if account.composition_percent is not None
                    else None
                ),
                balance_state=cast(
                    Literal["normal", "overdrawn", "credit_balance"],
                    account.balance_state,
                ),
                currency=currency,
            )
            for account in overview.accounts
        ],
        account_state=NetWorthAccountStateResponse(
            warning_count=overview.summary.account_state_warning_count,
            oldest_activity_date=(
                overview.oldest_balance_date.isoformat() if overview.oldest_balance_date else None
            ),
        ),
        attribution=NetWorthAttributionResponse(
            cashflow=money_decimal(overview.attribution.cashflow),
            adjustments=money_decimal(overview.attribution.adjustments),
            transfers=money_decimal(overview.attribution.transfers),
        ),
        currency=currency,
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


def activity_response(record: ActivityRecord) -> ActivityResponse:
    activity = record.activity
    net_worth_effect = sum(
        (
            effect.balance_effect
            * (Decimal("1") if effect.account_type.value == "asset" else Decimal("-1"))
            for effect in record.effects
        ),
        Decimal("0.00"),
    )
    cashflow_effect = Decimal("0.00")
    if activity.kind is ActivityKind.INCOME:
        cashflow_effect = activity.amount
    elif activity.kind is ActivityKind.EXPENSE:
        cashflow_effect = -activity.amount
    return ActivityResponse(
        id=_require_id(activity.id),
        kind=activity.kind.value,
        amount=money_decimal(activity.amount),
        category=activity.category,
        description=activity.description,
        date=activity.date.isoformat(),
        account=_activity_effect(record, "account"),
        from_account=_activity_effect(record, "source"),
        to_account=_activity_effect(record, "destination"),
        net_worth_effect=money_decimal(net_worth_effect),
        cashflow_effect=money_decimal(cashflow_effect),
        created_at=_datetime_response(activity.created_at),
        updated_at=_datetime_response(activity.updated_at),
    )


def activity_import_preview_response(
    preview: ActivityImportPreview,
) -> ActivityImportPreviewResponse:
    return ActivityImportPreviewResponse(
        valid_count=preview.valid_count,
        duplicate_count=preview.duplicate_count,
        invalid_count=preview.invalid_count,
        rows=[_activity_import_preview_row(row) for row in preview.rows],
    )


def _activity_import_preview_row(
    row: ActivityImportPreviewRow,
) -> ActivityImportPreviewRowResponse:
    activity = row.activity
    effects = row.effects
    return ActivityImportPreviewRowResponse(
        line_number=row.line_number,
        status=row.status,
        activity=(
            ActivityPreviewRecordResponse(
                kind=activity.kind.value,
                amount=money_decimal(activity.amount),
                category=activity.category,
                description=activity.description,
                date=activity.date.isoformat(),
                account=_preview_effect_name(effects, "account"),
                from_account=_preview_effect_name(effects, "source"),
                to_account=_preview_effect_name(effects, "destination"),
                balance_effects=[
                    f"{effect.account_name}: {money_decimal(effect.before_balance)} → "
                    f"{money_decimal(effect.after_balance)} "
                    f"({money_decimal(effect.balance_effect)})"
                    for effect in (effects.effects if effects else ())
                ],
            )
            if activity is not None
            else None
        ),
        original_category=row.original_category,
        error=row.error,
    )


def _activity_effect(record: ActivityRecord, role: str) -> ActivityAccountEffectResponse | None:
    effect = next((item for item in record.effects if item.role.value == role), None)
    if effect is None:
        return None
    if effect.after_balance >= 0:
        state = "normal"
    elif effect.account_type.value == "asset":
        state = "overdrawn"
    else:
        state = "credit_balance"
    return ActivityAccountEffectResponse(
        id=effect.account_id,
        name=effect.account_name,
        type=effect.account_type.value,
        subtype=effect.account_subtype.value,
        role=effect.role.value,
        before_balance=money_decimal(effect.before_balance),
        after_balance=money_decimal(effect.after_balance),
        balance_effect=money_decimal(effect.balance_effect),
        balance_state=cast(Literal["normal", "overdrawn", "credit_balance"], state),
    )


def _preview_effect_name(record: ActivityRecord | None, role: str) -> str | None:
    if record is None:
        return None
    effect = next((item for item in record.effects if item.role.value == role), None)
    return effect.account_name if effect else None


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
        kind=cast(Literal["income", "expense", "transfer"], template.kind.value),
        amount=money_decimal(template.amount),
        category=template.category,
        description=template.description,
        day_of_month=template.day_of_month,
        account_id=template.account_id,
        from_account_id=template.from_account_id,
        to_account_id=template.to_account_id,
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
            f"Created {len(result.created)} recurring activity item(s); "
            f"skipped {result.skipped_duplicates} duplicate(s)."
        ),
        notice_code="recurring_template.applied",
        created_count=len(result.created),
        skipped_duplicates=result.skipped_duplicates,
        activities=[activity_response(activity) for activity in result.created],
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


def _required_datetime_response(value: datetime | None) -> str:
    if value is None:
        raise ValueError("Stored records must have timestamps.")
    return value.isoformat()


def _require_id(value: int | None) -> int:
    if value is None:
        raise ValueError("Stored records must have an id.")
    return value
