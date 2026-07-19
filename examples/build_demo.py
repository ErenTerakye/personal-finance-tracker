"""Build the deterministic portfolio demo database from inspectable example data."""

from __future__ import annotations

import argparse
import calendar
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
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


BalanceHistory = tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class BalanceVariation:
    seed: int
    fixed_amount: Decimal = Decimal("0.00")
    balance_ratio: Decimal = Decimal("0.00")


BALANCE_VARIATIONS = {
    "Everyday checking": BalanceVariation(11, fixed_amount=Decimal("650.00")),
    "Emergency fund": BalanceVariation(23, fixed_amount=Decimal("350.00")),
    "Retirement portfolio": BalanceVariation(
        37,
        fixed_amount=Decimal("250.00"),
        balance_ratio=Decimal("0.055"),
    ),
    "Brokerage account": BalanceVariation(
        53,
        fixed_amount=Decimal("100.00"),
        balance_ratio=Decimal("0.075"),
    ),
    "Education loan": BalanceVariation(71, fixed_amount=Decimal("160.00")),
    "Rewards credit card": BalanceVariation(89, fixed_amount=Decimal("520.00")),
    "Previous checking account": BalanceVariation(107, fixed_amount=Decimal("300.00")),
}


def _month_index(value: date) -> int:
    return value.year * 12 + value.month - 1


def _month_end(index: int) -> date:
    year, zero_based_month = divmod(index, 12)
    month = zero_based_month + 1
    return date(year, month, calendar.monthrange(year, month)[1])


