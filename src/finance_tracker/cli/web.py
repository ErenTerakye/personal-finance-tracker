"""Database setup and optional local web-server CLI commands."""

from typing import Annotated

import typer

from finance_tracker.cli.common import DbPathOption
from finance_tracker.config import resolve_db_path
from finance_tracker.services import TransactionService


def init(db_path: DbPathOption = None) -> None:
    """Initialize the SQLite database."""
    resolved_path = resolve_db_path(db_path)
    TransactionService(resolved_path)
    typer.echo(f"Initialized database at {resolved_path}")


def web(
    host: Annotated[
        str,
        typer.Option("--host", help="Host for the local web server"),
    ] = "127.0.0.1",
    port: Annotated[int, typer.Option("--port", help="Port for the local web server")] = 8000,
    db_path: DbPathOption = None,
    reload: Annotated[
        bool,
        typer.Option("--reload", help="Enable auto-reload for development"),
    ] = False,
) -> None:
    """Run the local browser-based finance dashboard."""
    resolved_path = resolve_db_path(db_path)
    try:
        import uvicorn

        from finance_tracker.web.app import create_app
    except ImportError as exc:
        typer.secho(
            "Error: Web dependencies are not installed. "
            'Install them with: python -m pip install -e ".[web]"',
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=1) from exc

    typer.echo(f"Starting finance tracker web UI at http://{host}:{port}")
    typer.echo(f"Using database: {resolved_path}")
    if host not in {"127.0.0.1", "localhost", "::1"}:
        typer.secho(
            "Warning: this unauthenticated local ledger is being exposed beyond loopback.",
            fg=typer.colors.YELLOW,
            err=True,
        )
    if reload:
        import os
        os.environ["FINANCE_TRACKER_DB"] = str(resolved_path)
        uvicorn.run(
            "finance_tracker.web.app:create_app",
            host=host,
            port=port,
            factory=True,
            reload=True,
        )
    else:
        uvicorn.run(create_app(resolved_path), host=host, port=port)
