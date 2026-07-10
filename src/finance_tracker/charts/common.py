"""Shared headless Matplotlib configuration."""

import os
import tempfile
from pathlib import Path


def configure_matplotlib() -> None:
    cache_dir = Path(tempfile.gettempdir()) / "finance-tracker-matplotlib"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(cache_dir))
    os.environ.setdefault("MPLBACKEND", "Agg")
