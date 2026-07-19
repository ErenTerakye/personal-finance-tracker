"""SQLite connection setup and the schema-v3 activity ledger."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import TracebackType
from typing import Literal

SCHEMA_VERSION = 3
BUSY_TIMEOUT_MS = 5_000

SCHEMA_SQL = """
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability')),
    subtype TEXT NOT NULL CHECK (
        (type = 'asset' AND subtype IN ('cash', 'investment', 'property', 'other')) OR
        (type = 'liability' AND subtype IN ('credit_card', 'loan', 'other'))
    ),
    archived_on TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_accounts_name ON accounts(name COLLATE NOCASE);
CREATE INDEX idx_accounts_type_active ON accounts(type, archived_on);

CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (
        kind IN ('opening', 'income', 'expense', 'transfer', 'adjustment')
    ),
    amount TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL DEFAULT '',
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (kind IN ('income', 'expense') AND category IS NOT NULL AND LENGTH(TRIM(category)) > 0)
        OR (kind IN ('opening', 'transfer', 'adjustment') AND category IS NULL)
    )
);

CREATE TABLE activity_postings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    posting_kind TEXT NOT NULL CHECK (posting_kind IN ('delta', 'set_balance')),
    role TEXT NOT NULL CHECK (role IN ('account', 'source', 'destination')),
    amount TEXT NOT NULL,
    FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    UNIQUE (activity_id, role),
    UNIQUE (activity_id, account_id),
    CHECK (
        (posting_kind = 'set_balance' AND role = 'account') OR
        posting_kind = 'delta'
    )
);

CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year > 0),
    amount TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recurring_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
    amount TEXT NOT NULL,
    category TEXT,
    description TEXT NOT NULL DEFAULT '',
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    account_id INTEGER,
    from_account_id INTEGER,
    to_account_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CHECK (
        (kind IN ('income', 'expense') AND category IS NOT NULL
            AND account_id IS NOT NULL AND from_account_id IS NULL AND to_account_id IS NULL)
        OR
        (kind = 'transfer' AND category IS NULL AND account_id IS NULL
            AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL
            AND from_account_id <> to_account_id)
    )
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX idx_activities_date ON activities(effective_date, id);
CREATE INDEX idx_activities_kind ON activities(kind);
CREATE INDEX idx_activities_category ON activities(category COLLATE NOCASE);
CREATE INDEX idx_activities_filter
ON activities(effective_date, category COLLATE NOCASE, kind);
CREATE INDEX idx_activity_postings_account
ON activity_postings(account_id, activity_id);
CREATE INDEX idx_activity_duplicate
ON activities(kind, amount, category COLLATE NOCASE, description, effective_date);
CREATE INDEX idx_budgets_period ON budgets(year, month);
CREATE UNIQUE INDEX idx_budgets_period_category
ON budgets(year, month, LOWER(category));
CREATE UNIQUE INDEX idx_category_rules_alias
ON category_rules(LOWER(alias));
CREATE INDEX idx_recurring_templates_active
ON recurring_templates(active);
"""

# Kept as a tuple because recovery and migration rollback tests exercise the public
# migration surface. Schema v3 is a clean break, so only an empty ledger executes it.
MIGRATIONS: tuple[str, ...] = (SCHEMA_SQL,)

_V3_TABLE_COLUMNS: dict[str, tuple[str, ...]] = {
    "accounts": ("id", "name", "type", "subtype", "archived_on", "created_at"),
    "activities": (
        "id",
        "kind",
        "amount",
        "category",
        "description",
        "effective_date",
        "created_at",
        "updated_at",
    ),
    "activity_postings": (
        "id",
        "activity_id",
        "account_id",
        "posting_kind",
        "role",
        "amount",
    ),
    "budgets": ("id", "category", "month", "year", "amount", "created_at"),
    "category_rules": ("id", "alias", "category", "created_at"),
    "recurring_templates": (
        "id",
        "kind",
        "amount",
        "category",
        "description",
        "day_of_month",
        "account_id",
        "from_account_id",
        "to_account_id",
        "active",
        "created_at",
    ),
    "settings": ("key", "value"),
}

_V3_INDEXES = frozenset(
    {
        "idx_accounts_name",
        "idx_accounts_type_active",
        "idx_activities_date",
        "idx_activities_kind",
        "idx_activities_category",
        "idx_activities_filter",
        "idx_activity_postings_account",
        "idx_activity_duplicate",
        "idx_budgets_period",
        "idx_budgets_period_category",
        "idx_category_rules_alias",
        "idx_recurring_templates_active",
    }
)

_V3_FOREIGN_KEYS: dict[str, frozenset[tuple[str, str, str, str]]] = {
    "activity_postings": frozenset(
        {
            ("activity_id", "activities", "id", "CASCADE"),
            ("account_id", "accounts", "id", "RESTRICT"),
        }
    ),
    "recurring_templates": frozenset(
        {
            ("account_id", "accounts", "id", "RESTRICT"),
            ("from_account_id", "accounts", "id", "RESTRICT"),
            ("to_account_id", "accounts", "id", "RESTRICT"),
        }
    ),
}


class _ClosingConnection(sqlite3.Connection):
    """Make direct ``with connect(...)`` usage own and close its handle."""

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> Literal[False]:
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def _configure(connection: sqlite3.Connection) -> None:
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA synchronous = NORMAL")


def connect(db_path: Path | str) -> sqlite3.Connection:
    """Open a configured PEP 249 transaction-managed connection."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(
        path,
        timeout=BUSY_TIMEOUT_MS / 1_000,
        autocommit=True,
        factory=_ClosingConnection,
    )
    _configure(connection)
    connection.autocommit = False
    return connection


