"""Category alias-rule CLI commands."""

from typing import Annotated

import typer

from finance_tracker.cli.common import (
    DbPathOption,
    category_rule_service,
    format_table,
    handle_error,
)
from finance_tracker.exceptions import FinanceTrackerError


def category_rule_set(
    alias: Annotated[str, typer.Argument(help="Category alias to normalize")],
    category: Annotated[str, typer.Argument(help="Canonical category name")],
    db_path: DbPathOption = None,
) -> None:
    """Set or update a category alias rule."""
    try:
        rule = category_rule_service(db_path).set_rule(alias=alias, category=category)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Set category rule #{rule.id}: {rule.alias} -> {rule.category}")


def category_rule_list(db_path: DbPathOption = None) -> None:
    """List category alias rules."""
    try:
        rules = category_rule_service(db_path).list_rules()
    except FinanceTrackerError as exc:
        handle_error(exc)
    if not rules:
        typer.echo("No category rules found.")
        return
    rows = [[str(rule.id), rule.alias, rule.category] for rule in rules]
    for line in format_table(["ID", "Alias", "Category"], rows):
        typer.echo(line)


def category_rule_delete(
    rule_id: Annotated[int, typer.Argument(help="Category rule ID to delete")],
    db_path: DbPathOption = None,
) -> None:
    """Delete a category alias rule."""
    try:
        category_rule_service(db_path).delete_rule(rule_id)
    except FinanceTrackerError as exc:
        handle_error(exc)
    typer.echo(f"Deleted category rule #{rule_id}")
