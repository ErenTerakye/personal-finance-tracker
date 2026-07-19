from fastapi.testclient import TestClient

from finance_tracker.web.app import create_app


def _client_with_accounts(tmp_path):
    client = TestClient(create_app(tmp_path / "ledger.sqlite3"))
    for name in ("Checking", "Savings"):
        response = client.post(
            "/api/accounts",
            json={
                "name": name,
                "type": "asset",
                "subtype": "cash",
                "opening_balance": "100.00" if name == "Checking" else "0.00",
                "opening_date": "2026-01-01",
            },
        )
        assert response.status_code == 201
    return client


def test_activity_crud_pagination_filters_and_semantic_effects(tmp_path):
    client = _client_with_accounts(tmp_path)
    created = client.post(
        "/api/activities",
        json={
            "kind": "expense",
            "amount": "12.50",
            "category": "Food",
            "description": "Lunch",
            "date": "2026-06-01",
            "account_id": 1,
        },
    )
    transfer = client.post(
        "/api/activities",
        json={
            "kind": "transfer",
            "amount": "20",
            "description": "Save",
            "date": "2026-06-02",
            "from_account_id": 1,
            "to_account_id": 2,
        },
    )
    updated = client.put(
        f"/api/activities/{created.json()['activity']['id']}",
        json={
            "kind": "income",
            "amount": "15",
            "category": "Refund",
            "description": "Refund",
            "date": "2026-06-03",
            "account_id": 1,
        },
    )
    listed = client.get("/api/activities", params={"account_id": 1, "limit": 1, "offset": 0})
    deleted = client.delete(f"/api/activities/{transfer.json()['activity']['id']}")

    assert created.status_code == transfer.status_code == 201
    assert created.json()["activity"]["account"]["after_balance"] == "87.50"
    assert transfer.json()["activity"]["cashflow_effect"] == "0.00"
    assert transfer.json()["activity"]["net_worth_effect"] == "0.00"
    assert updated.json()["activity"]["kind"] == "income"
    assert listed.json()["page"]["total"] == 3
    assert len(listed.json()["activities"]) == 1
    assert deleted.status_code == 200


def test_activity_discriminator_validation_opening_guards_and_missing_json(tmp_path):
    client = _client_with_accounts(tmp_path)
    invalid = client.post(
        "/api/activities",
        json={"kind": "transfer", "amount": "10", "date": "2026-01-02", "account_id": 1},
    )
    opening_delete = client.delete("/api/activities/1")
    missing = client.delete("/api/activities/404")
    legacy = client.get("/api/transactions")

    assert invalid.status_code == 422
    assert opening_delete.status_code == 400
    assert missing.status_code == 404
    assert legacy.status_code == 404
    assert legacy.headers["content-type"].startswith("application/json")


def test_account_responses_adjustment_and_negative_state(tmp_path):
    client = _client_with_accounts(tmp_path)
    adjusted = client.post(
        "/api/activities",
        json={
            "kind": "adjustment",
            "amount": "-5",
            "description": "Observed overdraft",
            "date": "2026-06-01",
            "account_id": 1,
        },
    )
    accounts = client.get("/api/accounts", params={"as_of": "2026-06-01"})
    overview = client.get("/api/net-worth/overview", params={"as_of": "2026-06-01", "months": 1})

    assert adjusted.json()["activity"]["account"]["balance_effect"] == "-105.00"
    assert accounts.json()["accounts"][0]["balance_state"] == "overdrawn"
    assert overview.json()["account_state"]["warning_count"] == 1


def test_activity_csv_preview_import_and_export(tmp_path):
    client = _client_with_accounts(tmp_path)
    text = (
        "kind,amount,category,description,date,account,from_account,to_account\n"
        "expense,10,Food,Lunch,2026-06-01,Checking,,\n"
        "transfer,20,,Save,2026-06-02,,Checking,Savings\n"
    )
    preview = client.post(
        "/api/activities/import-csv/preview",
        content=text,
        headers={"content-type": "text/csv"},
    )
    imported = client.post(
        "/api/activities/import-csv",
        content=text,
        headers={"content-type": "text/csv"},
    )
    exported = client.get("/api/activities/export-csv", params={"kind": "transfer"})

    assert preview.json()["valid_count"] == 2
    assert preview.json()["rows"][0]["activity"]["balance_effects"]
    assert imported.json()["imported_count"] == 2
    assert exported.headers["content-disposition"].endswith('filename="activities.csv"')
    assert ",,Checking,Savings" in exported.text


def test_dashboard_and_budgets_ignore_transfer_and_adjustment_cashflow(tmp_path):
    client = _client_with_accounts(tmp_path)
    client.post(
        "/api/budgets",
        json={"category": "Food", "amount": "100", "month": 6, "year": 2026},
    )
    for payload in (
        {
            "kind": "expense",
            "amount": "25",
            "category": "Food",
            "description": "Lunch",
            "date": "2026-06-01",
            "account_id": 1,
        },
        {
            "kind": "transfer",
            "amount": "20",
            "description": "Save",
            "date": "2026-06-02",
            "from_account_id": 1,
            "to_account_id": 2,
        },
        {
            "kind": "adjustment",
            "amount": "90",
            "description": "Observed",
            "date": "2026-06-03",
            "account_id": 1,
        },
    ):
        assert client.post("/api/activities", json=payload).status_code == 201

    dashboard = client.get("/api/dashboard", params={"month": 6, "year": 2026}).json()
    statuses = client.get("/api/budgets/status", params={"month": 6, "year": 2026}).json()
    assert dashboard["report"]["transaction_count"] == 1
    assert len(dashboard["recent_activities"]) >= 3
    assert statuses["statuses"][0]["actual_expenses"] == "25.00"


def test_recurring_transfer_api_shape_and_duplicate_application(tmp_path):
    client = _client_with_accounts(tmp_path)
    created = client.post(
        "/api/recurring-templates",
        json={
            "kind": "transfer",
            "amount": "20",
            "description": "Save",
            "day_of_month": 28,
            "from_account_id": 1,
            "to_account_id": 2,
        },
    )
    first = client.post("/api/recurring-templates/apply", params={"month": 2, "year": 2026})
    second = client.post("/api/recurring-templates/apply", params={"month": 2, "year": 2026})
    assert created.status_code == 201
    assert first.json()["created_count"] == 1
    assert second.json()["skipped_duplicates"] == 1