@contextmanager
def transaction(db_path: Path | str) -> Iterator[sqlite3.Connection]:
    """Own one configured connection and its complete transaction lifecycle."""
    connection = connect(db_path)
    try:
        yield connection
    except BaseException:
        connection.rollback()
        raise
    else:
        connection.commit()
    finally:
        connection.close()


def initialize_database(db_path: Path | str) -> None:
    """Create schema v3, rejecting older ledgers without mutating them."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=BUSY_TIMEOUT_MS / 1_000, autocommit=True)
    try:
        _configure(connection)
        current_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        object_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM sqlite_schema "
                "WHERE name NOT LIKE 'sqlite_%' AND type IN ('table', 'index')"
            ).fetchone()[0]
        )
        if current_version == SCHEMA_VERSION:
            return
        if current_version > SCHEMA_VERSION:
            raise RuntimeError(
                f"Database schema version {current_version} is newer than supported "
                f"version {SCHEMA_VERSION}."
            )
        if current_version in {1, 2} or (current_version == 0 and object_count):
            declared = (
                f"schema version {current_version}"
                if current_version
                else "an old unversioned schema"
            )
            raise RuntimeError(
                f"This ledger uses {declared}. Schema v3 is an intentional clean break; "
                "back up this file, then create a new ledger and rebuild or import "
                "its activity data."
            )
        connection.execute("BEGIN IMMEDIATE")
        try:
            for migration in MIGRATIONS:
                connection.executescript(migration)
            connection.execute("INSERT INTO settings (key, value) VALUES ('currency', 'USD')")
            connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
            connection.execute("COMMIT")
        except Exception:
            if connection.in_transaction:
                connection.execute("ROLLBACK")
            raise
    finally:
        connection.close()


def schema_contract_violations(
    connection: sqlite3.Connection, schema_version: int
) -> tuple[str, ...]:
    """Return application-schema mismatches for the current ledger format."""
    if schema_version != SCHEMA_VERSION:
        return (f"unsupported schema version {schema_version}",)

    violations: list[str] = []
    rows = connection.execute(
        "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'index')"
    ).fetchall()
    objects = {(str(row[0]), str(row[1])) for row in rows}
    for table, expected_columns in _V3_TABLE_COLUMNS.items():
        if (table, "table") not in objects:
            violations.append(f"missing table {table}")
            continue
        actual_columns = tuple(
            str(row[1]) for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        )
        if actual_columns != expected_columns:
            violations.append(
                f"table {table} columns are {actual_columns!r}; expected {expected_columns!r}"
            )
    violations.extend(
        f"missing index {index}" for index in sorted(_V3_INDEXES) if (index, "index") not in objects
    )
    for table, required in _V3_FOREIGN_KEYS.items():
        if (table, "table") not in objects:
            continue
        actual = {
            (str(row[3]), str(row[2]), str(row[4]), str(row[6]))
            for row in connection.execute(f'PRAGMA foreign_key_list("{table}")').fetchall()
        }
        for source, target_table, target_column, on_delete in sorted(required - actual):
            violations.append(
                f"missing foreign key {table}.{source} -> {target_table}.{target_column} "
                f"ON DELETE {on_delete}"
            )
    return tuple(violations)
