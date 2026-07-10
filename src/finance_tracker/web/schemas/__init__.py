"""Public Pydantic schemas for the JSON API."""

from finance_tracker.web.schemas.budgets import (
    BudgetListResponse,
    BudgetMutationResponse,
    BudgetRequest,
    BudgetResponse,
    BudgetStatusListResponse,
    BudgetStatusResponse,
)
from finance_tracker.web.schemas.common import (
    ApiErrorDetail,
    ApiModel,
    ErrorResponse,
    ImportSummaryResponse,
    NoticeResponse,
    PageResponse,
)
from finance_tracker.web.schemas.reports import (
    DashboardResponse,
    MonthlyReportResponse,
    TrendMonthResponse,
    TrendReportResponse,
)
from finance_tracker.web.schemas.rules import (
    CategoryRuleListResponse,
    CategoryRuleMutationResponse,
    CategoryRuleRequest,
    CategoryRuleResponse,
    RecurringApplyResponse,
    RecurringTemplateListResponse,
    RecurringTemplateMutationResponse,
    RecurringTemplateRequest,
    RecurringTemplateResponse,
)
from finance_tracker.web.schemas.settings import SettingsRequest, SettingsResponse
from finance_tracker.web.schemas.transactions import (
    TransactionImportPreviewResponse,
    TransactionImportPreviewRowResponse,
    TransactionListResponse,
    TransactionMutationResponse,
    TransactionPatchRequest,
    TransactionPreviewRecordResponse,
    TransactionRequest,
    TransactionResponse,
)

__all__ = [
    "ApiErrorDetail",
    "ApiModel",
    "BudgetListResponse",
    "BudgetMutationResponse",
    "BudgetRequest",
    "BudgetResponse",
    "BudgetStatusListResponse",
    "BudgetStatusResponse",
    "CategoryRuleListResponse",
    "CategoryRuleMutationResponse",
    "CategoryRuleRequest",
    "CategoryRuleResponse",
    "DashboardResponse",
    "ErrorResponse",
    "ImportSummaryResponse",
    "MonthlyReportResponse",
    "NoticeResponse",
    "PageResponse",
    "RecurringApplyResponse",
    "RecurringTemplateListResponse",
    "RecurringTemplateMutationResponse",
    "RecurringTemplateRequest",
    "RecurringTemplateResponse",
    "SettingsRequest",
    "SettingsResponse",
    "TransactionImportPreviewResponse",
    "TransactionImportPreviewRowResponse",
    "TransactionListResponse",
    "TransactionMutationResponse",
    "TransactionPatchRequest",
    "TransactionPreviewRecordResponse",
    "TransactionRequest",
    "TransactionResponse",
    "TrendMonthResponse",
    "TrendReportResponse",
]
