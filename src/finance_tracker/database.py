"""SQLite connection setup and ordered schema migrations."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from types import TracebackType
from typing import Literal

SCHEMA_VERSION = 2
BUSY_TIMEOUT_MS = 5_000

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year > 0),
    amount TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_filter
ON transactions(date, LOWER(category), type);
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate
ON transactions(type, amount, LOWER(category), description, date);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(year, month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_period_category
ON budgets(year, month, LOWER(category));
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules_alias
ON category_rules(LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active
ON recurring_templates(active);
"""

ACCOUNT_SCHEMA_SQL = """
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability')),
    archived_on TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE account_balance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    amount TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE (account_id, effective_date)
);

CREATE INDEX idx_accounts_type_active
ON accounts(type, archived_on);

CREATE INDEX idx_account_balance_snapshots_account_date
ON account_balance_snapshots(account_id, effective_date DESC);

CREATE INDEX idx_account_balance_snapshots_date
ON account_balance_snapshots(effective_date);
"""

MIGRATIONS: tuple[str, ...] = (SCHEMA_SQL, ACCOUNT_SCHEMA_SQL)

_V1_TABLE_COLUMNS: dict[str, tuple[str, ...]] = {
    "transactions": ("id", "type", "amount", "category", "description", "date", "created_at"),
    "budgets": ("id", "category", "month", "year", "amount", "created_at"),
    "category_rules": ("id", "alias", "category", "created_at"),
    "recurring_templates": (
        "id",
        "type",
        "amount",
        "category",
        "description",
        "day_of_month",
        "active",
        "created_at",
    ),
    "settings": ("key", "value"),
}

_V2_TABLE_COLUMNS: dict[str, tuple[str, ...]] = {
    **_V1_TABLE_COLUMNS,
    "accounts": ("id", "name", "type", "archived_on", "created_at"),
    "account_balance_snapshots": (
        "id",
        "account_id",
        "amount",
        "effective_date",
        "created_at",
        "updated_at",
    ),
}

_V1_INDEXES = frozenset(
    {
        "idx_transactions_date",
        "idx_transactions_category",
        "idx_transactions_type",
        "idx_transactions_filter",
        "idx_transactions_duplicate",
        "idx_budgets_period",
        "idx_budgets_period_category",
        "idx_category_rules_alias",
        "idx_recurring_templates_active",
    }
)

_V2_INDEXES = _V1_INDEXES | {
    "idx_accounts_type_active",
    "idx_account_balance_snapshots_account_date",
    "idx_account_balance_snapshots_date",
}

SCHEMA_TABLE_COLUMNS: tuple[dict[str, tuple[str, ...]], ...] = (
    _V1_TABLE_COLUMNS,
    _V2_TABLE_COLUMNS,
)
SCHEMA_INDEXES: tuple[frozenset[str], ...] = (_V1_INDEXES, frozenset(_V2_INDEXES))
SCHEMA_FOREIGN_KEYS: tuple[
    dict[str, frozenset[tuple[str, str, str, str]]], ...
] = (
    {},
    {
        "account_balance_snapshots": frozenset(
            {("account_id", "accounts", "id", "CASCADE")}
        )
    },
)


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
    """Apply all missing migrations and preserve existing unversioned v1 ledgers."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=BUSY_TIMEOUT_MS / 1_000, autocommit=True)
    try:
        _configure(connection)
        current_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        if current_version > SCHEMA_VERSION:
            raise RuntimeError(
                f"Database schema version {current_version} is newer than supported "
                f"version {SCHEMA_VERSION}."
            )
        for version, migration in enumerate(MIGRATIONS, start=1):
            if version <= current_version:
                continue
            connection.execute("BEGIN IMMEDIATE")
            try:
                connection.executescript(migration)
                connection.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'USD')"
                )
                connection.execute(f"PRAGMA user_version = {version}")
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
    """Return application-schema mismatches for a supported declared version."""
    if not 1 <= schema_version <= SCHEMA_VERSION:
        return (f"unsupported schema version {schema_version}",)

    violations: list[str] = []
    required_tables = SCHEMA_TABLE_COLUMNS[schema_version - 1]
    rows = connection.execute(
        "SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'index')"
    ).fetchall()
    objects = {(str(row[0]), str(row[1])) for row in rows}

    for table, expected_columns in required_tables.items():
        if (table, "table") not in objects:
            violations.append(f"missing table {table}")
            continue
        actual_columns = tuple(
            str(row[1])
            for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()
        )
        if actual_columns != expected_columns:
            violations.append(
                f"table {table} columns are {actual_columns!r}; "
                f"expected {expected_columns!r}"
            )

    missing_indexes = sorted(
        index
        for index in SCHEMA_INDEXES[schema_version - 1]
        if (index, "index") not in objects
    )
    violations.extend(f"missing index {index}" for index in missing_indexes)
    for table, required_foreign_keys in SCHEMA_FOREIGN_KEYS[schema_version - 1].items():
        if (table, "table") not in objects:
            continue
        actual_foreign_keys = {
            (str(row[3]), str(row[2]), str(row[4]), str(row[6]))
            for row in connection.execute(
                f'PRAGMA foreign_key_list("{table}")'
            ).fetchall()
        }
        missing_foreign_keys = sorted(required_foreign_keys - actual_foreign_keys)
        violations.extend(
            f"missing foreign key {table}.{source} -> {target_table}.{target_column} "
            f"ON DELETE {on_delete}"
            for source, target_table, target_column, on_delete in missing_foreign_keys
        )
    return tuple(violations)
