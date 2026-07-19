"""Typer composition for the breaking v2 grouped command surface."""

import typer

from finance_tracker.cli.accounts import (
    account_add,
    account_adjust,
    account_archive,
    account_delete,
    account_edit,
    account_list,
    net_worth,
    net_worth_history,
)
from finance_tracker.cli.activities import (
    activity_add,
    activity_delete,
    activity_edit,
    activity_export,
    activity_import,
    activity_list,
    activity_transfer,
)
from finance_tracker.cli.budgets import budget_delete, budget_list, budget_set, budget_status
from finance_tracker.cli.category_rules import (
    category_rule_delete,
    category_rule_list,
    category_rule_set,
)
from finance_tracker.cli.csv_commands import export_budgets, import_budgets
from finance_tracker.cli.migration import MigrationAwareGroup
from finance_tracker.cli.output import json_command
from finance_tracker.cli.overview import overview
from finance_tracker.cli.recovery import ledger_backup, ledger_restore, ledger_verify
from finance_tracker.cli.recurring import (
    recurring_add,
    recurring_apply,
    recurring_delete,
    recurring_list,
)
from finance_tracker.cli.reports import report, trends
from finance_tracker.cli.root import root_callback, tui_command
from finance_tracker.cli.settings import settings_get, settings_set
from finance_tracker.cli.web import init, web

app = typer.Typer(
    help="A local-first financial command center.",
    no_args_is_help=False,
    cls=MigrationAwareGroup,
)
app.callback(invoke_without_command=True)(root_callback)

activity_app = typer.Typer(help="Create, inspect, transfer, and import account activity.")
budget_app = typer.Typer(help="Plan categories and review budget pressure.")
account_app = typer.Typer(help="Manage accounts and net-worth inputs.")
recurring_app = typer.Typer(help="Manage recurring activity templates.")
category_app = typer.Typer(help="Normalize imported and entered categories.")
report_app = typer.Typer(help="Generate deterministic financial reports.")
data_app = typer.Typer(help="Initialize, protect, and recover the local ledger.")
settings_app = typer.Typer(help="Manage ledger-wide preferences.")

app.command("tui")(tui_command)
app.command()(overview)
app.command()(web)
app.add_typer(activity_app, name="activity")
app.add_typer(budget_app, name="budget")
app.add_typer(account_app, name="account")
app.add_typer(recurring_app, name="recurring")
app.add_typer(category_app, name="category")
app.add_typer(report_app, name="report")
app.add_typer(data_app, name="data")
app.add_typer(settings_app, name="settings")

activity_app.command("add")(json_command(activity_add))
activity_app.command("transfer")(json_command(activity_transfer))
activity_app.command("list")(json_command(activity_list))
activity_app.command("edit")(json_command(activity_edit))
activity_app.command("delete")(json_command(activity_delete))
activity_app.command("import")(json_command(activity_import))
activity_app.command("export")(json_command(activity_export))

budget_app.command("set")(json_command(budget_set))
budget_app.command("list")(json_command(budget_list))
budget_app.command("status")(json_command(budget_status))
budget_app.command("delete")(json_command(budget_delete))
budget_app.command("import")(json_command(import_budgets))
budget_app.command("export")(json_command(export_budgets))

account_app.command("add")(json_command(account_add))
account_app.command("adjust")(json_command(account_adjust))
account_app.command("list")(json_command(account_list))
account_app.command("edit")(json_command(account_edit))
account_app.command("archive")(json_command(account_archive))
account_app.command("delete")(json_command(account_delete))

recurring_app.command("add")(json_command(recurring_add))
recurring_app.command("list")(json_command(recurring_list))
recurring_app.command("apply")(json_command(recurring_apply))
recurring_app.command("delete")(json_command(recurring_delete))

category_app.command("set")(json_command(category_rule_set))
category_app.command("list")(json_command(category_rule_list))
category_app.command("delete")(json_command(category_rule_delete))

report_app.command("monthly")(json_command(report))
report_app.command("trends")(json_command(trends))
report_app.command("net-worth")(json_command(net_worth))
report_app.command("net-worth-history")(json_command(net_worth_history))

data_app.command("init")(json_command(init))
data_app.command("backup")(json_command(ledger_backup))
data_app.command("verify")(json_command(ledger_verify))
data_app.command("restore")(json_command(ledger_restore))

settings_app.command("get")(json_command(settings_get))
settings_app.command("set")(json_command(settings_set))
