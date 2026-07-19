from datetime import date
from decimal import Decimal

import pytest

from finance_tracker.exceptions import ValidationError
from finance_tracker.models import ActivityKind
from finance_tracker.reports import build_net_worth_overview, build_net_worth_summary
from finance_tracker.services import AccountService, ActivityService


def _account(
    service: AccountService,
    name: str,
    account_type: str = "asset",
    balance: str = "0",
    *,
    subtype: str | None = None,
):
    return service.create_account(
        name,
        account_type,
        balance,
        "2026-01-01",
        subtype or ("cash" if account_type == "asset" else "credit_card"),
    )


def test_account_creation_is_atomic_and_balance_is_derived_from_opening(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    account = _account(accounts, "Wallet", balance="125.50")

    resolved = accounts.get_resolved_account(account.id, "2026-01-01")
    history = ActivityService(accounts.db_path).list_activities(account_id=account.id)

    assert resolved.balance == Decimal("125.50")
    assert resolved.opening_balance == Decimal("125.50")
    assert [item.activity.kind for item in history] == [ActivityKind.OPENING]


@pytest.mark.parametrize(
    ("account_type", "kind", "expected_balance", "expected_net_worth"),
    [
        ("asset", "income", "110.00", "110.00"),
        ("asset", "expense", "90.00", "90.00"),
        ("liability", "income", "90.00", "-90.00"),
        ("liability", "expense", "110.00", "-110.00"),
    ],
)
def test_income_and_expense_follow_economic_direction_for_every_account_type(
    tmp_path, account_type, kind, expected_balance, expected_net_worth
):
    accounts = AccountService(tmp_path / f"{account_type}-{kind}.sqlite3")
    account = _account(accounts, "Account", account_type, "100")
    activities = ActivityService(accounts.db_path)

    record = activities.add_activity(kind, "10", "Other", "Movement", "2026-01-02", account.id)
    resolved = accounts.get_resolved_account(account.id, "2026-01-02")
    report_accounts, report_activities = accounts.report_data("2026-01-02")
    summary = build_net_worth_summary(report_accounts, report_activities, date(2026, 1, 2))

    assert resolved.balance == Decimal(expected_balance)
    assert summary.total_net_worth == Decimal(expected_net_worth)
    assert record.effects[0].after_balance == Decimal(expected_balance)


@pytest.mark.parametrize(
    ("source_type", "destination_type", "source_balance", "destination_balance"),
    [
        ("asset", "asset", "80.00", "30.00"),
        ("asset", "liability", "80.00", "-10.00"),
        ("liability", "asset", "120.00", "30.00"),
        ("liability", "liability", "120.00", "-10.00"),
    ],
)
def test_transfer_preserves_net_worth_across_account_type_pairs(
    tmp_path, source_type, destination_type, source_balance, destination_balance
):
    accounts = AccountService(tmp_path / f"{source_type}-{destination_type}.sqlite3")
    source = _account(accounts, "Source", source_type, "100")
    destination = _account(accounts, "Destination", destination_type, "10")
    activities = ActivityService(accounts.db_path)
    before_accounts, before_activity = accounts.report_data("2026-01-01")
    before = build_net_worth_summary(before_accounts, before_activity, date(2026, 1, 1))

    activities.add_transfer("20", "Move value", "2026-01-02", source.id, destination.id)
    after_accounts, after_activity = accounts.report_data("2026-01-02")
    after = build_net_worth_summary(after_accounts, after_activity, date(2026, 1, 2))

    assert accounts.get_resolved_account(source.id, "2026-01-02").balance == Decimal(source_balance)
    assert accounts.get_resolved_account(destination.id, "2026-01-02").balance == Decimal(
        destination_balance
    )
    assert after.total_net_worth == before.total_net_worth


def test_adjustment_is_authoritative_over_earlier_activity_edits_and_deletion(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    account = _account(accounts, "Checking", balance="100")
    activities = ActivityService(accounts.db_path)
    expense = activities.add_activity("expense", "20", "Food", "Lunch", "2026-02-01", account.id)
    adjustment = activities.adjust_account(account.id, "90", "2026-02-10", "Bank balance")

    activities.edit_activity(
        expense.activity.id,
        kind="expense",
        amount="50",
        category="Food",
        description="Lunch corrected",
        activity_date="2026-02-01",
        account_id=account.id,
    )
    assert accounts.get_resolved_account(account.id, "2026-02-10").balance == Decimal("90.00")

    activities.delete_activity(expense.activity.id)
    stored_adjustment = activities.get_activity(adjustment.activity.id)
    assert stored_adjustment.effects[0].balance_effect == Decimal("-10.00")
    assert accounts.get_resolved_account(account.id, "2026-02-10").balance == Decimal("90.00")


def test_same_day_opening_precedes_activity_and_ids_break_ties_stably(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    account = _account(accounts, "Cash", balance="100")
    activities = ActivityService(accounts.db_path)
    activities.add_activity("expense", "10", "Food", "First", "2026-01-01", account.id)
    activities.adjust_account(account.id, "80", "2026-01-01")
    activities.add_activity("income", "5", "Other", "Last", "2026-01-01", account.id)

    assert accounts.get_resolved_account(account.id, "2026-01-01").balance == Decimal("85.00")


def test_negative_balances_have_attention_states_without_arithmetic_changes(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    asset = _account(accounts, "Checking", balance="0")
    liability = _account(accounts, "Card", "liability", "0")
    activities = ActivityService(accounts.db_path)
    activities.add_activity("expense", "25", "Food", "Overdraft", "2026-01-02", asset.id)
    activities.add_activity("income", "10", "Refund", "Card credit", "2026-01-02", liability.id)

    assert accounts.get_resolved_account(asset.id, "2026-01-02").balance_state.value == "overdrawn"
    assert (
        accounts.get_resolved_account(liability.id, "2026-01-02").balance_state.value
        == "credit_balance"
    )


def test_account_delete_and_archive_enforce_activity_and_zero_balance_guards(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    unused = _account(accounts, "Unused")
    accounts.delete_account(unused.id)
    assert accounts.list_accounts() == []

    active = _account(accounts, "Active", balance="10")
    with pytest.raises(ValidationError, match="balance must be zero"):
        accounts.archive_account(active.id, "2026-01-02")
    ActivityService(accounts.db_path).adjust_account(active.id, "0", "2026-01-02")
    archived = accounts.archive_account(active.id, "2026-01-02")
    assert archived.archived_on == date(2026, 1, 2)
    assert accounts.get_account(active.id).active is False


def test_net_worth_overview_attributes_cashflow_adjustments_and_zero_transfers(tmp_path):
    accounts = AccountService(tmp_path / "ledger.sqlite3")
    cash = _account(accounts, "Cash", balance="100")
    savings = _account(accounts, "Savings", balance="0")
    activities = ActivityService(accounts.db_path)
    activities.add_activity("income", "50", "Salary", "Pay", "2026-02-01", cash.id)
    activities.add_transfer("20", "Save", "2026-02-02", cash.id, savings.id)
    activities.adjust_account(savings.id, "25", "2026-02-03", "Interest and valuation")
    report_accounts, report_activities = accounts.report_data("2026-02-28")

    overview = build_net_worth_overview(
        report_accounts, report_activities, date(2026, 2, 28), months=2
    )

    assert overview.summary.total_net_worth == Decimal("155.00")
    assert overview.attribution.cashflow == Decimal("50.00")
    assert overview.attribution.adjustments == Decimal("5.00")
    assert overview.attribution.transfers == Decimal("0.00")
