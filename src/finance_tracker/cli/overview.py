"""Compact non-interactive ledger overview."""

from __future__ import annotations

import json
from datetime import date
from typing import Annotated

import typer

from finance_tracker.cli.runtime import current_runtime
from finance_tracker.config import resolve_db_path
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.reports import format_money
from finance_tracker.services import OverviewService


def overview(
    month: Annotated[int | None, typer.Option("--month", "-m")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y")] = None,
) -> None:
    """Show the selected month's cash flow, budget pressure, and net worth."""
    today = date.today()
    resolved_month = month or today.month
    resolved_year = year or today.year
    runtime = current_runtime()
    try:
        snapshot = OverviewService(resolve_db_path(runtime.db_path)).get(
            resolved_month, resolved_year
        )
    except FinanceTrackerError as exc:
        if runtime.output == "json":
            typer.echo(
                json.dumps(
                    {"ok": False, "error": {"code": "finance_tracker_error", "message": str(exc)}}
                ),
                err=True,
            )
        else:
            typer.echo(f"Error: {exc}", err=True)
        raise typer.Exit(code=1) from exc
    if runtime.output == "json":
        typer.echo(json.dumps({"ok": True, "data": _json_data(snapshot)}))
        return
    report = snapshot.report
    typer.echo(f"Ledger overview · {snapshot.year}-{snapshot.month:02d} · {snapshot.currency}")
    typer.echo(
        f"Income {format_money(report.total_income, snapshot.currency)}  "
        f"Expenses {format_money(report.total_expenses, snapshot.currency)}  "
        f"Net {format_money(report.net_savings, snapshot.currency)}"
    )
    typer.echo(
        f"Net worth {format_money(snapshot.net_worth.total_net_worth, snapshot.currency)}  "
        f"Transactions {report.transaction_count}  "
        f"Budgets needing attention "
        f"{sum(item.status != 'ok' for item in snapshot.budget_statuses)}"
    )


def _json_data(snapshot) -> dict[str, object]:
    return {
        "month": snapshot.month,
        "year": snapshot.year,
        "currency": snapshot.currency,
        "report": {
            "total_income": str(snapshot.report.total_income),
            "total_expenses": str(snapshot.report.total_expenses),
            "net_savings": str(snapshot.report.net_savings),
            "transaction_count": snapshot.report.transaction_count,
        },
        "net_worth": {
            "as_of": snapshot.net_worth.as_of.isoformat(),
            "assets": str(snapshot.net_worth.total_assets),
            "liabilities": str(snapshot.net_worth.total_liabilities),
            "total": str(snapshot.net_worth.total_net_worth),
        },
        "budget_attention_count": sum(item.status != "ok" for item in snapshot.budget_statuses),
        "recent_activities": [
            {
                "id": item.activity.id,
                "date": item.activity.date.isoformat(),
                "kind": item.activity.kind.value,
                "amount": str(item.activity.amount),
                "category": item.activity.category,
                "description": item.activity.description,
                "accounts": [effect.account_name for effect in item.effects],
            }
            for item in snapshot.recent_activities
        ],
    }
