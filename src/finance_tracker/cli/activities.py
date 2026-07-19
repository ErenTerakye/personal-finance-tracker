"""Canonical account-aware activity CLI commands."""

from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    activity_service,
    currency,
    format_table,
    handle_error,
)
from finance_tracker.csv_io import (
    export_activities_csv,
    import_activities_csv,
    preview_activities_csv_file,
)
from finance_tracker.exceptions import CsvFormatError, FinanceTrackerError, ValidationError
from finance_tracker.models import PostingRole
from finance_tracker.reports import format_money


def activity_add(
    kind: Annotated[str, typer.Argument(help="income or expense")],
    amount: Annotated[str, typer.Argument(help="Positive activity amount")],
    account_id: Annotated[int, typer.Option("--account", help="Account ID")],
    category: Annotated[str, typer.Option("--category", "-c", help="Category")],
    description: Annotated[str, typer.Option("--description", "-d")] = "",
    activity_date: Annotated[str | None, typer.Option("--date")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Add income or expense to an account."""
    try:
        record = activity_service(db_path).add_activity(
            kind,
            amount,
            category,
            description,
            activity_date or date.today(),
            account_id,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    activity = record.activity
    effect = record.effect(PostingRole.ACCOUNT)
    assert effect is not None
    typer.echo(
        f"Added activity #{activity.id}: {activity.kind.value} "
        f"{format_money(activity.amount, currency(db_path))} in {activity.category} "
        f"to {effect.account_name}; balance "
        f"{format_money(effect.after_balance, currency(db_path))}."
    )


def activity_transfer(
    amount: Annotated[str, typer.Argument(help="Positive transfer amount")],
    from_account_id: Annotated[int, typer.Option("--from-account", help="Source account ID")],
    to_account_id: Annotated[int, typer.Option("--to-account", help="Destination account ID")],
    description: Annotated[str, typer.Option("--description", "-d")] = "",
    activity_date: Annotated[str | None, typer.Option("--date")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Transfer economic value between two accounts."""
    try:
        record = activity_service(db_path).add_transfer(
            amount,
            description,
            activity_date or date.today(),
            from_account_id,
            to_account_id,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    source = record.effect(PostingRole.SOURCE)
    destination = record.effect(PostingRole.DESTINATION)
    assert source is not None and destination is not None
    typer.echo(
        f"Added transfer #{record.activity.id}: "
        f"{format_money(record.activity.amount, currency(db_path))} "
        f"from {source.account_name} to {destination.account_name}."
    )


def activity_list(
    month: Annotated[int | None, typer.Option("--month", "-m")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y")] = None,
    category: Annotated[str | None, typer.Option("--category", "-c")] = None,
    kind: Annotated[str | None, typer.Option("--kind", "-k")] = None,
    account_id: Annotated[int | None, typer.Option("--account")] = None,
    search: Annotated[str | None, typer.Option("--search")] = None,
    db_path: DbPathOption = None,
) -> None:
    """List the unified activity ledger."""
    try:
        records = activity_service(db_path).list_activities(
            month=month,
            year=year,
            category=category,
            kind=kind,
            account_id=account_id,
            search=search,
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    if not records:
        typer.echo("No activity found.")
        return
    currency_code = currency(db_path)
    rows = []
    for record in records:
        item = record.activity
        account = record.effect(PostingRole.ACCOUNT)
        source = record.effect(PostingRole.SOURCE)
        destination = record.effect(PostingRole.DESTINATION)
        account_label = (
            account.account_name
            if account
            else f"{source.account_name} → {destination.account_name}"
            if source and destination
            else "—"
        )
        impact = sum((effect.balance_effect for effect in record.effects), start=Decimal("0.00"))
        rows.append(
            [
                str(item.id),
                item.date.isoformat(),
                item.kind.value,
                format_money(item.amount, currency_code),
                item.category or "—",
                account_label,
                format_money(impact, currency_code),
                item.description,
            ]
        )
    for line in format_table(
        ["ID", "Date", "Kind", "Amount", "Category", "Account", "Balance effect", "Description"],
        rows,
        {"Amount", "Balance effect"},
    ):
        typer.echo(line)


def activity_edit(
    activity_id: Annotated[int, typer.Argument(help="Activity ID")],
    kind: Annotated[str | None, typer.Option("--kind")] = None,
    amount: Annotated[str | None, typer.Option("--amount", "-a")] = None,
    category: Annotated[str | None, typer.Option("--category", "-c")] = None,
    description: Annotated[str | None, typer.Option("--description", "-d")] = None,
    activity_date: Annotated[str | None, typer.Option("--date")] = None,
    account_id: Annotated[int | None, typer.Option("--account")] = None,
    from_account_id: Annotated[int | None, typer.Option("--from-account")] = None,
    to_account_id: Annotated[int | None, typer.Option("--to-account")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Edit a non-opening activity with kind-aware fields."""
    try:
        service = activity_service(db_path)
        current = service.get_activity(activity_id).activity
        account_posting = current.posting(PostingRole.ACCOUNT)
        source_posting = current.posting(PostingRole.SOURCE)
        destination_posting = current.posting(PostingRole.DESTINATION)
        record = service.edit_activity(
            activity_id,
            kind=kind or current.kind.value,
            amount=amount or str(current.amount),
            category=category if category is not None else current.category,
            description=description if description is not None else current.description,
            activity_date=activity_date or current.date,
            account_id=account_id or (account_posting.account_id if account_posting else None),
            from_account_id=from_account_id
            or (source_posting.account_id if source_posting else None),
            to_account_id=to_account_id
            or (destination_posting.account_id if destination_posting else None),
        )
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Updated activity #{record.activity.id}.")


def activity_delete(
    activity_id: Annotated[int, typer.Argument(help="Activity ID")],
    confirm: Annotated[bool, typer.Option("--confirm")] = False,
    db_path: DbPathOption = None,
) -> None:
    """Delete a non-opening activity."""
    from finance_tracker.cli.runtime import current_runtime

    if not (confirm or current_runtime().assume_yes):
        handle_error(ValidationError("Use --confirm to permanently delete activity."))
    try:
        activity_service(db_path).delete_activity(activity_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted activity #{activity_id}.")


def activity_import(
    path: Annotated[Path, typer.Argument(help="Activity CSV file")],
    preview: Annotated[bool, typer.Option("--preview")] = False,
    allow_duplicates: Annotated[bool, typer.Option("--allow-duplicates")] = False,
    db_path: DbPathOption = None,
) -> None:
    """Preview or import account-aware activity CSV."""
    try:
        service = activity_service(db_path)
        if preview:
            with path.open(newline="", encoding="utf-8") as csv_file:
                preview_result = preview_activities_csv_file(csv_file, service)
            typer.echo(
                f"Previewed {len(preview_result.rows)} row(s): "
                f"{preview_result.valid_count} valid, "
                f"{preview_result.duplicate_count} duplicate, "
                f"{preview_result.invalid_count} invalid."
            )
            for row in preview_result.rows:
                detail = row.error or ""
                if row.activity and row.effects:
                    changes = ", ".join(
                        f"{effect.account_name} {effect.before_balance} → {effect.after_balance}"
                        for effect in row.effects.effects
                    )
                    detail = f"{row.activity.kind.value} {row.activity.amount}; {changes}"
                typer.echo(f"  - Line {row.line_number}: {row.status} {detail}".rstrip())
            return
        import_result = import_activities_csv(path, service, allow_duplicates)
    except (CsvFormatError, FinanceTrackerError) as exc:
        handle_error(exc)
    typer.echo(f"Imported {import_result.imported_count} activity item(s).")
    for error in import_result.errors:
        typer.echo(f"  - {error}")


def activity_export(
    path: Annotated[Path, typer.Argument(help="CSV output path")],
    month: Annotated[int | None, typer.Option("--month", "-m")] = None,
    year: Annotated[int | None, typer.Option("--year", "-y")] = None,
    category: Annotated[str | None, typer.Option("--category", "-c")] = None,
    kind: Annotated[str | None, typer.Option("--kind", "-k")] = None,
    account_id: Annotated[int | None, typer.Option("--account")] = None,
    db_path: DbPathOption = None,
) -> None:
    """Export filtered activity with human-readable account names."""
    try:
        records = activity_service(db_path).list_activities(
            month=month, year=year, category=category, kind=kind, account_id=account_id
        )
        output = export_activities_csv(path, records)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Exported {len(records)} activity item(s) to {output}")
