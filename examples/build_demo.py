"""Build the deterministic portfolio demo database from inspectable example data."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from finance_tracker.csv_io import import_budgets_csv, import_transactions_csv
from finance_tracker.services import (
    AccountService,
    BudgetService,
    CategoryRuleService,
    RecurringTemplateService,
    SettingsService,
    TransactionService,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRANSACTIONS_CSV = PROJECT_ROOT / "examples" / "sample_transactions.csv"
BUDGETS_CSV = PROJECT_ROOT / "examples" / "sample_budgets.csv"
DEMO_MONTH = 7
DEMO_YEAR = 2026
DEMO_AS_OF = "2026-07-16"

CATEGORY_RULES = (
    ("groceries", "Food"),
    ("supermarket", "Food"),
    ("metro", "Transport"),
    ("rideshare", "Transport"),
    ("streaming", "Subscriptions"),
)

RECURRING_TEMPLATES = (
    ("income", "4200.00", "Salary", "Monthly salary deposit", 1),
    ("expense", "1500.00", "Rent", "Apartment rent", 2),
    ("expense", "44.99", "streaming", "Streaming and cloud storage", 20),
    ("expense", "35.00", "Fitness", "Community gym membership", 24),
)

ACCOUNT_HISTORIES = (
    (
        "Everyday checking",
        "asset",
        (
            ("2025-08-31", "3250.00"),
            ("2025-09-30", "3480.00"),
            ("2025-10-31", "3715.00"),
            ("2025-11-30", "4240.00"),
            ("2025-12-31", "5125.00"),
            ("2026-01-31", "4680.00"),
            ("2026-02-28", "4935.00"),
            ("2026-03-31", "5520.00"),
            ("2026-04-30", "5780.00"),
            ("2026-05-31", "6210.00"),
            ("2026-06-30", "6875.00"),
            (DEMO_AS_OF, "7240.00"),
        ),
    ),
    (
        "Emergency fund",
        "asset",
        (
            ("2025-08-31", "9800.00"),
            ("2025-09-30", "10100.00"),
            ("2025-10-31", "10400.00"),
            ("2025-11-30", "10750.00"),
            ("2025-12-31", "11150.00"),
            ("2026-01-31", "11450.00"),
            ("2026-02-28", "11750.00"),
            ("2026-03-31", "12050.00"),
            ("2026-04-30", "12400.00"),
            ("2026-05-31", "12800.00"),
            ("2026-06-30", "13250.00"),
            (DEMO_AS_OF, "13600.00"),
        ),
    ),
    (
        "Retirement portfolio",
        "asset",
        (
            ("2025-08-31", "28750.00"),
            ("2025-09-30", "29120.00"),
            ("2025-10-31", "29880.00"),
            ("2025-11-30", "30540.00"),
            ("2025-12-31", "31750.00"),
            ("2026-01-31", "32380.00"),
            ("2026-02-28", "32940.00"),
            ("2026-03-31", "33820.00"),
            ("2026-04-30", "34510.00"),
            ("2026-05-31", "35240.00"),
            ("2026-06-30", "36180.00"),
            (DEMO_AS_OF, "36840.00"),
        ),
    ),
    (
        "Brokerage account",
        "asset",
        (
            ("2025-08-31", "4600.00"),
            ("2025-10-31", "5050.00"),
            ("2025-12-31", "5480.00"),
            ("2026-02-28", "5925.00"),
            ("2026-04-30", "6410.00"),
            ("2026-06-30", "7020.00"),
            (DEMO_AS_OF, "7185.00"),
        ),
    ),
    (
        "Education loan",
        "liability",
        (
            ("2025-08-31", "10400.00"),
            ("2025-09-30", "10200.00"),
            ("2025-10-31", "10000.00"),
            ("2025-11-30", "9800.00"),
            ("2025-12-31", "9600.00"),
            ("2026-01-31", "9400.00"),
            ("2026-02-28", "9200.00"),
            ("2026-03-31", "9000.00"),
            ("2026-04-30", "8800.00"),
            ("2026-05-31", "8600.00"),
            ("2026-06-30", "8400.00"),
            (DEMO_AS_OF, "8200.00"),
        ),
    ),
    (
        "Rewards credit card",
        "liability",
        (
            ("2025-08-31", "860.00"),
            ("2025-09-30", "420.00"),
            ("2025-10-31", "735.00"),
            ("2025-11-30", "510.00"),
            ("2025-12-31", "980.00"),
            ("2026-01-31", "445.00"),
            ("2026-02-28", "390.00"),
            ("2026-03-31", "620.00"),
            ("2026-04-30", "475.00"),
            ("2026-05-31", "530.00"),
            ("2026-06-30", "710.00"),
            (DEMO_AS_OF, "385.00"),
        ),
    ),
)

ARCHIVED_ACCOUNT = (
    "Previous checking account",
    "asset",
    (
        ("2025-08-31", "1250.00"),
        ("2025-12-31", "640.00"),
        ("2026-03-15", "125.00"),
    ),
    "2026-03-31",
)


@dataclass(frozen=True)
class DemoBuildResult:
    transaction_count: int
    budget_count: int
    category_rule_count: int
    recurring_template_count: int
    recurring_created_count: int
    recurring_duplicate_count: int
    account_count: int
    snapshot_count: int


def build_demo_database(db_path: Path, *, force: bool = False) -> DemoBuildResult:
    """Create a fresh demo ledger through public application services."""
    _prepare_output_path(db_path, force=force)

    settings = SettingsService(db_path)
    settings.set_currency("USD")
    rules = CategoryRuleService(db_path)
    transactions = TransactionService(db_path)
    budgets = BudgetService(db_path)
    recurring = RecurringTemplateService(db_path)
    accounts = AccountService(db_path)

    for alias, category in CATEGORY_RULES:
        rules.set_rule(alias, category)

    transaction_import = import_transactions_csv(TRANSACTIONS_CSV, transactions)
    budget_import = import_budgets_csv(BUDGETS_CSV, budgets)
    if transaction_import.skipped_count or budget_import.skipped_count:
        errors = transaction_import.errors + budget_import.errors
        raise RuntimeError("Demo source data contains invalid rows: " + "; ".join(errors))

    for transaction_type, amount, category, description, day in RECURRING_TEMPLATES:
        recurring.add_template(transaction_type, amount, category, description, day)
    recurring_created = recurring.apply_templates(DEMO_MONTH, DEMO_YEAR)
    recurring_duplicates = recurring.apply_templates(DEMO_MONTH, DEMO_YEAR)

    snapshot_count = 0
    for name, account_type, history in ACCOUNT_HISTORIES:
        first_date, first_amount = history[0]
        account = accounts.create_account(name, account_type, first_amount, first_date)
        assert account.id is not None
        snapshot_count += 1
        for effective_date, amount in history[1:]:
            accounts.set_balance(account.id, amount, effective_date)
            snapshot_count += 1

    archived_name, archived_type, archived_history, archived_on = ARCHIVED_ACCOUNT
    first_date, first_amount = archived_history[0]
    archived = accounts.create_account(
        archived_name, archived_type, first_amount, first_date
    )
    assert archived.id is not None
    snapshot_count += 1
    for effective_date, amount in archived_history[1:]:
        accounts.set_balance(archived.id, amount, effective_date)
        snapshot_count += 1
    accounts.archive_account(
        archived.id,
        archived_on,
        confirm_zero_balance=True,
    )
    snapshot_count += 1

    return DemoBuildResult(
        transaction_count=transactions.count_transactions(),
        budget_count=len(budgets.list_budgets()),
        category_rule_count=len(rules.list_rules()),
        recurring_template_count=len(recurring.list_templates()),
        recurring_created_count=len(recurring_created.created),
        recurring_duplicate_count=recurring_duplicates.skipped_duplicates,
        account_count=len(
            accounts.list_accounts(DEMO_AS_OF, include_archived=True)
        ),
        snapshot_count=snapshot_count,
    )


def _prepare_output_path(db_path: Path, *, force: bool) -> None:
    if db_path.exists() and not force:
        raise FileExistsError(
            f"{db_path} already exists; pass --force to replace this demo database."
        )
    if force:
        for candidate in (
            db_path,
            Path(f"{db_path}-shm"),
            Path(f"{db_path}-wal"),
        ):
            candidate.unlink(missing_ok=True)
    db_path.parent.mkdir(parents=True, exist_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the deterministic Personal Finance Tracker reviewer demo."
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=PROJECT_ROOT / "demo.sqlite3",
        help="Demo database path (default: ./demo.sqlite3)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing demo database and its SQLite sidecar files.",
    )
    args = parser.parse_args()
    result = build_demo_database(args.db_path.resolve(), force=args.force)
    print(f"Built demo database: {args.db_path.resolve()}")
    print(
        f"{result.transaction_count} transactions, {result.budget_count} budgets, "
        f"{result.category_rule_count} category rules, "
        f"{result.recurring_template_count} recurring templates"
    )
    print(
        f"{result.account_count} accounts and {result.snapshot_count} balance snapshots; "
        f"{result.recurring_created_count} July recurring entries created and "
        f"{result.recurring_duplicate_count} duplicate entries safely skipped"
    )


if __name__ == "__main__":
    main()
