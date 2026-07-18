"""Database setup and optional local web-server CLI commands."""

from ipaddress import ip_address
from typing import Annotated

import typer

from finance_tracker.cli.common import DbPathOption
from finance_tracker.config import resolve_db_path
from finance_tracker.services import TransactionService


def _is_loopback_host(host: str) -> bool:
    normalized = host.strip().removeprefix("[").removesuffix("]")
    if normalized.casefold() == "localhost":
        return True
    try:
        return ip_address(normalized).is_loopback
    except ValueError:
        return False


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
    allow_remote_unauthenticated: Annotated[
        bool,
        typer.Option(
            "--allow-remote-unauthenticated",
            help="Explicitly expose the unauthenticated ledger beyond loopback",
        ),
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

    if not _is_loopback_host(host) and not allow_remote_unauthenticated:
        typer.secho(
            "Error: refusing to expose an unauthenticated ledger beyond loopback. "
            "Pass --allow-remote-unauthenticated only when you accept that risk.",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=2)

    typer.echo(f"Starting finance tracker web UI at http://{host}:{port}")
    typer.echo(f"Bind address: {host}")
    typer.echo(f"Database: {resolved_path}")
    if not _is_loopback_host(host):
        typer.secho(
            "Warning: remote unauthenticated access was explicitly enabled.",
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
