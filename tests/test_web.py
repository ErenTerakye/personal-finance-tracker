from fastapi.testclient import TestClient
from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.services import BudgetService, TransactionService
from finance_tracker.web.app import create_app


def test_api_dashboard_returns_monthly_summary_budget_status_and_trend(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)
    transactions.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    transactions.add_transaction("expense", "125.50", "Food", "Groceries", "2026-06-12")
    budgets.set_budget("Food", "100", 6, 2026)
    client = TestClient(create_app(db_path))

    response = client.get("/api/dashboard", params={"month": 6, "year": 2026})

    assert response.status_code == 200
    body = response.json()
    assert body["period_label"] == "June 2026"
    assert body["report"]["total_income"] == "3000.00"
    assert body["report"]["total_expenses"] == "125.50"
    assert body["report"]["net_savings"] == "2874.50"
    assert body["savings_rate"] == "95.8"
    assert body["budget_statuses"][0]["status"] == "over budget"
    assert body["budget_statuses"][0]["actual_expenses"] == "125.50"
    assert len(body["trend"]["months"]) == 6
    assert body["recent_transactions"][0]["category"] == "Food"


def test_api_transaction_create_filter_patch_delete_flow(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))

    create_response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "45.90",
            "category": "Food",
            "description": "Groceries",
            "date": "2026-06-12",
        },
    )
    patch_response = client.patch(
        "/api/transactions/1",
        json={
            "type": "expense",
            "amount": "52.25",
            "category": "Household",
            "description": "Supplies",
            "date": "2026-06-13",
        },
    )
    list_response = client.get(
        "/api/transactions",
        params={"month": 6, "year": 2026, "transaction_type": "expense", "category": "Household"},
    )
    delete_response = client.delete("/api/transactions/1")

    assert create_response.status_code == 201
    assert create_response.json()["notice"] == "Transaction added to the local ledger."
    assert patch_response.status_code == 200
    assert patch_response.json()["transaction"]["amount"] == "52.25"
    assert patch_response.json()["notice"] == "Transaction changes saved."
    assert list_response.status_code == 200
    assert list_response.json()["transactions"][0]["category"] == "Household"
    assert delete_response.status_code == 200
    assert delete_response.json()["notice"] == "Transaction removed from the local ledger."
    assert TransactionService(db_path).count_transactions() == 0


def test_api_transaction_validation_and_not_found_errors_are_json(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    validation_response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "-1",
            "category": "Food",
            "description": "",
            "date": "2026-06-12",
        },
    )
    not_found_response = client.delete("/api/transactions/404")

    assert validation_response.status_code == 400
    assert validation_response.json() == {"error": "Amount must be greater than zero."}
    assert not_found_response.status_code == 404
    assert not_found_response.json() == {"error": "Transaction 404 was not found."}


def test_api_budget_set_filter_status_delete_flow(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    TransactionService(db_path).add_transaction("expense", "90", "Food", "Groceries", "2026-06-12")
    client = TestClient(create_app(db_path))

    create_response = client.post(
        "/api/budgets",
        json={"category": "Food", "amount": "100", "month": 6, "year": 2026},
    )
    list_response = client.get("/api/budgets", params={"month": 6, "year": 2026})
    status_response = client.get("/api/budgets/status", params={"month": 6, "year": 2026})
    delete_response = client.delete("/api/budgets/1")

    assert create_response.status_code == 201
    assert create_response.json()["notice"] == "Budget saved for the selected month."
    assert list_response.status_code == 200
    assert list_response.json()["budgets"][0]["amount"] == "100.00"
    assert status_response.status_code == 200
    assert status_response.json()["statuses"][0]["percent_used"] == "90.0"
    assert status_response.json()["statuses"][0]["status"] == "near limit"
    assert delete_response.status_code == 200
    assert delete_response.json()["notice"] == "Budget removed from the local ledger."
    assert BudgetService(db_path).list_budgets() == []


def test_api_budget_validation_and_not_found_errors_are_json(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    validation_response = client.post(
        "/api/budgets",
        json={"category": "Food", "amount": "100", "month": 13, "year": 2026},
    )
    not_found_response = client.delete("/api/budgets/404")

    assert validation_response.status_code == 400
    assert validation_response.json() == {"error": "Month must be between 1 and 12."}
    assert not_found_response.status_code == 404
    assert not_found_response.json() == {"error": "Budget 404 was not found."}


def test_spa_fallback_serves_html_for_browser_routes(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    response = client.get("/transactions")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Ledger Workbench" in response.text


def test_cli_web_command_still_accepts_custom_db_path(monkeypatch, tmp_path):
    captured = {}

    def fake_run(fastapi_app, host, port):
        captured["app"] = fastapi_app
        captured["host"] = host
        captured["port"] = port

    monkeypatch.setattr("uvicorn.run", fake_run)
    runner = CliRunner()

    result = runner.invoke(
        app,
        [
            "web",
            "--host",
            "127.0.0.1",
            "--port",
            "8123",
            "--db-path",
            str(tmp_path / "demo.sqlite3"),
        ],
    )

    assert result.exit_code == 0
    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 8123
    assert captured["app"].state.db_path == tmp_path / "demo.sqlite3"
