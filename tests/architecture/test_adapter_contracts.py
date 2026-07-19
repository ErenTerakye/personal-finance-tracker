from pathlib import Path

from fastapi.testclient import TestClient
from typer.main import get_command

from finance_tracker.cli.app import app as cli_app
from finance_tracker.web.app import create_app


def test_cli_adapter_manifest_uses_activity_ledger_commands():
    root = get_command(cli_app)
    assert "transaction" not in root.commands
    assert set(root.commands["activity"].commands) == {
        "add",
        "transfer",
        "list",
        "edit",
        "delete",
        "import",
        "export",
    }
    assert set(root.commands["account"].commands) == {
        "add",
        "adjust",
        "list",
        "edit",
        "archive",
        "delete",
    }


def test_openapi_contract_has_discriminated_activity_payloads_and_no_snapshot_api(tmp_path):
    schema = create_app(tmp_path / "ledger.sqlite3").openapi()
    paths = schema["paths"]
    assert schema["info"]["version"] == "3.0.0"
    assert {"get", "post"} <= set(paths["/api/activities"])
    assert {"put", "delete"} <= set(paths["/api/activities/{activity_id}"])
    assert "/api/transactions" not in paths
    assert not any("balance-snapshot" in path or "check-in" in path for path in paths)
    request_schema = paths["/api/activities"]["post"]["requestBody"]["content"]["application/json"][
        "schema"
    ]
    assert request_schema["discriminator"]["propertyName"] == "kind"
    assert len(request_schema["oneOf"]) == 3


def test_http_account_and_activity_contract_returns_semantic_effects(tmp_path):
    client = TestClient(create_app(tmp_path / "ledger.sqlite3"))
    account = client.post(
        "/api/accounts",
        json={
            "name": "Checking",
            "type": "asset",
            "subtype": "cash",
            "opening_balance": "100.00",
            "opening_date": "2026-01-01",
        },
    )
    activity = client.post(
        "/api/activities",
        json={
            "kind": "expense",
            "amount": "12.50",
            "category": "Food",
            "description": "Lunch",
            "date": "2026-01-02",
            "account_id": 1,
        },
    )

    assert account.status_code == 201
    assert account.json()["account"]["opening_activity_id"] == 1
    assert activity.status_code == 201
    body = activity.json()["activity"]
    assert body["account"]["name"] == "Checking"
    assert body["account"]["after_balance"] == "87.50"
    assert body["net_worth_effect"] == "-12.50"
    assert "postings" not in body


def test_frontend_canonical_route_keeps_transactions_query_compatibility():
    routes = Path("frontend/src/app/routes.ts").read_text(encoding="utf-8")
    assert 'path: "/activity"' in routes
    assert 'pathname === "/transactions"' in routes
    assert 'canonicalUrl("/activity", search' in routes
