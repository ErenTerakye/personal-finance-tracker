"""Shared API envelope and pagination schemas."""

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    """Base model for the frozen JSON API contract."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ApiErrorDetail(ApiModel):
    code: str
    message: str
    fields: dict[str, str] | None = None


class ErrorResponse(ApiModel):
    error: ApiErrorDetail


class NoticeResponse(ApiModel):
    notice: str
    notice_code: str


class ImportSummaryResponse(ApiModel):
    notice: str
    notice_code: str
    imported_count: int
    skipped_count: int
    errors: list[str]


class PageResponse(ApiModel):
    limit: int
    offset: int
    total: int
