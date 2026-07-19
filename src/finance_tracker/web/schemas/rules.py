"""Category-rule and recurring-template schemas."""

from typing import Annotated, Literal

from pydantic import Field

from finance_tracker.web.schemas.activities import ActivityResponse
from finance_tracker.web.schemas.common import ApiModel


class CategoryRuleRequest(ApiModel):
    alias: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)


class RecurringCashflowTemplateRequest(ApiModel):
    kind: Literal["income", "expense"]
    amount: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    day_of_month: int = Field(ge=1, le=31)
    account_id: int = Field(gt=0)


class RecurringTransferTemplateRequest(ApiModel):
    kind: Literal["transfer"]
    amount: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=500)
    day_of_month: int = Field(ge=1, le=31)
    from_account_id: int = Field(gt=0)
    to_account_id: int = Field(gt=0)


RecurringTemplateRequest = Annotated[
    RecurringCashflowTemplateRequest | RecurringTransferTemplateRequest,
    Field(discriminator="kind"),
]


class CategoryRuleResponse(ApiModel):
    id: int
    alias: str
    category: str
    created_at: str | None


class RecurringTemplateResponse(ApiModel):
    id: int
    kind: Literal["income", "expense", "transfer"]
    amount: str
    category: str | None
    description: str
    day_of_month: int
    account_id: int | None
    from_account_id: int | None
    to_account_id: int | None
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
    activities: list[ActivityResponse]