def _interpolate_monthly_history(
    anchors: tuple[tuple[str, str], ...],
    variation: BalanceVariation,
) -> BalanceHistory:
    """Expand milestone balances into varied, deterministic month-end snapshots."""
    history: list[tuple[str, str]] = []
    for anchor_index, (start_text, start_amount_text) in enumerate(anchors[:-1]):
        end_text, end_amount_text = anchors[anchor_index + 1]
        start = date.fromisoformat(start_text)
        end = date.fromisoformat(end_text)
        start_month = _month_index(start)
        end_month = _month_index(end)
        span = end_month - start_month
        if span <= 0:
            raise ValueError("Demo balance anchors must be in increasing month order.")
        start_amount = Decimal(start_amount_text)
        end_amount = Decimal(end_amount_text)
        for offset in range(span):
            amount = start_amount + (end_amount - start_amount) * Decimal(offset) / span
            if offset:
                distance_from_anchor = min(offset, span - offset, 3)
                anchor_weight = Decimal(distance_from_anchor) / Decimal(3)
                variation_scale = (
                    variation.fixed_amount + amount * variation.balance_ratio
                )
                amount += (
                    variation_scale
                    * _monthly_variation(start_month + offset, variation.seed)
                    * anchor_weight
                )
                amount = max(amount, Decimal("0.00"))
            history.append(
                (
                    _month_end(start_month + offset).isoformat(),
                    str(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                )
            )
    final_date, final_amount = anchors[-1]
    history.append((final_date, final_amount))
    return tuple(history)


def _monthly_variation(month_index: int, seed: int) -> Decimal:
    """Return stable, irregular variation in roughly the -1..1 range."""
    current = _variation_sample(month_index, seed)
    previous = _variation_sample(month_index - 1, seed)
    return current * Decimal("0.80") + previous * Decimal("0.20")


def _variation_sample(month_index: int, seed: int) -> Decimal:
    mixed = (month_index * 1_103_515_245 + seed * 12_345 + seed * month_index * 97) & 0x7FFFFFFF
    return Decimal(mixed % 2001 - 1000) / Decimal(1000)


# These milestones tell a ten-year, early-career financial story. Monthly interpolation keeps the
# generated SQLite data compact here while giving every point in the 120-month chart real coverage.
HISTORICAL_BALANCE_ANCHORS = {
    "Everyday checking": (
        ("2016-08-31", "1450.00"),
        ("2017-07-31", "1720.00"),
        ("2018-07-31", "2050.00"),
        ("2019-07-31", "2380.00"),
        ("2020-03-31", "2140.00"),
        ("2020-07-31", "2680.00"),
        ("2021-07-31", "3460.00"),
        ("2022-07-31", "2910.00"),
        ("2023-07-31", "3380.00"),
        ("2024-07-31", "2840.00"),
        ("2025-07-31", "3020.00"),
    ),
    "Emergency fund": (
        ("2016-08-31", "1800.00"),
        ("2017-07-31", "2450.00"),
        ("2018-07-31", "3300.00"),
        ("2019-07-31", "4250.00"),
        ("2020-03-31", "5100.00"),
        ("2020-07-31", "5350.00"),
        ("2021-07-31", "6400.00"),
        ("2022-07-31", "7100.00"),
        ("2023-07-31", "7900.00"),
        ("2024-07-31", "8650.00"),
        ("2025-07-31", "9500.00"),
    ),
    "Retirement portfolio": (
        ("2016-08-31", "5200.00"),
        ("2017-07-31", "7150.00"),
        ("2018-07-31", "9450.00"),
        ("2019-07-31", "12100.00"),
        ("2020-02-29", "13950.00"),
        ("2020-03-31", "11780.00"),
        ("2020-07-31", "14600.00"),
        ("2021-07-31", "20500.00"),
        ("2022-01-31", "22650.00"),
        ("2022-06-30", "19400.00"),
        ("2022-07-31", "20250.00"),
        ("2023-07-31", "22900.00"),
        ("2024-07-31", "25800.00"),
        ("2025-07-31", "28150.00"),
    ),
    "Brokerage account": (
        ("2016-08-31", "600.00"),
        ("2017-07-31", "850.00"),
        ("2018-07-31", "1150.00"),
        ("2019-07-31", "1500.00"),
        ("2020-03-31", "1275.00"),
        ("2020-07-31", "1720.00"),
        ("2021-07-31", "2600.00"),
        ("2022-06-30", "2280.00"),
        ("2022-07-31", "2360.00"),
        ("2023-07-31", "3050.00"),
        ("2024-07-31", "3780.00"),
        ("2025-07-31", "4450.00"),
    ),
    "Education loan": (
        ("2016-08-31", "27800.00"),
        ("2017-07-31", "26100.00"),
        ("2018-07-31", "23900.00"),
        ("2019-07-31", "21600.00"),
        ("2020-07-31", "19500.00"),
        ("2021-07-31", "17400.00"),
        ("2022-07-31", "15500.00"),
        ("2023-07-31", "13700.00"),
        ("2024-07-31", "12050.00"),
        ("2025-07-31", "10600.00"),
    ),
    "Rewards credit card": (
        ("2016-08-31", "540.00"),
        ("2017-07-31", "390.00"),
        ("2018-07-31", "720.00"),
        ("2019-07-31", "460.00"),
        ("2020-07-31", "310.00"),
        ("2021-07-31", "590.00"),
        ("2022-07-31", "780.00"),
        ("2023-07-31", "430.00"),
        ("2024-07-31", "690.00"),
        ("2025-07-31", "640.00"),
    ),
    "Previous checking account": (
        ("2016-08-31", "1850.00"),
        ("2017-07-31", "2100.00"),
        ("2018-07-31", "1980.00"),
        ("2019-07-31", "2250.00"),
        ("2020-07-31", "2050.00"),
        ("2021-07-31", "1880.00"),
        ("2022-07-31", "1720.00"),
        ("2023-07-31", "1560.00"),
        ("2024-07-31", "1420.00"),
        ("2025-07-31", "1320.00"),
    ),
}


def _history_with_recent_values(account_name: str, recent_values: BalanceHistory) -> BalanceHistory:
    return (
        _interpolate_monthly_history(
            HISTORICAL_BALANCE_ANCHORS[account_name],
            BALANCE_VARIATIONS[account_name],
        )
        + recent_values
    )


ACCOUNT_HISTORIES = (
    (
        "Everyday checking",
        "asset",
        _history_with_recent_values(
            "Everyday checking",
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
    ),
    (
        "Emergency fund",
        "asset",
        _history_with_recent_values(
            "Emergency fund",
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
    ),
    (
        "Retirement portfolio",
        "asset",
        _history_with_recent_values(
            "Retirement portfolio",
            (
                ("2025-08-31", "28750.00"),
                ("2025-09-30", "29120.00"),
                ("2025-10-31", "27800.00"),
                ("2025-11-30", "30540.00"),
                ("2025-12-31", "31750.00"),
                ("2026-01-31", "30950.00"),
                ("2026-02-28", "32940.00"),
                ("2026-03-31", "32200.00"),
                ("2026-04-30", "34510.00"),
                ("2026-05-31", "33000.00"),
                ("2026-06-30", "36180.00"),
                (DEMO_AS_OF, "36840.00"),
            ),
        ),
    ),
    (
        "Brokerage account",
        "asset",
        _history_with_recent_values(
            "Brokerage account",
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
    ),
    (
        "Education loan",
        "liability",
        _history_with_recent_values(
            "Education loan",
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
    ),
    (
        "Rewards credit card",
        "liability",
        _history_with_recent_values(
            "Rewards credit card",
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
    ),
)

ARCHIVED_ACCOUNT = (
    "Previous checking account",
    "asset",
    _history_with_recent_values(
        "Previous checking account",
        (
            ("2025-08-31", "1250.00"),
            ("2025-12-31", "640.00"),
            ("2026-03-15", "125.00"),
        ),
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
