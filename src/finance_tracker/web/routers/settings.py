"""Ledger settings routes."""

from fastapi import APIRouter, Request

from finance_tracker.web.dependencies import settings_service
from finance_tracker.web.schemas import (
    ErrorResponse,
    NoticeResponse,
    SettingsRequest,
    SettingsResponse,
)

router = APIRouter()


@router.get("/api/settings", response_model=SettingsResponse)
def get_settings(request: Request) -> SettingsResponse:
    currency = settings_service(request).get_currency()
    return SettingsResponse(currency=currency)


@router.put(
    "/api/settings",
    response_model=NoticeResponse,
    responses={400: {"model": ErrorResponse}},
)
def update_settings(request: Request, payload: SettingsRequest) -> NoticeResponse:
    settings_service(request).set_currency(payload.currency)
    return NoticeResponse(
        notice="Ledger currency updated successfully.",
        notice_code="settings.currency_updated",
    )
