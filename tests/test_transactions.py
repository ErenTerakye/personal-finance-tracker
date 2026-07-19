from decimal import Decimal

import pytest

from finance_tracker.exceptions import ActivityNotFoundError, ValidationError
from finance_tracker.models import ActivityKind
from finance_tracker.services import (
    AccountService,
    ActivityService,
    CategoryRuleService,
    RecurringTemplateService,
)


def _cash_account(db_path, name="Checking"):
    return AccountService(db_path).create_account(name, "asset", "100", "2026-01-01", "cash")


def test_add_filter_edit_reclassify_and_delete_activity(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    account = _cash_account(db_path)
    service = ActivityService(db_path)
    income = service.add_activity(
        "income", "2500", "Salary", "June salary", "2026-06-01", account.id
    )
    expense = service.add_activity(
        "expense", "45.90", "Food", "Groceries", "2026-06-12", account.id
    )

    assert [item.activity.id for item in service.list_activities(month=6, year=2026)] == [
        expense.activity.id,
        income.activity.id,
    ]
    assert service.list_activities(category="food")[0].activity.amount == Decimal("45.90")
    assert service.list_activities(search="groc")[0].activity.id == expense.activity.id

    updated = service.edit_activity(
        expense.activity.id,
        kind="income",
        amount="50",
        category="Refund",
        description="Grocery refund",
        activity_date="2026-06-13",
        account_id=account.id,
    )
    assert updated.activity.kind is ActivityKind.INCOME
    assert updated.activity.category == "Refund"

    service.delete_activity(updated.activity.id)
    with pytest.raises(ActivityNotFoundError):
        service.get_activity(updated.activity.id)


def test_opening_is_read_only_and_transfer_kind_is_immutable(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    source = _cash_account(db_path, "Checking")
    destination = _cash_account(db_path, "Savings")
    service = ActivityService(db_path)
    opening = service.list_activities(kind="opening")[0]
    transfer = service.add_transfer("25", "Save", "2026-01-02", source.id, destination.id)

    with pytest.raises(ValidationError, match="cannot be deleted"):
        service.delete_activity(opening.activity.id)
    with pytest.raises(ValidationError, match="kind cannot change"):
        service.edit_activity(
            transfer.activity.id,
            kind="expense",
            amount="25",
            category="Other",
            description="",
            activity_date="2026-01-02",
            account_id=source.id,
        )


def test_category_rules_apply_to_activity_and_recurring_transfer_duplicates(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    source = _cash_account(db_path, "Checking")
    destination = _cash_account(db_path, "Savings")
    CategoryRuleService(db_path).set_rule("groceries", "Food")
    activity = ActivityService(db_path).add_activity(
        "expense", "10", "groceries", "Market", "2026-02-01", source.id
    )
    recurring = RecurringTemplateService(db_path)
    recurring.add_template(
        "transfer",
        "20",
        None,
        "Monthly saving",
        28,
        from_account_id=source.id,
        to_account_id=destination.id,
    )

    first = recurring.apply_templates(2, 2026)
    second = recurring.apply_templates(2, 2026)

    assert activity.activity.category == "Food"
    assert len(first.created) == 1
    assert second.skipped_duplicates == 1


def test_decimal_safe_activity_boundary(tmp_path):
    db_path = tmp_path / "ledger.sqlite3"
    account = _cash_account(db_path)
    service = ActivityService(db_path)
    stored = service.add_activity(
        "income", "90071992547409.91", "Other", "Boundary", "2026-01-02", account.id
    )
    assert stored.activity.amount == Decimal("90071992547409.91")
    with pytest.raises(ValidationError, match="no greater than"):
        service.add_activity(
            "income", "90071992547409.92", "Other", "Too large", "2026-01-02", account.id
        )
