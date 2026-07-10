"""Transaction request and response schemas."""

from typing import Literal

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel, PageResponse


class TransactionRequest(ApiModel):
    type: Literal["income", "expense"]
    amount: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    date: str = Field(min_length=10, max_length=10)


class TransactionPatchRequest(ApiModel):
    type: Literal["income", "expense"] | None = None
    amount: str | None = Field(default=None, min_length=1, max_length=64)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    date: str | None = Field(default=None, min_length=10, max_length=10)


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


class TransactionListResponse(ApiModel):
    transactions: list[TransactionResponse]
    page: PageResponse


class TransactionMutationResponse(ApiModel):
    notice: str
    notice_code: str
    transaction: TransactionResponse


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
