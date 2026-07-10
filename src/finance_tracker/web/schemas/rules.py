"""Category-rule and recurring-template schemas."""

from typing import Literal

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel
from finance_tracker.web.schemas.transactions import TransactionResponse


class CategoryRuleRequest(ApiModel):
    alias: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)


class RecurringTemplateRequest(ApiModel):
    type: Literal["income", "expense"]
    amount: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    day_of_month: int = Field(ge=1, le=31)


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


class CategoryRuleListResponse(ApiModel):
    rules: list[CategoryRuleResponse]


class CategoryRuleMutationResponse(ApiModel):
    notice: str
    notice_code: str
    rule: CategoryRuleResponse


class RecurringTemplateListResponse(ApiModel):
    templates: list[RecurringTemplateResponse]


class RecurringTemplateMutationResponse(ApiModel):
    notice: str
    notice_code: str
    template: RecurringTemplateResponse


class RecurringApplyResponse(ApiModel):
    notice: str
    notice_code: str
    created_count: int
    skipped_duplicates: int
    transactions: list[TransactionResponse]
