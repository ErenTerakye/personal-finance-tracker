"""Account and activity-derived net-worth API schemas."""

from datetime import date
from typing import Literal

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel

AccountSubtypeValue = Literal["cash", "investment", "property", "credit_card", "loan", "other"]


class AccountCreateRequest(ApiModel):
    name: str = Field(min_length=1, max_length=100)
    type: Literal["asset", "liability"]
    subtype: AccountSubtypeValue
    opening_balance: str
    opening_date: date


class AccountPatchRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    subtype: AccountSubtypeValue | None = None


class AccountResponse(ApiModel):
    id: int
    name: str
    type: Literal["asset", "liability"]
    subtype: AccountSubtypeValue
    archived_on: str | None
    created_at: str
    as_of: str
    balance: str
    balance_state: Literal["normal", "overdrawn", "credit_balance"]
    opening_balance: str
    opening_date: str
    opening_activity_id: int
    currency: str


class AccountListResponse(ApiModel):
    accounts: list[AccountResponse]


class AccountMutationResponse(ApiModel):
    notice: str
    notice_code: str
    account: AccountResponse


class AccountArchiveRequest(ApiModel):
    closing_date: date


class NetWorthSummaryResponse(ApiModel):
    as_of: str
    total_assets: str
    total_liabilities: str
    total_net_worth: str
    active_account_count: int
    archived_account_count: int
    resolved_asset_count: int
    resolved_liability_count: int
    account_state_warning_count: int
    currency: str


class NetWorthHistoryPointResponse(ApiModel):
    as_of: str
    total_assets: str
    total_liabilities: str
    total_net_worth: str
    resolved_asset_count: int
    resolved_liability_count: int
    account_state_warning_count: int


class NetWorthHistoryResponse(ApiModel):
    as_of: str
    months: int = Field(ge=1, le=120)
    points: list[NetWorthHistoryPointResponse]
    change_amount: str | None
    change_percent: str | None
    currency: str


class NetWorthAccountAnalyticsResponse(ApiModel):
    account_id: int
    name: str
    type: Literal["asset", "liability"]
    archived_on: str | None
    current_balance: str | None
    current_balance_date: str | None
    comparison_balance: str | None
    comparison_balance_date: str | None
    contribution_change: str | None
    composition_percent: str | None
    balance_state: Literal["normal", "overdrawn", "credit_balance"]
    currency: str


class NetWorthComparisonResponse(ApiModel):
    start_date: str
    end_date: str
    available: bool
    start_value: str | None
    end_value: str | None
    change_amount: str | None
    change_percent: str | None


class NetWorthAccountStateResponse(ApiModel):
    warning_count: int
    oldest_activity_date: str | None


class NetWorthAttributionResponse(ApiModel):
    cashflow: str
    adjustments: str
    transfers: str


class NetWorthOverviewResponse(ApiModel):
    summary: NetWorthSummaryResponse
    history: NetWorthHistoryResponse
    comparison: NetWorthComparisonResponse
    accounts: list[NetWorthAccountAnalyticsResponse]
    account_state: NetWorthAccountStateResponse
    attribution: NetWorthAttributionResponse
    currency: str
