"""Inline, command-scoped home experience for interactive terminal use."""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Callable
from datetime import date
from pathlib import Path

import typer

from finance_tracker.cli.accounts import account_balance_check_in
from finance_tracker.cli.budgets import budget_status
from finance_tracker.cli.common import account_service
from finance_tracker.cli.overview import _json_data
from finance_tracker.cli.runtime import current_runtime
from finance_tracker.cli.transactions import add, list_transactions
from finance_tracker.config import resolve_db_path
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import format_money
from finance_tracker.services import OverviewService


def is_interactive_terminal() -> bool:
    """Return whether the inline home may safely ask for input."""
    return (
        sys.stdin.isatty()
        and sys.stdout.isatty()
        and os.environ.get("TERM", "").lower() != "dumb"
    )


def open_inline_home(*, launch_workspace: Callable[[Path | None], None]) -> None:
    """Render the ledger snapshot and optionally run one focused action."""
    runtime = current_runtime()
    today = date.today()
    try:
        snapshot = OverviewService(resolve_db_path(runtime.db_path)).get(today.month, today.year)
    except FinanceTrackerError as exc:
        _write_error(exc)

    if runtime.output == "json":
        typer.echo(json.dumps({"ok": True, "data": _json_data(snapshot)}))
        return

    if not is_interactive_terminal():
        _render_snapshot(snapshot)
        _render_command_hints()
        return

    action = _launch_menu(snapshot)
    _run_action(action, launch_workspace)


def _render_snapshot(snapshot) -> None:
    report = snapshot.report
    attention_count = sum(status.status != "ok" for status in snapshot.budget_statuses)
    typer.secho("Finance Tracker", bold=True)
    typer.echo(f"{snapshot.year}-{snapshot.month:02d} · {snapshot.currency}")
    typer.echo("")
    typer.echo(
        f"Income      {format_money(report.total_income, snapshot.currency)}\n"
        f"Expenses    {format_money(report.total_expenses, snapshot.currency)}\n"
        f"Net         {format_money(report.net_savings, snapshot.currency)}\n"
        f"Net worth   {format_money(snapshot.net_worth.total_net_worth, snapshot.currency)}"
    )
    typer.echo("")
    typer.echo(
        f"{report.transaction_count} transactions · "
        f"{attention_count} budgets need attention"
    )
    if snapshot.recent_transactions:
        typer.echo("")
        typer.secho("Recent", bold=True)
        for transaction in snapshot.recent_transactions[:3]:
            marker = "+" if transaction.type.value == "income" else "−"
            description = transaction.description or transaction.category
            amount = format_money(transaction.amount, snapshot.currency)
            typer.echo(
                f"{transaction.date.isoformat()}  {marker}{amount}  {description}"
            )


def _render_command_hints() -> None:
    typer.echo("")
    typer.echo("Next: transaction add · transaction list · budget status")
    typer.echo("      account balance check-in")
    typer.echo("Workspace: finance-tracker tui")


def _launch_menu(snapshot) -> str | None:
    from finance_tracker.tui.home import FinanceTrackerHome

    app = FinanceTrackerHome(snapshot)
    app.no_color = app.no_color or not current_runtime().color
    return app.run(inline=True, inline_no_clear=True)


def _run_action(action: str | None, launch_workspace: Callable[[Path | None], None]) -> None:
    if action is None:
        return
    if action == "add":
        _guided_transaction_add()
        return
    if action == "transactions":
        today = date.today()
        list_transactions(month=today.month, year=today.year, db_path=current_runtime().db_path)
        return
    if action == "budgets":
        today = date.today()
        budget_status(month=today.month, year=today.year, db_path=current_runtime().db_path)
        return
    if action == "balances":
        _guided_balance_check_in()
        return
    if action == "workspace":
        launch_workspace(current_runtime().db_path)


def _guided_transaction_add() -> None:
    typer.echo("")
    typer.secho("Add transaction", bold=True)
    transaction_type = typer.prompt("Type (income/expense)", default="expense")
    amount = typer.prompt("Amount")
    category = typer.prompt("Category")
    description = typer.prompt("Description", default="", show_default=False)
    transaction_date = typer.prompt("Date", default=date.today().isoformat())
    typer.echo("")
    add(
        transaction_type=transaction_type,
        amount=amount,
        category=category,
        description=description,
        transaction_date=transaction_date,
        db_path=current_runtime().db_path,
    )


def _guided_balance_check_in() -> None:
    runtime = current_runtime()
    try:
        accounts = account_service(runtime.db_path).list_accounts(include_archived=False)
    except FinanceTrackerError as exc:
        _write_error(exc)
    if not accounts:
        typer.echo("No active accounts found. Create one with 'finance-tracker account add'.")
        return

    typer.echo("")
    typer.secho("Balance check-in", bold=True)
    effective_date = typer.prompt("Date", default=date.today().isoformat())
    balances: list[str] = []
    for item in accounts:
        assert item.account.id is not None
        default = str(item.balance) if item.balance is not None else "0"
        amount = typer.prompt(item.account.name, default=default)
        balances.append(f"{item.account.id}={amount}")
    typer.echo("")
    account_balance_check_in(
        balances=balances,
        effective_date=effective_date,
        db_path=runtime.db_path,
    )


def _write_error(error: FinanceTrackerError) -> None:
    runtime = current_runtime()
    if runtime.output == "json":
        typer.echo(
            json.dumps(
                {
                    "ok": False,
                    "error": {"code": "finance_tracker_error", "message": str(error)},
                }
            ),
            err=True,
        )
    else:
        typer.echo(f"Error: {error}", err=True)
    raise typer.Exit(code=1)
