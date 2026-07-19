from finance_tracker.csv_io import export_activities_csv_text
from finance_tracker.services import AccountService, ActivityService


def test_activity_csv_export_has_frozen_header_and_account_columns(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    accounts = AccountService(db_path)
    checking = accounts.create_account("Checking", "asset", "100", "2026-01-01", "cash")
    savings = accounts.create_account("Savings", "asset", "0", "2026-01-01", "cash")
    service = ActivityService(db_path)
    service.add_activity("expense", "12.50", "Food", "Lunch", "2026-01-02", checking.id)
    service.add_transfer("20", "Save", "2026-01-03", checking.id, savings.id)
    records = [item for item in service.list_activities() if item.activity.kind.value != "opening"]

    assert export_activities_csv_text(records) == (
        "kind,amount,category,description,date,account,from_account,to_account\r\n"
        "transfer,20.00,,Save,2026-01-03,,Checking,Savings\r\n"
        "expense,12.50,Food,Lunch,2026-01-02,Checking,,\r\n"
    )
