"""Account, balance snapshot, and net worth API schemas."""

from datetime import date
from typing import Literal

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel


class AccountCreateRequest(ApiModel):
    name: str
    type: Literal["asset", "liability"]
    initial_balance: str
    initial_balance_date: date


class AccountPatchRequest(ApiModel):
    name: str | None = None


class AccountResponse(ApiModel):
    id: int
    name: str
    type: Literal["asset", "liability"]
    archived_on: str | None
    created_at: str
    as_of: str
    resolved_balance: str | None
    resolved_balance_date: str | None
    currency: str


class AccountListResponse(ApiModel):
    accounts: list[AccountResponse]


class AccountMutationResponse(ApiModel):
    notice: str
    notice_code: str
    account: AccountResponse


class BalanceSnapshotRequest(ApiModel):
    amount: str


class BalanceSnapshotResponse(ApiModel):
    id: int
    account_id: int
    amount: str
    effective_date: str
    created_at: str
    updated_at: str
    currency: str


class BalanceSnapshotListResponse(ApiModel):
    balance_snapshots: list[BalanceSnapshotResponse]


class BalanceSnapshotMutationResponse(ApiModel):
    notice: str
    notice_code: str
    snapshot: BalanceSnapshotResponse


class AccountArchiveRequest(ApiModel):
    closing_date: date
    confirm_zero_balance: bool


class NetWorthSummaryResponse(ApiModel):
    as_of: str
    total_assets: str
    total_liabilities: str
    total_net_worth: str
    active_account_count: int
    archived_account_count: int
    resolved_asset_count: int
    resolved_liability_count: int
    unresolved_account_count: int
    currency: str


class NetWorthHistoryPointResponse(ApiModel):
    as_of: str
    total_assets: str
    total_liabilities: str
    total_net_worth: str
    resolved_asset_count: int
    resolved_liability_count: int
    unresolved_account_count: int


class NetWorthHistoryResponse(ApiModel):
    as_of: str
    months: int = Field(ge=1, le=120)
    points: list[NetWorthHistoryPointResponse]
    change_amount: str | None
    change_percent: str | None
    currency: str
