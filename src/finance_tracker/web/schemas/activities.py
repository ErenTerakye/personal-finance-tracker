"""Discriminated activity-ledger API contracts."""

from typing import Annotated, Literal

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel, PageResponse


class IncomeExpenseActivityRequest(ApiModel):
    kind: Literal["income", "expense"]
    amount: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    date: str = Field(min_length=10, max_length=10)
    account_id: int = Field(gt=0)


class TransferActivityRequest(ApiModel):
    kind: Literal["transfer"]
    amount: str = Field(min_length=1, max_length=64)
    description: str = Field(default="", max_length=500)
    date: str = Field(min_length=10, max_length=10)
    from_account_id: int = Field(gt=0)
    to_account_id: int = Field(gt=0)


class AdjustmentActivityRequest(ApiModel):
    kind: Literal["adjustment"]
    amount: str = Field(min_length=1, max_length=64)
    description: str = Field(default="Balance update", max_length=500)
    date: str = Field(min_length=10, max_length=10)
    account_id: int = Field(gt=0)


ActivityRequest = Annotated[
    IncomeExpenseActivityRequest | TransferActivityRequest | AdjustmentActivityRequest,
    Field(discriminator="kind"),
]


class ActivityAccountEffectResponse(ApiModel):
    id: int
    name: str
    type: Literal["asset", "liability"]
    subtype: Literal["cash", "investment", "property", "credit_card", "loan", "other"]
    role: Literal["account", "source", "destination"]
    before_balance: str
    after_balance: str
    balance_effect: str
    balance_state: Literal["normal", "overdrawn", "credit_balance"]


class ActivityResponse(ApiModel):
    id: int
    kind: Literal["opening", "income", "expense", "transfer", "adjustment"]
    amount: str
    category: str | None
    description: str
    date: str
    account: ActivityAccountEffectResponse | None
    from_account: ActivityAccountEffectResponse | None
    to_account: ActivityAccountEffectResponse | None
    net_worth_effect: str
    cashflow_effect: str
    created_at: str | None
    updated_at: str | None


class ActivityListResponse(ApiModel):
    activities: list[ActivityResponse]
    page: PageResponse


class ActivityMutationResponse(ApiModel):
    notice: str
    notice_code: str
    activity: ActivityResponse


class ActivityPreviewRecordResponse(ApiModel):
    kind: str
    amount: str
    category: str | None
    description: str
    date: str
    account: str | None
    from_account: str | None
    to_account: str | None
    balance_effects: list[str]


class ActivityImportPreviewRowResponse(ApiModel):
    line_number: int
    status: str
    activity: ActivityPreviewRecordResponse | None
    original_category: str | None
    error: str | None


class ActivityImportPreviewResponse(ApiModel):
    valid_count: int
    duplicate_count: int
    invalid_count: int
    rows: list[ActivityImportPreviewRowResponse]
