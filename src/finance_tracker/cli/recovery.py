"""Complete-ledger recovery commands."""

from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.cli.common import DbPathOption, handle_error
from finance_tracker.config import resolve_db_path
from finance_tracker.exceptions import FinanceTrackerError, ValidationError
from finance_tracker.services import LedgerRecoveryService


def ledger_backup(
    destination: Annotated[Path, typer.Argument(help="Destination SQLite backup file")],
    overwrite: Annotated[
        bool, typer.Option("--overwrite", help="Replace an existing backup file")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Create a consistent backup of the complete ledger."""
    try:
        result = LedgerRecoveryService(resolve_db_path(db_path)).backup(
            destination, overwrite=overwrite
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Backed up complete ledger to {result.path} "
        f"(schema {result.schema_version}, integrity {result.integrity})."
    )


def ledger_verify(
    backup_path: Annotated[Path, typer.Argument(help="SQLite ledger or backup to verify")],
) -> None:
    """Check a ledger's integrity and supported schema version."""
    try:
        result = LedgerRecoveryService.verify(backup_path)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Verified {result.path}: schema {result.schema_version}, integrity {result.integrity}."
    )


def ledger_restore(
    backup_path: Annotated[Path, typer.Argument(help="Complete-ledger backup to restore")],
    confirm: Annotated[
        bool, typer.Option("--confirm", help="Confirm replacement of the active ledger")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Atomically replace the active ledger from a verified backup."""
    if not confirm:
        handle_error(ValidationError("Use --confirm to replace the active ledger."))
    active_path = resolve_db_path(db_path)
    try:
        result = LedgerRecoveryService(active_path).restore(backup_path)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Restored complete ledger to {result.path} "
        f"(schema {result.schema_version}, integrity {result.integrity})."
    )
