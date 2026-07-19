"""Root callback and explicit terminal-workspace launcher."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.cli.runtime import CliRuntime, configure_runtime, current_runtime


def launch_tui(db_path: Path | None = None) -> None:
    """Launch the full-screen local ledger workspace."""
    if not sys.stdin.isatty() or not sys.stdout.isatty() or os.environ.get("TERM") == "dumb":
        typer.echo(
            "The terminal workspace requires an interactive terminal. "
            "Use a grouped command such as 'finance-tracker overview' instead.",
            err=True,
        )
        raise typer.Exit(code=2)
    from finance_tracker.tui.app import FinanceTrackerTui

    FinanceTrackerTui(db_path=db_path).run()


def root_callback(
    ctx: typer.Context,
    db_path: Annotated[
        Path | None,
        typer.Option(
            "--db-path",
            envvar="FINANCE_TRACKER_DB",
            help="SQLite ledger path shared by the selected command.",
        ),
    ] = None,
    output: Annotated[
        str,
        typer.Option("--output", help="Output format: table or json."),
    ] = "table",
    no_color: Annotated[
        bool,
        typer.Option("--no-color", help="Disable ANSI styling in command output."),
    ] = False,
    yes: Annotated[
        bool,
        typer.Option("--yes", help="Confirm destructive non-interactive operations."),
    ] = False,
) -> None:
    """Open the interactive ledger or run a grouped automation command."""
    normalized_output = output.lower()
    if normalized_output not in {"table", "json"}:
        raise typer.BadParameter("Output must be 'table' or 'json'.", param_hint="--output")
    configure_runtime(
        CliRuntime(
            db_path=db_path,
            output=normalized_output,
            color=not no_color,
            assume_yes=yes,
        )
    )
    if no_color:
        ctx.color = False
    if db_path is not None:
        os.environ["FINANCE_TRACKER_DB"] = str(db_path)
    if ctx.invoked_subcommand is None:
        launch_tui(db_path)


def tui_command() -> None:
    """Open the full-screen terminal workspace."""
    launch_tui(current_runtime().db_path)
