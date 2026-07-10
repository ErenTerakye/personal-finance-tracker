"""Ledger settings schemas."""

from pydantic import field_validator

from finance_tracker.web.schemas.common import ApiModel


class SettingsResponse(ApiModel):
    currency: str


class SettingsRequest(ApiModel):
    currency: str

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        currency = value.strip().upper()
        if currency not in {"USD", "EUR", "GBP", "TRY"}:
            raise ValueError("Currency must be one of USD, EUR, GBP, or TRY.")
        return currency
