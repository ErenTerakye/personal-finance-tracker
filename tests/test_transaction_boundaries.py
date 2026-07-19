import ast
from pathlib import Path

import pytest

from finance_tracker.repositories.activities import ActivityRepository
from finance_tracker.services import AccountService, ActivityService


def test_account_creation_rolls_back_if_opening_activity_write_fails(tmp_path, monkeypatch):
    db_path = tmp_path / "ledger.sqlite3"

    def fail_add(self, activity):
        raise RuntimeError("forced opening failure")

    monkeypatch.setattr(ActivityRepository, "add", fail_add)
    with pytest.raises(RuntimeError, match="forced opening failure"):
        AccountService(db_path).create_account("Checking", "asset", "100", "2026-01-01", "cash")
    assert AccountService(db_path).list_accounts() == []


def test_activity_writes_roll_back_if_posting_insert_fails(tmp_path, monkeypatch):
    db_path = tmp_path / "ledger.sqlite3"
    account = AccountService(db_path).create_account(
        "Checking", "asset", "100", "2026-01-01", "cash"
    )
    original = ActivityRepository._add_postings

    def fail_postings(self, activity_id, postings):
        raise RuntimeError("forced posting failure")

    monkeypatch.setattr(ActivityRepository, "_add_postings", fail_postings)
    with pytest.raises(RuntimeError, match="forced posting failure"):
        ActivityService(db_path).add_activity(
            "expense", "10", "Food", "Lunch", "2026-01-02", account.id
        )
    monkeypatch.setattr(ActivityRepository, "_add_postings", original)
    assert ActivityService(db_path).count_activities() == 1


def test_repositories_do_not_commit_or_roll_back():
    violations = []
    for path in Path("src/finance_tracker/repositories").glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in {"commit", "rollback"}:
                violations.append(f"{path}:{node.lineno}")
    assert violations == []
