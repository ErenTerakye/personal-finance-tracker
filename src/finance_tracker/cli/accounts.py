"""Account, balance snapshot, and net worth CLI commands."""

from datetime import date
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
from finance_tracker.reports import (
    build_net_worth_history,
    build_net_worth_summary,
    format_money,
)


def account_add(
    name: Annotated[str, typer.Option("--name", help="Account name")],
    account_type: Annotated[
        str, typer.Option("--type", help="Account type: asset or liability")
    ],
    balance: Annotated[
        str, typer.Option("--balance", help="Initial non-negative balance")
    ],
    effective_date: Annotated[
        str | None,
        typer.Option("--date", help="Initial balance date (YYYY-MM-DD)"),
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Create an asset or liability account with an initial balance."""
    try:
        resolved_date = parse_snapshot_date(effective_date or date.today())
        account = account_service(db_path).create_account(
            name, account_type, balance, resolved_date
        )
        assert account.id is not None
        initial_snapshot = account_service(db_path).list_snapshots(account.id)[0]
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(
        f"Added account #{account.id}: {account.name} ({account.type.value}), "
        f"{format_money(initial_snapshot.amount, currency(db_path))} "
        f"on {resolved_date.isoformat()}"
    )


def account_list(
    as_of: Annotated[
        str | None, typer.Option("--as-of", help="Resolve balances as of YYYY-MM-DD")
    ] = None,
    include_archived: Annotated[
        bool, typer.Option("--include-archived", help="Include archived accounts")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """List accounts and their resolved balances."""
    try:
        accounts = account_service(db_path).list_accounts(
            as_of, include_archived=include_archived
        )
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
            (
                format_money(item.balance, currency_code)
                if item.balance is not None
                else "not tracked yet"
            ),
            item.balance_date.isoformat() if item.balance_date else "—",
            (
                f"archived {item.account.archived_on.isoformat()}"
                if item.account.archived_on
                else "active"
            ),
        ]
        for item in accounts
    ]
    for line in format_table(
        ["ID", "Name", "Type", "Balance", "Balance date", "Status"],
        rows,
        {"Balance"},
    ):
        typer.echo(line)


def account_edit(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    name: Annotated[str, typer.Option("--name", help="New account name")],
    db_path: DbPathOption = None,
) -> None:
    """Edit an active account name."""
    try:
        account = account_service(db_path).edit_account_name(account_id, name)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Renamed account #{account.id} to {account.name}.")


def account_balance_set(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    amount: Annotated[str, typer.Argument(help="Non-negative balance")],
    effective_date: Annotated[
        str | None, typer.Option("--date", help="Balance date (YYYY-MM-DD)")
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Create or replace a dated balance snapshot."""
    try:
        result = account_service(db_path).set_balance(
            account_id, amount, effective_date or date.today()
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    action = "Updated" if result.replaced else "Recorded"
    typer.echo(
        f"{action} account #{account_id} balance for "
        f"{result.snapshot.effective_date.isoformat()}: "
        f"{format_money(result.snapshot.amount, currency(db_path))}"
    )


def account_balance_check_in(
    balances: Annotated[
        list[str],
        typer.Option(
            "--balance",
            help="Account balance as ACCOUNT_ID=AMOUNT; repeat for multiple accounts.",
        ),
    ],
    effective_date: Annotated[
        str | None, typer.Option("--date", help="Effective date (YYYY-MM-DD)")
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Record multiple account balances in one atomic check-in."""
    try:
        updates: list[tuple[int, str]] = []
        for value in balances:
            account_id, amount = value.split("=", maxsplit=1)
            updates.append((int(account_id), amount))
        result = account_service(db_path).check_in_balances(
            effective_date or date.today(), updates
        )
    except (FinanceTrackerError, ValueError) as exc:
        if isinstance(exc, FinanceTrackerError):
            handle_error(exc)
        handle_error(ValidationError("Balances must use ACCOUNT_ID=AMOUNT."))
    typer.echo(
        f"Recorded {len(result.snapshots)} balance(s); "
        f"replaced {result.replaced_count} existing snapshot(s)."
    )


def account_balance_list(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    db_path: DbPathOption = None,
) -> None:
    """List an account's balance snapshots newest first."""
    try:
        snapshots = account_service(db_path).list_snapshots(account_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    currency_code = currency(db_path)
    rows = [
        [
            snapshot.effective_date.isoformat(),
            format_money(snapshot.amount, currency_code),
        ]
        for snapshot in snapshots
    ]
    for line in format_table(["Date", "Amount"], rows, {"Amount"}):
        typer.echo(line)


def account_balance_delete(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    effective_date: Annotated[
        str, typer.Option("--date", help="Snapshot date (YYYY-MM-DD)")
    ],
    confirm: Annotated[
        bool, typer.Option("--confirm", help="Confirm permanent snapshot deletion")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Delete a non-sole balance snapshot."""
    if not (confirm or current_runtime().assume_yes):
        handle_error(ValidationError("Use --confirm to delete a balance snapshot."))
    try:
        account_service(db_path).delete_snapshot(account_id, effective_date)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted account #{account_id} balance for {effective_date}.")


def account_archive(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    closing_date: Annotated[
        str | None, typer.Option("--date", help="Closing date (YYYY-MM-DD)")
    ] = None,
    confirm: Annotated[
        bool, typer.Option("--confirm", help="Confirm the closing zero balance")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Archive an account and record a closing zero balance."""
    try:
        account = account_service(db_path).archive_account(
            account_id,
            closing_date or date.today(),
            confirm_zero_balance=confirm or current_runtime().assume_yes,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    assert account.archived_on is not None
    typer.echo(
        f"Archived account #{account_id}; recorded a closing zero balance on "
        f"{account.archived_on.isoformat()}."
    )


def account_delete(
    account_id: Annotated[int, typer.Argument(help="Account ID")],
    confirm: Annotated[
        bool, typer.Option("--confirm", help="Confirm permanent account deletion")
    ] = False,
    db_path: DbPathOption = None,
) -> None:
    """Permanently delete an eligible newly created account."""
    if not (confirm or current_runtime().assume_yes):
        handle_error(ValidationError("Use --confirm to permanently delete an account."))
    try:
        account_service(db_path).delete_account(account_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted account #{account_id}.")


def net_worth(
    as_of: Annotated[
        str | None, typer.Option("--as-of", help="Calculate as of YYYY-MM-DD")
    ] = None,
    db_path: DbPathOption = None,
) -> None:
    """Print total assets, liabilities, and net worth."""
    try:
        resolved_date = parse_snapshot_date(as_of or date.today())
        accounts, snapshots = account_service(db_path).report_data(resolved_date)
        summary = build_net_worth_summary(accounts, snapshots, resolved_date)
    except FinanceTrackerError as exc:
        handle_error(exc)
    currency_code = currency(db_path)
    typer.echo(f"Net worth as of {summary.as_of.isoformat()} ({currency_code})")
    typer.echo(f"Assets:       {format_money(summary.total_assets, currency_code)}")
    typer.echo(
        f"Liabilities:  {format_money(summary.total_liabilities, currency_code)}"
    )
    typer.echo(
        f"Net worth:    {format_money(summary.total_net_worth, currency_code)}"
    )
    typer.echo(
        "Coverage: "
        f"{summary.resolved_asset_count + summary.resolved_liability_count} resolved, "
        f"{summary.unresolved_account_count} not tracked yet; "
        f"{summary.active_account_count} active, "
        f"{summary.archived_account_count} archived."
    )


def net_worth_history(
    as_of: Annotated[
        str | None, typer.Option("--as-of", help="Final as-of date (YYYY-MM-DD)")
    ] = None,
    months: Annotated[
        int, typer.Option("--months", help="Number of history points (1-120)")
    ] = 12,
    db_path: DbPathOption = None,
) -> None:
    """Print chronological monthly net worth history."""
    try:
        resolved_date = parse_snapshot_date(as_of or date.today())
        accounts, snapshots = account_service(db_path).report_data(resolved_date)
        history = build_net_worth_history(accounts, snapshots, resolved_date, months)
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
        change = format_money(history.change_amount, currency_code)
        suffix = (
            f" ({history.change_percent:+.1f}%)"
            if history.change_percent is not None
            else ""
        )
        typer.echo(f"\nLatest change: {change}{suffix}")
