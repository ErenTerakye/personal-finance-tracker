"""SQLite connection setup and ordered schema migrations."""

import sqlite3
from pathlib import Path

SCHEMA_VERSION = 1
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

MIGRATIONS: tuple[str, ...] = (SCHEMA_SQL,)


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
    connection = sqlite3.connect(path, timeout=BUSY_TIMEOUT_MS / 1_000, autocommit=True)
    _configure(connection)
    connection.autocommit = False
    return connection


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
