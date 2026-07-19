from decimal import Decimal

from finance_tracker.services import AccountService, ActivityService, BudgetService


def test_budget_status_uses_only_expense_activity(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    accounts = AccountService(db_path)
    checking = accounts.create_account("Checking", "asset", "1000", "2026-01-01", "cash")
    savings = accounts.create_account("Savings", "asset", "0", "2026-01-01", "cash")
    activities = ActivityService(db_path)
    budgets = BudgetService(db_path)
    budgets.set_budget("Food", "100", 6, 2026)
    activities.add_activity("expense", "90", "food", "Groceries", "2026-06-02", checking.id)
    activities.add_activity("income", "500", "Food", "Ignored income", "2026-06-03", checking.id)
    activities.add_transfer("200", "Ignored transfer", "2026-06-04", checking.id, savings.id)
    activities.adjust_account(checking.id, "800", "2026-06-05", "Ignored adjustment")

    status = budgets.budget_statuses(6, 2026)[0]

    assert status.actual_expenses == Decimal("90.00")
    assert status.remaining == Decimal("10.00")
    assert status.status == "near limit"


def test_budget_set_is_case_insensitively_unique_and_filterable(tmp_path):
    service = BudgetService(tmp_path / "ledger.sqlite3")
    first = service.set_budget("Food", "100", 6, 2026)
    updated = service.set_budget("food", "125", 6, 2026)
    service.set_budget("Food", "200", 7, 2026)

    june = service.list_budgets(month=6, year=2026, category="FOOD")

    assert updated.id == first.id
    assert june[0].amount == Decimal("125.00")
    assert len(service.list_budgets()) == 2
