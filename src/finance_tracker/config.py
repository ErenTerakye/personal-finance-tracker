"""Runtime configuration helpers."""

import os
from pathlib import Path

DEFAULT_DB_PATH = Path("data/finance_tracker.sqlite3")
DB_ENV_VAR = "FINANCE_TRACKER_DB"


def resolve_db_path(db_path: Path | str | None = None) -> Path:
    if db_path:
        return Path(db_path)
    return Path(os.environ.get(DB_ENV_VAR, DEFAULT_DB_PATH))
