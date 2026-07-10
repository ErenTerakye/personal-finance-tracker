"""Ledger settings CLI commands."""

from typing import Annotated

import typer

from finance_tracker.cli.common import DbPathOption, handle_error, settings_service
from finance_tracker.exceptions import FinanceTrackerError


def settings_get(
    key: Annotated[str, typer.Argument(help="Setting key to fetch (e.g. currency)")],
    db_path: DbPathOption = None,
) -> None:
    """Get a database setting value."""
    try:
        service = settings_service(db_path)
        if key == "currency":
            val = service.get_currency()
        else:
            typer.secho(
                f"Error: Unknown setting key '{key}'. Supported key: currency",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(val)


def settings_set(
    key: Annotated[str, typer.Argument(help="Setting key to update (e.g. currency)")],
    value: Annotated[str, typer.Argument(help="New value for the setting")],
    db_path: DbPathOption = None,
) -> None:
    """Set a database setting value."""
    try:
        service = settings_service(db_path)
        if key == "currency":
            val = service.set_currency(value)
        else:
            typer.secho(
                f"Error: Unknown setting key '{key}'. Supported key: currency",
                fg=typer.colors.RED,
                err=True,
            )
            raise typer.Exit(code=1)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Set setting '{key}' to '{val}'.")
