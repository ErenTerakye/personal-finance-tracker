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
    assert validation_response.json()["error"] == {
        "code": "validation_error",
        "message": "Amount must be greater than zero.",
        "fields": None,
    }
    assert not_found_response.status_code == 404
    assert not_found_response.json()["error"]["message"] == "Transaction 404 was not found."


def test_api_transaction_csv_import_reports_skipped_rows_and_export_filters(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))
    csv_text = "\n".join(
        [
            "type,amount,category,description,date",
            "income,3000,Salary,Paycheck,2026-06-01",
            "expense,-12,Food,Invalid,2026-06-02",
            "expense,45.90,Food,Groceries,2026-06-12",
        ]
    )

    import_response = client.post(
        "/api/transactions/import-csv",
        content=csv_text,
        headers={"content-type": "text/csv"},
    )
    export_response = client.get(
        "/api/transactions/export-csv",
        params={"month": 6, "year": 2026, "transaction_type": "expense"},
    )
    missing_column_response = client.post(
        "/api/transactions/import-csv",
        content="type,amount,date\nincome,10,2026-06-01\n",
        headers={"content-type": "text/csv"},
    )

    assert import_response.status_code == 200
    assert import_response.json() == {
        "notice": "Transaction CSV import finished.",
        "notice_code": "csv.transactions.imported",
        "imported_count": 2,
        "skipped_count": 1,
        "errors": ["Line 3: Amount must be greater than zero."],
    }
    assert export_response.status_code == 200
    assert export_response.headers["content-disposition"] == (
        'attachment; filename="transactions-2026-06.csv"'
    )
    assert export_response.text.splitlines() == [
        "type,amount,category,description,date",
        "expense,45.90,Food,Groceries,2026-06-12",
    ]
    assert missing_column_response.status_code == 400
    assert "missing required columns" in missing_column_response.json()["error"]["message"]


def test_api_transaction_csv_preview_reports_duplicates_and_aliases(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))
    client.post("/api/category-rules", json={"alias": "groceries", "category": "Food"})
    TransactionService(db_path).add_transaction(
        "expense",
        "45.90",
        "Food",
        "Groceries",
        "2026-06-12",
    )
    csv_text = "\n".join(
        [
            "type,amount,category,description,date",
            "expense,45.90,groceries,Groceries,2026-06-12",
            "expense,30,groceries,Market,2026-06-13",
        ]
    )

    response = client.post(
        "/api/transactions/import-csv/preview",
        content=csv_text,
        headers={"content-type": "text/csv"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["duplicate_count"] == 1
    assert body["valid_count"] == 1
    assert body["rows"][0]["status"] == "duplicate"
    assert body["rows"][0]["transaction"]["category"] == "Food"


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

    assert validation_response.status_code == 422
    assert validation_response.json()["error"]["code"] == "request_validation_error"
    assert "month" in validation_response.json()["error"]["fields"]
    assert not_found_response.status_code == 404
    assert not_found_response.json()["error"]["message"] == "Budget 404 was not found."


def test_api_budget_csv_import_reports_skipped_rows_and_export_filters(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))
    csv_text = "\n".join(
        [
            "category,amount,month,year",
            "Food,400,6,2026",
            "Rent,-10,6,2026",
            "Travel,300,7,2026",
        ]
    )

    import_response = client.post(
        "/api/budgets/import-csv",
        content=csv_text,
        headers={"content-type": "text/csv"},
    )
    export_response = client.get(
        "/api/budgets/export-csv",
        params={"month": 6, "year": 2026},
    )
    missing_column_response = client.post(
        "/api/budgets/import-csv",
        content="category,amount,year\nFood,400,2026\n",
        headers={"content-type": "text/csv"},
    )

    assert import_response.status_code == 200
    assert import_response.json() == {
        "notice": "Budget CSV import finished.",
        "notice_code": "csv.budgets.imported",
        "imported_count": 2,
        "skipped_count": 1,
        "errors": ["Line 3: Amount must be greater than zero."],
    }
    assert export_response.status_code == 200
    assert export_response.headers["content-disposition"] == (
        'attachment; filename="budgets-2026-06.csv"'
    )
    assert export_response.text.splitlines() == [
        "category,amount,month,year",
        "Food,400.00,6,2026",
    ]
    assert missing_column_response.status_code == 400
    assert "missing required columns" in missing_column_response.json()["error"]["message"]


def test_api_lists_are_paginated_and_report_total(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))
    for day in (1, 2, 3):
        client.post(
            "/api/transactions",
            json={
                "type": "expense",
                "amount": "10.00",
                "category": "Food",
                "description": f"Item {day}",
                "date": f"2026-07-{day:02d}",
            },
        )

    response = client.get("/api/transactions", params={"limit": 1, "offset": 1})

    assert response.status_code == 200
    assert len(response.json()["transactions"]) == 1
    assert response.json()["page"] == {"limit": 1, "offset": 1, "total": 3}


