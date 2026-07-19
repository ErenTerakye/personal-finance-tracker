"""Focused v1-to-v2 diagnostics without retaining executable aliases."""

from typer._click.core import Command, Context
from typer._click.exceptions import UsageError
from typer.core import TyperGroup

LEGACY_COMMANDS = {
    "init": "data init",
    "add": "transaction add",
    "list": "transaction list",
    "edit": "transaction edit",
    "delete": "transaction delete",
    "budget-set": "budget set",
    "budget-list": "budget list",
    "budget-status": "budget status",
    "budget-delete": "budget delete",
    "category-rule-set": "category set",
    "category-rule-list": "category list",
    "category-rule-delete": "category delete",
    "recurring-add": "recurring add",
    "recurring-list": "recurring list",
    "recurring-apply": "recurring apply",
    "recurring-delete": "recurring delete",
    "summary": "overview",
    "trends": "report trends",
    "import-csv": "transaction import",
    "export-csv": "transaction export",
    "import-budgets-csv": "budget import",
    "export-budgets-csv": "budget export",
    "settings-get": "settings get",
    "settings-set": "settings set",
    "account-add": "account add",
    "account-list": "account list",
    "account-edit": "account edit",
    "account-balance-set": "account balance set",
    "account-balance-list": "account balance list",
    "account-balance-delete": "account balance delete",
    "account-archive": "account archive",
    "account-delete": "account delete",
    "net-worth": "report net-worth",
    "net-worth-history": "report net-worth-history",
    "ledger-backup": "data backup",
    "ledger-verify": "data verify",
    "ledger-restore": "data restore",
}


class MigrationAwareGroup(TyperGroup):
    """Explain intentional v2 moves while leaving old commands unregistered."""

    def resolve_command(
        self, ctx: Context, args: list[str]
    ) -> tuple[str | None, Command | None, list[str]]:
        if args and args[0] in LEGACY_COMMANDS:
            replacement = LEGACY_COMMANDS[args[0]]
            raise UsageError(
                f"Command '{args[0]}' moved in v2. Use 'finance-tracker {replacement}'.",
                ctx=ctx,
            )
        return super().resolve_command(ctx, args)
