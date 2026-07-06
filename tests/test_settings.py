import pytest
from fastapi.testclient import TestClient

from finance_tracker.exceptions import ValidationError
from finance_tracker.reports import build_monthly_report, format_money, format_monthly_report
from finance_tracker.services import SettingsService
from finance_tracker.web.app import create_app


def test_settings_service_defaults_and_updates(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    service = SettingsService(db_path)

    # Verify default is USD
    assert service.get_currency() == "USD"

    # Enforce validation on update
    service.set_currency("try")
    assert service.get_currency() == "TRY"

    with pytest.raises(ValidationError) as exc:
        service.set_currency("INVALID")
    assert "Currency must be a valid 3-letter ISO code" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        service.set_currency("123")
    assert "Currency must be a valid 3-letter ISO code" in str(exc.value)


def test_currency_report_formatting():
    from decimal import Decimal

    # Test basic format_money symbol mappings
    assert format_money(Decimal("100.50"), "USD") == "$100.50"
    assert format_money(Decimal("100.50"), "TRY") == "₺100.50"
    assert format_money(Decimal("100.50"), "EUR") == "€100.50"
    assert format_money(Decimal("100.50"), "GBP") == "£100.50"
    # Unknown currencies fall back to code prefix
    assert format_money(Decimal("100.50"), "CAD") == "CAD 100.50"

    # Test monthly report formatting propagation
    report = build_monthly_report([], 6, 2026)
    formatted_usd = format_monthly_report(report, "USD")
    assert "Income:       $0.00" in formatted_usd

    formatted_try = format_monthly_report(report, "TRY")
    assert "Income:       ₺0.00" in formatted_try


def test_api_settings_endpoints(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))

    # GET settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    assert get_res.json() == {"currency": "USD"}

    # PUT settings update
    put_res = client.put("/api/settings", json={"currency": "TRY"})
    assert put_res.status_code == 200
    assert put_res.json()["notice"] == "Ledger currency updated successfully."

    # Verify update persisted
    get_res_updated = client.get("/api/settings")
    assert get_res_updated.json() == {"currency": "TRY"}

    # Verify invalid currency rejection
    put_invalid = client.put("/api/settings", json={"currency": "INVALID"})
    assert put_invalid.status_code == 400
    assert "Currency must be a valid 3-letter ISO code" in put_invalid.json()["error"]
