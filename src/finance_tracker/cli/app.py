"""Typer application composition."""

import typer

from finance_tracker.cli.budgets import budget_delete, budget_list, budget_set, budget_status
from finance_tracker.cli.category_rules import (
    category_rule_delete,
    category_rule_list,
    category_rule_set,
)
from finance_tracker.cli.csv_commands import export_budgets, export_csv, import_budgets, import_csv
from finance_tracker.cli.recurring import (
    recurring_add,
    recurring_apply,
    recurring_delete,
    recurring_list,
)
from finance_tracker.cli.reports import report, summary, trends
from finance_tracker.cli.settings import settings_get, settings_set
from finance_tracker.cli.transactions import add, delete, edit, list_transactions
from finance_tracker.cli.web import init, web

app = typer.Typer(help="Track income and expenses from the command line.")

# Registration order preserves the established root help surface.
app.command()(init)
app.command()(web)
app.command()(add)
app.command("list")(list_transactions)
app.command()(delete)
app.command("budget-set")(budget_set)
app.command("budget-list")(budget_list)
app.command("budget-delete")(budget_delete)
app.command("category-rule-set")(category_rule_set)
app.command("category-rule-list")(category_rule_list)
app.command("category-rule-delete")(category_rule_delete)
app.command("recurring-add")(recurring_add)
app.command("recurring-list")(recurring_list)
app.command("recurring-delete")(recurring_delete)
app.command("recurring-apply")(recurring_apply)
app.command("budget-status")(budget_status)
app.command()(edit)
app.command()(summary)
app.command()(report)
app.command()(trends)
app.command("import-csv")(import_csv)
app.command("import-budgets-csv")(import_budgets)
app.command("export-csv")(export_csv)
app.command("export-budgets-csv")(export_budgets)
app.command("settings-get")(settings_get)
app.command("settings-set")(settings_set)