def test_api_rejects_extra_fields_and_unsafe_csv_uploads(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))
    extra_field = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "10",
            "category": "Food",
            "description": "Lunch",
            "date": "2026-07-10",
            "unexpected": True,
        },
    )
    wrong_type = client.post(
        "/api/transactions/import-csv",
        content="not,csv",
        headers={"content-type": "application/json"},
    )
    too_large = client.post(
        "/api/transactions/import-csv",
        content=b"x" * (5 * 1024 * 1024 + 1),
        headers={"content-type": "text/csv"},
    )

    assert extra_field.status_code == 422
    assert "unexpected" in extra_field.json()["error"]["fields"]
    assert wrong_type.status_code == 415
    assert wrong_type.json()["error"]["code"] == "unsupported_media_type"
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "upload_too_large"


def test_api_uses_conservative_security_and_cache_headers(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    response = client.get("/api/settings")

    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_api_report_and_chart_downloads_return_attachments(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    transactions = TransactionService(db_path)
    transactions.add_transaction("income", "3000", "Salary", "Paycheck", "2026-06-01")
    transactions.add_transaction("expense", "125.50", "Food", "Groceries", "2026-06-12")
    client = TestClient(create_app(db_path))

    monthly_report = client.get("/api/reports/monthly.txt", params={"month": 6, "year": 2026})
    trend_report = client.get(
        "/api/reports/trends.txt",
        params={"months": 6, "end_month": 6, "end_year": 2026},
    )
    monthly_chart = client.get("/api/charts/monthly.png", params={"month": 6, "year": 2026})
    trend_chart = client.get(
        "/api/charts/trends.png",
        params={"months": 6, "end_month": 6, "end_year": 2026},
    )

    assert monthly_report.status_code == 200
    assert "Monthly report for 2026-06" in monthly_report.text
    assert monthly_report.headers["content-disposition"] == (
        'attachment; filename="monthly-report-2026-06.txt"'
    )
    assert trend_report.status_code == 200
    assert "Trend report for 2026-01 through 2026-06" in trend_report.text
    assert trend_report.headers["content-disposition"] == (
        'attachment; filename="trend-report-2026-06.txt"'
    )
    assert monthly_chart.status_code == 200
    assert monthly_chart.headers["content-type"] == "image/png"
    assert monthly_chart.headers["content-disposition"] == (
        'attachment; filename="monthly-chart-2026-06.png"'
    )
    assert monthly_chart.content.startswith(b"\x89PNG")
    assert trend_chart.status_code == 200
    assert trend_chart.headers["content-type"] == "image/png"
    assert trend_chart.headers["content-disposition"] == (
        'attachment; filename="trend-chart-2026-06.png"'
    )
    assert trend_chart.content.startswith(b"\x89PNG")


def test_api_category_rules_and_recurring_templates_flow(tmp_path):
    db_path = tmp_path / "finance.sqlite3"
    client = TestClient(create_app(db_path))

    rule_response = client.post(
        "/api/category-rules",
        json={"alias": "groceries", "category": "Food"},
    )
    rules_response = client.get("/api/category-rules")
    template_response = client.post(
        "/api/recurring-templates",
        json={
            "type": "expense",
            "amount": "1200",
            "category": "Rent",
            "description": "Monthly rent",
            "day_of_month": 31,
        },
    )
    templates_response = client.get("/api/recurring-templates")
    apply_response = client.post(
        "/api/recurring-templates/apply",
        params={"month": 2, "year": 2026},
    )

    assert rule_response.status_code == 201
    assert rule_response.json()["rule"]["category"] == "Food"
    assert rules_response.json()["rules"][0]["alias"] == "groceries"
    assert template_response.status_code == 201
    assert templates_response.json()["templates"][0]["day_of_month"] == 31
    assert apply_response.status_code == 200
    assert apply_response.json()["created_count"] == 1
    assert apply_response.json()["transactions"][0]["date"] == "2026-02-28"


def test_spa_fallback_serves_html_for_browser_routes(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))

    response = client.get("/transactions")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Personal Finance Tracker" in response.text


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
