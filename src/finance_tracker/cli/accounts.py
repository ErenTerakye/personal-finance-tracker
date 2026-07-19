"""Account lifecycle, adjustment, and net-worth CLI commands."""

from datetime import date
from decimal import Decimal
from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    account_service,
    currency,
    format_table,
    handle_error,
)
from finance_tracker.cli.runtime import current_runtime
from finance_tracker.exceptions import FinanceTrackerError, ValidationError
from finance_tracker.models import parse_snapshot_date
from finance_tracker.reports import build_net_worth_history, build_net_worth_summary, format_money


def account_add(
    name: Annotated[str, typer.Option("--name")],
    account_type: Annotated[str, typer.Option("--type", help="asset or liability")],
    subtype: Annotated[
        str,
        typer.Option(
            "--subtype",
            help="cash, investment, property, credit_card, loan, or other",
        ),
    ],
    balance: Annotated[str, typer.Option("--balance", help="Opening balance")],
    effective_date: Annotated[str | None, typer.Option("--date")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Create an account and its read-only opening activity."""
    try:
        resolved_date = parse_snapshot_date(effective_date or date.today())
        account = account_service(db_path).create_account(
            name, account_type, balance, resolved_date, subtype
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Added account #{account.id}: {account.name} "
        f"({account.type.value}/{account.subtype.value}), "
        f"opening {format_money(Decimal(balance), currency(db_path))} "
        f"on {resolved_date.isoformat()}."
    )


def account_list(
    as_of: Annotated[str | None, typer.Option("--as-of")] = None,
    include_archived: Annotated[bool, typer.Option("--include-archived")] = False,
    db_path: DbPathOption = None,
) -> None:
    """List accounts with calculated as-of balances and attention states."""
    try:
        accounts = account_service(db_path).list_accounts(as_of, include_archived=include_archived)
    except FinanceTrackerError as exc:
        handle_error(exc)
    if not accounts:
        typer.echo("No accounts found.")
        return
    currency_code = currency(db_path)
    rows = [
        [
            str(item.account.id),
            item.account.name,
            item.account.type.value,
            item.account.subtype.value,
            format_money(item.balance, currency_code),
            item.balance_state.value,
            item.as_of.isoformat(),
            f"archived {item.account.archived_on}" if item.account.archived_on else "active",
        ]
        for item in accounts
    ]
    for line in format_table(
        ["ID", "Name", "Type", "Subtype", "Balance", "State", "As of", "Status"],
        rows,
        {"Balance"},
    ):
        typer.echo(line)


def account_edit(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    name: Annotated[str | None, typer.Option("--name")] = None,
    subtype: Annotated[str | None, typer.Option("--subtype")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Edit an account name or compatible subtype; type stays immutable."""
    if name is None and subtype is None:
        handle_error(ValidationError("Provide --name or --subtype."))
    try:
        account = account_service(db_path).edit_account(account_id, name=name, subtype=subtype)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Updated account #{account.id}: {account.name} "
        f"({account.type.value}/{account.subtype.value})."
    )


def account_adjust(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    observed_balance: Annotated[str, typer.Argument(help="Observed balance")],
    effective_date: Annotated[str | None, typer.Option("--date")] = None,
    description: Annotated[str, typer.Option("--description", "-d")] = "Balance update",
    db_path: DbPathOption = None,
) -> None:
    """Record an observed balance as an explicit adjustment activity."""
    try:
        record = account_service(db_path).adjust_account(
            account_id,
            observed_balance,
            effective_date or date.today(),
            description,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    effect = record.effects[0]
    typer.echo(
        f"Updated {effect.account_name} balance to "
        f"{format_money(effect.after_balance, currency(db_path))}; "
        f"adjustment {format_money(effect.balance_effect, currency(db_path))} "
        f"in activity #{record.activity.id}."
    )


def account_archive(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    closing_date: Annotated[str | None, typer.Option("--date")] = None,
    confirm: Annotated[bool, typer.Option("--confirm")] = False,
    db_path: DbPathOption = None,
) -> None:
    """Archive an account only when its calculated closing balance is zero."""
    if not (confirm or current_runtime().assume_yes):
        handle_error(ValidationError("Use --confirm to archive an account."))
    try:
        account = account_service(db_path).archive_account(account_id, closing_date or date.today())
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Archived account #{account_id} on {account.archived_on}.")


def account_delete(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    confirm: Annotated[bool, typer.Option("--confirm")] = False,
    db_path: DbPathOption = None,
) -> None:
    """Delete an account that has only its opening activity."""
    if not (confirm or current_runtime().assume_yes):
        handle_error(ValidationError("Use --confirm to permanently delete an account."))
    try:
        account_service(db_path).delete_account(account_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted account #{account_id}.")


def net_worth(
    as_of: Annotated[str | None, typer.Option("--as-of")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print activity-derived assets, liabilities, and net worth."""
    try:
        resolved_date = parse_snapshot_date(as_of or date.today())
        accounts, activities = account_service(db_path).report_data(resolved_date)
        summary = build_net_worth_summary(accounts, activities, resolved_date)
    except FinanceTrackerError as exc:
        handle_error(exc)
    currency_code = currency(db_path)
    typer.echo(f"Net worth as of {summary.as_of.isoformat()} ({currency_code})")
    typer.echo(f"Assets:       {format_money(summary.total_assets, currency_code)}")
    typer.echo(f"Liabilities:  {format_money(summary.total_liabilities, currency_code)}")
    typer.echo(f"Net worth:    {format_money(summary.total_net_worth, currency_code)}")
    typer.echo(
        f"Accounts: {summary.active_account_count} active, "
        f"{summary.archived_account_count} archived; "
        f"{summary.account_state_warning_count} need attention."
    )


def net_worth_history(
    as_of: Annotated[str | None, typer.Option("--as-of")] = None,
    months: Annotated[int, typer.Option("--months")] = 12,
    db_path: DbPathOption = None,
) -> None:
    """Print chronological activity-derived net-worth history."""
    try:
        resolved_date = parse_snapshot_date(as_of or date.today())
        accounts, activities = account_service(db_path).report_data(resolved_date)
        history = build_net_worth_history(accounts, activities, resolved_date, months)
    except FinanceTrackerError as exc:
        handle_error(exc)
    currency_code = currency(db_path)
    rows = [
        [
            point.as_of.isoformat(),
            format_money(point.total_assets, currency_code),
            format_money(point.total_liabilities, currency_code),
            format_money(point.total_net_worth, currency_code),
        ]
        for point in history.points
    ]
    for line in format_table(
        ["As of", "Assets", "Liabilities", "Net worth"],
        rows,
        {"Assets", "Liabilities", "Net worth"},
    ):
        typer.echo(line)
    if history.change_amount is not None:
        suffix = f" ({history.change_percent:+.1f}%)" if history.change_percent is not None else ""
        typer.echo(f"\nLatest change: {format_money(history.change_amount, currency_code)}{suffix}")
