"""Process-local options shared by grouped CLI commands and the TUI launcher."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CliRuntime:
    db_path: Path | None = None
    output: str = "table"
    color: bool = True
    assume_yes: bool = False


_runtime = CliRuntime()


def configure_runtime(runtime: CliRuntime) -> None:
    global _runtime
    _runtime = runtime


def current_runtime() -> CliRuntime:
    return _runtime
