from fastapi.testclient import TestClient

from finance_tracker.services import BudgetService, TransactionService
from finance_tracker.web.app import create_app


def test_dashboard_renders_monthly_summary_budget_status_and_chart_data(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)
    transactions.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    transactions.add_transaction("expense", "125.50", "Food", "Groceries", "2026-06-12")
    budgets.set_budget("Food", "300", 6, 2026)
    client = TestClient(create_app(db_path))

    response = client.get("/", params={"month": 6, "year": 2026})

    assert response.status_code == 200
    assert "2026-06 financial cockpit" in response.text
    assert "$3,000.00" in response.text
    assert "$125.50 / $300.00" in response.text
    assert '"trend"' in response.text


def test_web_transaction_create_edit_delete_flow(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))

    create_response = client.post(
        "/transactions",
        data={
            "type": "expense",
            "amount": "45.90",
            "category": "Food",
            "description": "Groceries",
            "date": "2026-06-12",
        },
    )
    edit_response = client.post(
        "/transactions/1",
        data={
            "type": "expense",
            "amount": "52.25",
            "category": "Household",
            "description": "Supplies",
            "date": "2026-06-13",
        },
    )
    list_response = client.get("/transactions", params={"month": 6, "year": 2026})
    delete_response = client.post("/transactions/1/delete")

    assert create_response.status_code == 200
    assert edit_response.status_code == 200
    assert "Household" in list_response.text
    assert "52.25" in list_response.text
    assert delete_response.status_code == 200
    assert TransactionService(db_path).count_transactions() == 0


def test_web_transaction_validation_error_renders_form(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    response = client.post(
        "/transactions",
        data={
            "type": "expense",
            "amount": "-1",
            "category": "Food",
            "description": "",
            "date": "2026-06-12",
        },
    )

    assert response.status_code == 400
    assert "Amount must be greater than zero." in response.text


def test_web_transaction_filters_by_type_and_category(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    service = TransactionService(db_path)
    service.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    service.add_transaction("expense", "45", "Food", "Groceries", "2026-06-12")
    client = TestClient(create_app(db_path))

    response = client.get(
        "/transactions",
        params={"month": 6, "year": 2026, "transaction_type": "expense", "category": "Food"},
    )

    assert response.status_code == 200
    assert "Groceries" in response.text
    assert "Paycheck" not in response.text


def test_web_budget_set_delete_and_status_flow(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    TransactionService(db_path).add_transaction("expense", "90", "Food", "Groceries", "2026-06-12")
    client = TestClient(create_app(db_path))

    create_response = client.post(
        "/budgets",
        data={"category": "Food", "amount": "100", "month": 6, "year": 2026},
    )
    status_response = client.get("/budgets", params={"month": 6, "year": 2026})
    delete_response = client.post("/budgets/1/delete")

    assert create_response.status_code == 200
    assert status_response.status_code == 200
    assert "$90.00 / $100.00" in status_response.text
    assert "90.0%" in status_response.text
    assert delete_response.status_code == 200
    assert BudgetService(db_path).list_budgets() == []
