"""Feature views for the local Textual workspace."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING

from textual import on
from textual.app import ComposeResult
from textual.containers import Horizontal, VerticalScroll
from textual.widget import Widget
from textual.widgets import Button, DataTable, Input, Static

from finance_tracker.charts import save_monthly_chart, save_trend_chart
from finance_tracker.csv_io import (
    export_activities_csv,
    export_budgets_csv,
    export_transactions_csv,
    import_activities_csv,
    import_budgets_csv,
    import_transactions_csv,
    preview_activities_csv_file,
    preview_transactions_csv_file,
)
from finance_tracker.exceptions import FinanceTrackerError
from finance_tracker.models import PostingRole
from finance_tracker.reports import (
    build_net_worth_history,
    build_net_worth_summary,
    format_money,
    format_monthly_report,
    format_trend_report,
)
from finance_tracker.services import (
    AccountService,
    ActivityService,
    BudgetService,
    CategoryRuleService,
    LedgerRecoveryService,
    OverviewService,
    RecurringTemplateService,
    SettingsService,
)
from finance_tracker.services.transactions import TransactionService
from finance_tracker.tui.forms import FormField, FormScreen

if TYPE_CHECKING:
    from finance_tracker.tui.app import FinanceTrackerTui


def _today_period() -> tuple[int, int]:
    today = date.today()
    return today.month, today.year


class LedgerView(Widget):
    """Base class with service and notification conveniences."""

    @property
    def ledger_app(self) -> FinanceTrackerTui:
        return self.app  # type: ignore[return-value]

    @property
    def db_path(self) -> Path:
        return self.ledger_app.db_path

    @property
    def currency(self) -> str:
        return SettingsService(self.db_path).get_currency()

    def report_error(self, error: Exception) -> None:
        self.app.notify(str(error), title="Could not complete action", severity="error")


class OverviewView(LedgerView):
    def __init__(self) -> None:
        super().__init__(id="overview-view")
        self.month, self.year = _today_period()

    def compose(self) -> ComposeResult:
        with VerticalScroll(id="overview-scroll"):
            yield Static("Overview", classes="view-title")
            with Horizontal(classes="toolbar"):
                yield Button("‹ Month", id="overview-prev")
                yield Static("", id="overview-period", classes="context-line")
                yield Button("Month ›", id="overview-next")
                yield Button("Export", id="overview-export")
            with Horizontal(classes="metric-row"):
                yield Static("", id="metric-income", classes="metric")
                yield Static("", id="metric-expenses", classes="metric")
                yield Static("", id="metric-net", classes="metric")
                yield Static("", id="metric-worth", classes="metric")
            yield Static("Six-month cash flow", classes="section-title")
            yield DataTable(id="overview-trend", classes="compact-table", zebra_stripes=True)
            yield Static("Budgets needing attention", classes="section-title")
            yield DataTable(id="overview-budgets", classes="compact-table", zebra_stripes=True)
            yield Static("Recent activity", classes="section-title")
            yield DataTable(id="overview-recent", classes="compact-table", zebra_stripes=True)

    def on_mount(self) -> None:
        self._configure_tables()
        self.refresh_data()

    def _configure_tables(self) -> None:
        self.query_one("#overview-trend", DataTable).add_columns(
            "Month", "Income", "Expenses", "Net"
        )
        self.query_one("#overview-budgets", DataTable).add_columns(
            "Category", "Spent", "Budget", "Status"
        )
        self.query_one("#overview-recent", DataTable).add_columns(
            "Date", "Type", "Amount", "Category", "Description"
        )

    def refresh_data(self) -> None:
        try:
            snapshot = OverviewService(self.db_path).get(self.month, self.year)
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return

        def money(value: object) -> str:
            return format_money(value, snapshot.currency)  # type: ignore[arg-type]

        self.query_one("#overview-period", Static).update(
            f"{self.year}-{self.month:02d}  ·  {self.db_path}  ·  {snapshot.currency}"
        )
        self.query_one("#metric-income", Static).update(
            f"INCOME\n[bold]{money(snapshot.report.total_income)}[/bold]"
        )
        self.query_one("#metric-expenses", Static).update(
            f"EXPENSES\n[bold]{money(snapshot.report.total_expenses)}[/bold]"
        )
        self.query_one("#metric-net", Static).update(
            f"NET SAVINGS\n[bold]{money(snapshot.report.net_savings)}[/bold]"
        )
        self.query_one("#metric-worth", Static).update(
            f"NET WORTH\n[bold]{money(snapshot.net_worth.total_net_worth)}[/bold]"
        )
        trend = self.query_one("#overview-trend", DataTable)
        trend.clear()
        for trend_item in snapshot.trend.months:
            trend.add_row(
                f"{trend_item.year}-{trend_item.month:02d}",
                money(trend_item.total_income),
                money(trend_item.total_expenses),
                money(trend_item.net_savings),
            )
        budgets = self.query_one("#overview-budgets", DataTable)
        budgets.clear()
        attention = [item for item in snapshot.budget_statuses if item.status != "ok"]
        for budget_item in attention:
            budgets.add_row(
                budget_item.budget.category,
                money(budget_item.actual_expenses),
                money(budget_item.budget.amount),
                budget_item.status,
            )
        if not attention:
            budgets.add_row("—", "—", "—", "No budgets need attention")
        recent = self.query_one("#overview-recent", DataTable)
        recent.clear()
        for record in snapshot.recent_activities:
            transaction = record.activity
            recent.add_row(
                transaction.date.isoformat(),
                transaction.kind.value,
                money(transaction.amount),
                transaction.category or "—",
                transaction.description,
            )

    @on(Button.Pressed)
    def handle_button(self, event: Button.Pressed) -> None:
        if event.button.id == "overview-prev":
            self.month -= 1
            if self.month == 0:
                self.month, self.year = 12, self.year - 1
            self.refresh_data()
        elif event.button.id == "overview-next":
            self.month += 1
            if self.month == 13:
                self.month, self.year = 1, self.year + 1
            self.refresh_data()
        elif event.button.id == "overview-export":
            self.app.push_screen(
                FormScreen(
                    "Export overview artifacts",
                    [
                        FormField("directory", "Output directory", "reports"),
                        FormField("kind", "Artifacts (monthly, trends, or both)", "both"),
                    ],
                    submit_label="Export",
                ),
                self._export,
            )

    def _export(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            destination = Path(values["directory"])
            destination.mkdir(parents=True, exist_ok=True)
            snapshot = OverviewService(self.db_path).get(self.month, self.year)
            kind = values["kind"].casefold()
            if kind in {"monthly", "both"}:
                (destination / f"monthly-{self.year}-{self.month:02d}.txt").write_text(
                    format_monthly_report(snapshot.report, snapshot.currency) + "\n",
                    encoding="utf-8",
                )
                save_monthly_chart(
                    snapshot.report,
                    destination / f"monthly-{self.year}-{self.month:02d}.png",
                )
            if kind in {"trends", "both"}:
                (destination / f"trends-{self.year}-{self.month:02d}.txt").write_text(
                    format_trend_report(snapshot.trend, snapshot.currency) + "\n",
                    encoding="utf-8",
                )
                save_trend_chart(
                    snapshot.trend,
                    destination / f"trends-{self.year}-{self.month:02d}.png",
                )
            self.app.notify(f"Saved artifacts in {destination}", title="Export complete")
        except (FinanceTrackerError, OSError, ValueError) as exc:
            self.report_error(exc)


class LegacyTransactionsView(LedgerView):
    def __init__(self) -> None:
        super().__init__(id="transactions-view")
        self.row_ids: list[int] = []

    def compose(self) -> ComposeResult:
        yield Static("Transactions", classes="view-title")
        yield Static(
            "Search the complete ledger or select a row to edit it.", classes="context-line"
        )
        with Horizontal(classes="toolbar"):
            yield Input(
                placeholder="Search category, description, date, or amount", id="transaction-search"
            )
            yield Button("Add", variant="primary", id="transaction-add")
            yield Button("Edit", id="transaction-edit")
            yield Button("Delete", variant="error", id="transaction-delete")
            yield Button("Import", id="transaction-import")
            yield Button("Export", id="transaction-export")
        yield DataTable(id="transaction-table", cursor_type="row", zebra_stripes=True)

    def on_mount(self) -> None:
        self.query_one(DataTable).add_columns(
            "ID", "Date", "Type", "Amount", "Category", "Description"
        )
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            items = TransactionService(self.db_path).list_transactions()
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        query = self.query_one(Input).value.casefold().strip()
        if query:
            items = [
                item
                for item in items
                if query
                in " ".join(
                    (
                        item.date.isoformat(),
                        item.type.value,
                        str(item.amount),
                        item.category,
                        item.description,
                    )
                ).casefold()
            ]
        table = self.query_one(DataTable)
        table.clear()
        self.row_ids = []
        currency = self.currency
        for item in items:
            assert item.id is not None
            self.row_ids.append(item.id)
            table.add_row(
                str(item.id),
                item.date.isoformat(),
                item.type.value,
                format_money(item.amount, currency),
                item.category,
                item.description,
                key=str(item.id),
            )

    def selected_id(self) -> int | None:
        table = self.query_one(DataTable)
        if not self.row_ids or table.cursor_row >= len(self.row_ids):
            self.app.notify("Select a transaction first.", severity="warning")
            return None
        return self.row_ids[table.cursor_row]

    @on(Input.Changed, "#transaction-search")
    def search_changed(self) -> None:
        self.refresh_data()

    @on(DataTable.RowSelected, "#transaction-table")
    def row_selected(self) -> None:
        self.edit_selected()

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        action = event.button.id
        if action == "transaction-add":
            self.open_add()
        elif action == "transaction-edit":
            self.edit_selected()
        elif action == "transaction-delete":
            self.delete_selected()
        elif action == "transaction-import":
            self.app.push_screen(
                FormScreen(
                    "Preview transaction CSV",
                    [FormField("path", "CSV path")],
                    submit_label="Preview",
                ),
                self._preview_import,
            )
        elif action == "transaction-export":
            self.app.push_screen(
                FormScreen(
                    "Export transactions",
                    [FormField("path", "CSV output path", "exports/transactions.csv")],
                    submit_label="Export",
                ),
                self._export,
            )

    def open_add(self) -> None:
        self.app.push_screen(
            FormScreen(
                "Add transaction",
                [
                    FormField("type", "Type (income or expense)", "expense"),
                    FormField("amount", "Amount"),
                    FormField("category", "Category"),
                    FormField("description", "Description"),
                    FormField("date", "Date (YYYY-MM-DD)", date.today().isoformat()),
                ],
                submit_label="Add",
            ),
            self._add,
        )

    def _add(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            TransactionService(self.db_path).add_transaction(
                values["type"],
                values["amount"],
                values["category"],
                values["description"],
                values["date"],
            )
            self.refresh_data()
            self.app.notify("Transaction added.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def edit_selected(self) -> None:
        item_id = self.selected_id()
        if item_id is None:
            return
        item = next(
            item
            for item in TransactionService(self.db_path).list_transactions()
            if item.id == item_id
        )
        self.app.push_screen(
            FormScreen(
                f"Edit transaction #{item_id}",
                [
                    FormField("type", "Type", item.type.value),
                    FormField("amount", "Amount", str(item.amount)),
                    FormField("category", "Category", item.category),
                    FormField("description", "Description", item.description),
                    FormField("date", "Date", item.date.isoformat()),
                ],
            ),
            lambda values: self._edit(item_id, values),
        )

    def _edit(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            TransactionService(self.db_path).edit_transaction(
                item_id,
                values["type"],
                values["amount"],
                values["category"],
                values["description"],
                values["date"],
            )
            self.refresh_data()
            self.app.notify("Transaction updated.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def delete_selected(self) -> None:
        item_id = self.selected_id()
        if item_id is None:
            return
        self.app.push_screen(
            FormScreen(
                f"Delete transaction #{item_id}?",
                [FormField("confirm", "Type DELETE to confirm")],
                submit_label="Delete",
                note="This permanently removes the selected ledger entry.",
                danger=True,
            ),
            lambda values: self._delete(item_id, values),
        )

    def _delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            TransactionService(self.db_path).delete_transaction(item_id)
            self.refresh_data()
            self.app.notify("Transaction deleted.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _preview_import(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        path = Path(values["path"])
        try:
            service = TransactionService(self.db_path)
            with path.open(newline="", encoding="utf-8") as stream:
                preview = preview_transactions_csv_file(stream, service)
            self.app.push_screen(
                FormScreen(
                    "Import preview",
                    [FormField("confirm", "Type IMPORT to write valid rows")],
                    submit_label="Import",
                    note=(
                        f"{preview.valid_count} valid, {preview.duplicate_count} duplicate, "
                        f"{preview.invalid_count} invalid row(s)."
                    ),
                ),
                lambda confirm: self._import(path, confirm),
            )
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)

    def _import(self, path: Path, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "IMPORT":
            return
        try:
            result = import_transactions_csv(path, TransactionService(self.db_path))
            self.refresh_data()
            self.app.notify(f"Imported {result.imported_count} transaction(s).")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)

    def _export(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            path = export_transactions_csv(
                Path(values["path"]), TransactionService(self.db_path).list_transactions()
            )
            self.app.notify(f"Exported transactions to {path}.")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)


class BudgetsView(LedgerView):
    def __init__(self) -> None:
        super().__init__(id="budgets-view")
        self.month, self.year = _today_period()
        self.row_ids: list[int] = []

    def compose(self) -> ComposeResult:
        yield Static("Budgets", classes="view-title")
        with Horizontal(classes="toolbar"):
            yield Button("‹ Month", id="budget-prev")
            yield Static("", id="budget-period", classes="context-line")
            yield Button("Month ›", id="budget-next")
            yield Input(placeholder="Search categories", id="budget-search")
            yield Button("Set budget", variant="primary", id="budget-set")
            yield Button("Delete", variant="error", id="budget-delete")
            yield Button("Import", id="budget-import")
            yield Button("Export", id="budget-export")
        yield DataTable(id="budget-table", cursor_type="row", zebra_stripes=True)

    def on_mount(self) -> None:
        self.query_one(DataTable).add_columns(
            "ID", "Category", "Budget", "Spent", "Remaining", "Used", "Status"
        )
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            statuses = BudgetService(self.db_path).budget_statuses(self.month, self.year)
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        query = self.query_one(Input).value.casefold().strip()
        statuses = [item for item in statuses if query in item.budget.category.casefold()]
        statuses.sort(key=lambda item: (item.status == "ok", -item.percent_used))
        self.query_one("#budget-period", Static).update(f"{self.year}-{self.month:02d}")
        table = self.query_one(DataTable)
        table.clear()
        self.row_ids = []
        for item in statuses:
            assert item.budget.id is not None
            self.row_ids.append(item.budget.id)
            table.add_row(
                str(item.budget.id),
                item.budget.category,
                format_money(item.budget.amount, self.currency),
                format_money(item.actual_expenses, self.currency),
                format_money(item.remaining, self.currency),
                f"{item.percent_used:.1f}%",
                item.status,
            )

    @on(Input.Changed, "#budget-search")
    def search_changed(self) -> None:
        self.refresh_data()

    @on(DataTable.RowSelected, "#budget-table")
    def row_selected(self) -> None:
        self.open_set(use_selected=True)

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "budget-prev":
            self.month -= 1
            if self.month == 0:
                self.month, self.year = 12, self.year - 1
            self.refresh_data()
        elif event.button.id == "budget-next":
            self.month += 1
            if self.month == 13:
                self.month, self.year = 1, self.year + 1
            self.refresh_data()
        elif event.button.id == "budget-set":
            self.open_set()
        elif event.button.id == "budget-delete":
            self.delete_selected()
        elif event.button.id == "budget-import":
            self.app.push_screen(
                FormScreen(
                    "Import budgets", [FormField("path", "CSV path")], submit_label="Import"
                ),
                self._import,
            )
        elif event.button.id == "budget-export":
            self.app.push_screen(
                FormScreen(
                    "Export budgets",
                    [FormField("path", "CSV output path", "exports/budgets.csv")],
                    submit_label="Export",
                ),
                self._export,
            )

    def selected_id(self) -> int | None:
        table = self.query_one(DataTable)
        if not self.row_ids or table.cursor_row >= len(self.row_ids):
            self.app.notify("Select a budget first.", severity="warning")
            return None
        return self.row_ids[table.cursor_row]

    def open_set(self, *, use_selected: bool = False) -> None:
        category = ""
        amount = ""
        if use_selected:
            item_id = self.selected_id()
            if item_id is None:
                return
            item = next(
                item
                for item in BudgetService(self.db_path).list_budgets(
                    month=self.month, year=self.year
                )
                if item.id == item_id
            )
            category, amount = item.category, str(item.amount)
        self.app.push_screen(
            FormScreen(
                "Set monthly budget",
                [
                    FormField("category", "Category", category),
                    FormField("amount", "Amount", amount),
                ],
            ),
            self._set,
        )

    def _set(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            BudgetService(self.db_path).set_budget(
                values["category"], values["amount"], self.month, self.year
            )
            self.refresh_data()
            self.app.notify("Budget saved.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def delete_selected(self) -> None:
        item_id = self.selected_id()
        if item_id is None:
            return
        self.app.push_screen(
            FormScreen(
                f"Delete budget #{item_id}?",
                [FormField("confirm", "Type DELETE to confirm")],
                submit_label="Delete",
                danger=True,
            ),
            lambda values: self._delete(item_id, values),
        )

    def _delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            BudgetService(self.db_path).delete_budget(item_id)
            self.refresh_data()
            self.app.notify("Budget deleted.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _import(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            result = import_budgets_csv(Path(values["path"]), BudgetService(self.db_path))
            self.refresh_data()
            self.app.notify(f"Imported {result.imported_count} budget(s).")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)

    def _export(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            items = BudgetService(self.db_path).list_budgets(month=self.month, year=self.year)
            path = export_budgets_csv(Path(values["path"]), items)
            self.app.notify(f"Exported budgets to {path}.")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)


class LegacyAccountsView(LedgerView):
    def __init__(self) -> None:
        super().__init__(id="accounts-view")
        self.row_ids: list[int] = []

    def compose(self) -> ComposeResult:
        yield Static("Accounts & net worth", classes="view-title")
        yield Static("", id="net-worth-line", classes="context-line")
        with Horizontal(classes="toolbar"):
            yield Button("Add account", variant="primary", id="account-add")
            yield Button("Balance check-in", id="account-check-in")
            yield Button("Rename", id="account-rename")
            yield Button("Archive", id="account-archive")
            yield Button("Delete", variant="error", id="account-delete")
        yield DataTable(id="account-table", cursor_type="row", zebra_stripes=True)
        yield Static("12-month net-worth history", classes="section-title")
        yield DataTable(id="account-history", classes="compact-table", zebra_stripes=True)

    def on_mount(self) -> None:
        self.query_one("#account-table", DataTable).add_columns(
            "ID", "Name", "Type", "Balance", "As of", "Status"
        )
        self.query_one("#account-history", DataTable).add_columns(
            "As of", "Assets", "Liabilities", "Net worth"
        )
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            service = AccountService(self.db_path)
            accounts = service.list_accounts(include_archived=True)
            raw_accounts, snapshots = service.report_data(date.today())
            summary = build_net_worth_summary(raw_accounts, snapshots, date.today())
            history = build_net_worth_history(raw_accounts, snapshots, date.today(), 12)
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        self.query_one("#net-worth-line", Static).update(
            f"Net worth {format_money(summary.total_net_worth, self.currency)} · "
            f"Assets {format_money(summary.total_assets, self.currency)} · "
            f"Liabilities {format_money(summary.total_liabilities, self.currency)}"
        )
        table = self.query_one("#account-table", DataTable)
        table.clear()
        self.row_ids = []
        for item in accounts:
            assert item.account.id is not None
            self.row_ids.append(item.account.id)
            table.add_row(
                str(item.account.id),
                item.account.name,
                item.account.type.value,
                format_money(item.balance, self.currency)
                if item.balance is not None
                else "Not tracked",
                item.balance_date.isoformat() if item.balance_date else "—",
                "active" if item.account.active else "archived",
            )
        history_table = self.query_one("#account-history", DataTable)
        history_table.clear()
        for point in history.points:
            history_table.add_row(
                point.as_of.isoformat(),
                format_money(point.total_assets, self.currency),
                format_money(point.total_liabilities, self.currency),
                format_money(point.total_net_worth, self.currency),
            )

    def selected_id(self) -> int | None:
        table = self.query_one("#account-table", DataTable)
        if not self.row_ids or table.cursor_row >= len(self.row_ids):
            self.app.notify("Select an account first.", severity="warning")
            return None
        return self.row_ids[table.cursor_row]

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "account-add":
            self.app.push_screen(
                FormScreen(
                    "Add account",
                    [
                        FormField("name", "Name"),
                        FormField("type", "Type (asset or liability)", "asset"),
                        FormField("amount", "Opening balance"),
                        FormField("date", "Opening date", date.today().isoformat()),
                    ],
                    submit_label="Add",
                ),
                self._add,
            )
        elif event.button.id == "account-check-in":
            self.app.push_screen(
                FormScreen(
                    "Balance check-in",
                    [
                        FormField("date", "Effective date", date.today().isoformat()),
                        FormField(
                            "balances",
                            "Balances as ID=AMOUNT, comma separated",
                            placeholder="1=2500.00, 2=900.00",
                        ),
                    ],
                    submit_label="Record",
                ),
                self._check_in,
            )
        elif event.button.id == "account-rename":
            item_id = self.selected_id()
            if item_id is not None:
                self.app.push_screen(
                    FormScreen(f"Rename account #{item_id}", [FormField("name", "New name")]),
                    lambda values: self._rename(item_id, values),
                )
        elif event.button.id == "account-archive":
            item_id = self.selected_id()
            if item_id is not None:
                self.app.push_screen(
                    FormScreen(
                        f"Archive account #{item_id}",
                        [
                            FormField("date", "Closing date", date.today().isoformat()),
                            FormField("confirm", "Type ARCHIVE to confirm"),
                        ],
                        submit_label="Archive",
                        note="A closing zero balance will be recorded.",
                        danger=True,
                    ),
                    lambda values: self._archive(item_id, values),
                )
        elif event.button.id == "account-delete":
            item_id = self.selected_id()
            if item_id is not None:
                self.app.push_screen(
                    FormScreen(
                        f"Delete account #{item_id}",
                        [FormField("confirm", "Type DELETE to confirm")],
                        submit_label="Delete",
                        danger=True,
                    ),
                    lambda values: self._delete(item_id, values),
                )

    def _add(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            AccountService(self.db_path).create_account(
                values["name"], values["type"], values["amount"], values["date"]
            )
            self.refresh_data()
            self.app.notify("Account added.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _check_in(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            updates = []
            for entry in values["balances"].split(","):
                account_id, amount = entry.strip().split("=", maxsplit=1)
                updates.append((int(account_id), amount.strip()))
            result = AccountService(self.db_path).check_in_balances(  # type: ignore[attr-defined]
                values["date"], updates
            )
            self.refresh_data()
            self.app.notify(f"Recorded {len(result.snapshots)} balance(s).")
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def _rename(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            AccountService(self.db_path).edit_account_name(item_id, values["name"])
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _archive(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "ARCHIVE":
            return
        try:
            AccountService(self.db_path).archive_account(  # type: ignore[call-arg]
                item_id, values["date"], confirm_zero_balance=True
            )
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            AccountService(self.db_path).delete_account(item_id)
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)


class ManageView(LedgerView):
    def __init__(self) -> None:
        super().__init__(id="manage-view")
        self.recurring_ids: list[int] = []
        self.rule_ids: list[int] = []

    def compose(self) -> ComposeResult:
        with VerticalScroll(id="manage-scroll"):
            yield Static("Manage", classes="view-title")
            yield Static(
                "Automations, category cleanup, local data safety, and ledger preferences.",
                classes="context-line",
            )
            yield Static("Recurring transactions", classes="section-title")
            with Horizontal(classes="toolbar"):
                yield Button("Add recurring", variant="primary", id="recurring-add")
                yield Button("Apply month", id="recurring-apply")
                yield Button("Delete selected", variant="error", id="recurring-delete")
            yield DataTable(
                id="recurring-table", classes="compact-table", cursor_type="row", zebra_stripes=True
            )
            yield Static("Category aliases", classes="section-title")
            with Horizontal(classes="toolbar"):
                yield Button("Set alias", variant="primary", id="rule-set")
                yield Button("Delete selected", variant="error", id="rule-delete")
            yield DataTable(
                id="rule-table", classes="compact-table", cursor_type="row", zebra_stripes=True
            )
            yield Static("Preferences & data safety", classes="section-title")
            yield Static("", id="settings-line", classes="context-line")
            with Horizontal(classes="toolbar"):
                yield Button("Currency", id="currency-set")
                yield Button("Backup", id="data-backup")
                yield Button("Verify", id="data-verify")
                yield Button("Restore", variant="error", id="data-restore")

    def on_mount(self) -> None:
        self.query_one("#recurring-table", DataTable).add_columns(
            "ID", "Type", "Amount", "Category", "Day", "Description"
        )
        self.query_one("#rule-table", DataTable).add_columns("ID", "Alias", "Canonical category")
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            recurring = RecurringTemplateService(self.db_path).list_templates()
            rules = CategoryRuleService(self.db_path).list_rules()
            currency = SettingsService(self.db_path).get_currency()
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        self.query_one("#settings-line", Static).update(
            f"Ledger currency: {currency}  ·  Active database: {self.db_path}"
        )
        recurring_table = self.query_one("#recurring-table", DataTable)
        recurring_table.clear()
        self.recurring_ids = []
        for template in recurring:
            assert template.id is not None
            self.recurring_ids.append(template.id)
            recurring_table.add_row(
                str(template.id),
                template.type.value,
                format_money(template.amount, currency),
                template.category or "—",
                str(template.day_of_month),
                template.description,
            )
        rules_table = self.query_one("#rule-table", DataTable)
        rules_table.clear()
        self.rule_ids = []
        for rule in rules:
            assert rule.id is not None
            self.rule_ids.append(rule.id)
            rules_table.add_row(str(rule.id), rule.alias, rule.category)

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        action = event.button.id
        if action == "recurring-add":
            self.app.push_screen(
                FormScreen(
                    "Add recurring template",
                    [
                        FormField("kind", "Kind (income, expense, transfer)", "expense"),
                        FormField("amount", "Amount"),
                        FormField("category", "Category"),
                        FormField("account", "Account ID (income/expense)"),
                        FormField("from", "Source account ID (transfer)"),
                        FormField("to", "Destination account ID (transfer)"),
                        FormField("day", "Day of month"),
                        FormField("description", "Description"),
                    ],
                    submit_label="Add",
                ),
                self._recurring_add,
            )
        elif action == "recurring-apply":
            month, year = _today_period()
            self.app.push_screen(
                FormScreen(
                    "Apply recurring templates",
                    [FormField("month", "Month", str(month)), FormField("year", "Year", str(year))],
                    submit_label="Apply",
                ),
                self._recurring_apply,
            )
        elif action == "recurring-delete":
            item_id = self._selected("#recurring-table", self.recurring_ids, "recurring template")
            if item_id is not None:
                self.app.push_screen(
                    FormScreen(
                        f"Delete recurring template #{item_id}",
                        [FormField("confirm", "Type DELETE to confirm")],
                        submit_label="Delete",
                        danger=True,
                    ),
                    lambda values: self._recurring_delete(item_id, values),
                )
        elif action == "rule-set":
            self.app.push_screen(
                FormScreen(
                    "Set category alias",
                    [FormField("alias", "Alias"), FormField("category", "Canonical category")],
                ),
                self._rule_set,
            )
        elif action == "rule-delete":
            item_id = self._selected("#rule-table", self.rule_ids, "category alias")
            if item_id is not None:
                self.app.push_screen(
                    FormScreen(
                        f"Delete category alias #{item_id}",
                        [FormField("confirm", "Type DELETE to confirm")],
                        submit_label="Delete",
                        danger=True,
                    ),
                    lambda values: self._rule_delete(item_id, values),
                )
        elif action == "currency-set":
            self.app.push_screen(
                FormScreen(
                    "Ledger currency", [FormField("currency", "ISO currency code", self.currency)]
                ),
                self._currency_set,
            )
        elif action == "data-backup":
            self.app.push_screen(
                FormScreen(
                    "Back up complete ledger",
                    [FormField("path", "Destination", "backups/finance-tracker.sqlite3")],
                    submit_label="Back up",
                ),
                self._backup,
            )
        elif action == "data-verify":
            self.app.push_screen(
                FormScreen(
                    "Verify ledger or backup",
                    [FormField("path", "SQLite path", str(self.db_path))],
                    submit_label="Verify",
                ),
                self._verify,
            )
        elif action == "data-restore":
            self.app.push_screen(
                FormScreen(
                    "Restore complete ledger",
                    [
                        FormField("path", "Verified backup path"),
                        FormField("confirm", "Type RESTORE to replace the active ledger"),
                    ],
                    submit_label="Restore",
                    note=f"This atomically replaces {self.db_path}.",
                    danger=True,
                ),
                self._restore,
            )

    def _selected(self, selector: str, ids: list[int], label: str) -> int | None:
        table = self.query_one(selector, DataTable)
        if not ids or table.cursor_row >= len(ids):
            self.app.notify(f"Select a {label} first.", severity="warning")
            return None
        return ids[table.cursor_row]

    def _recurring_add(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            RecurringTemplateService(self.db_path).add_template(
                values["kind"],
                values["amount"],
                values["category"] or None,
                values["description"],
                int(values["day"]),
                account_id=int(values["account"]) if values["account"] else None,
                from_account_id=int(values["from"]) if values["from"] else None,
                to_account_id=int(values["to"]) if values["to"] else None,
            )
            self.refresh_data()
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def _recurring_apply(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            result = RecurringTemplateService(self.db_path).apply_templates(
                int(values["month"]), int(values["year"])
            )
            self.app.notify(
                f"Created {len(result.created)} activity item(s); "
                f"skipped {result.skipped_duplicates} duplicate(s)."
            )
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def _recurring_delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            RecurringTemplateService(self.db_path).delete_template(item_id)
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _rule_set(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            CategoryRuleService(self.db_path).set_rule(values["alias"], values["category"])
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _rule_delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            CategoryRuleService(self.db_path).delete_rule(item_id)
            self.refresh_data()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _currency_set(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            SettingsService(self.db_path).set_currency(values["currency"])
            self.refresh_data()
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _backup(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            result = LedgerRecoveryService(self.db_path).backup(Path(values["path"]))
            self.app.notify(f"Verified backup created at {result.path}.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _verify(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            result = LedgerRecoveryService.verify(Path(values["path"]))
            self.app.notify(f"Schema {result.schema_version}; integrity {result.integrity}.")
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _restore(self, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "RESTORE":
            return
        try:
            result = LedgerRecoveryService(self.db_path).restore(Path(values["path"]))
            self.ledger_app.refresh_all()
            self.app.notify(f"Restored verified ledger to {result.path}.")
        except FinanceTrackerError as exc:
            self.report_error(exc)


class ActivityView(LedgerView):
    """Kind-aware unified ledger used by the v3 workspace."""

    def __init__(self) -> None:
        super().__init__(id="transactions-view")
        self.row_ids: list[int] = []
        self.account_filter: int | None = None

    def compose(self) -> ComposeResult:
        yield Static("Activity", classes="view-title")
        yield Static(
            "Income, expenses, transfers, openings, and adjustments in one account ledger.",
            classes="context-line",
        )
        with Horizontal(classes="toolbar"):
            yield Input(
                placeholder="Search category, description, date, kind, or account",
                id="transaction-search",
            )
            yield Button("Add activity", variant="primary", id="activity-add")
            yield Button("Transfer", id="activity-transfer")
            yield Button("Edit", id="activity-edit")
            yield Button("Delete", variant="error", id="activity-delete")
            yield Button("Import", id="activity-import")
            yield Button("Export", id="activity-export")
        yield DataTable(id="transaction-table", cursor_type="row", zebra_stripes=True)

    def on_mount(self) -> None:
        self.query_one(DataTable).add_columns(
            "ID", "Date", "Kind", "Amount", "Category", "Account", "Effect", "Description"
        )
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            records = ActivityService(self.db_path).list_activities(
                account_id=self.account_filter,
                search=self.query_one(Input).value or None,
            )
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        table = self.query_one(DataTable)
        table.clear()
        self.row_ids = []
        for record in records:
            item = record.activity
            assert item.id is not None
            self.row_ids.append(item.id)
            names = " → ".join(effect.account_name for effect in record.effects)
            effects = ", ".join(
                format_money(effect.balance_effect, self.currency) for effect in record.effects
            )
            table.add_row(
                str(item.id),
                item.date.isoformat(),
                item.kind.value,
                format_money(item.amount, self.currency),
                item.category or "—",
                names,
                effects,
                item.description,
                key=str(item.id),
            )

    def filter_account(self, account_id: int) -> None:
        self.account_filter = account_id
        self.refresh_data()

    def selected_id(self) -> int | None:
        table = self.query_one(DataTable)
        if not self.row_ids or table.cursor_row >= len(self.row_ids):
            self.app.notify("Select an activity first.", severity="warning")
            return None
        return self.row_ids[table.cursor_row]

    @on(Input.Changed, "#transaction-search")
    def search_changed(self) -> None:
        self.refresh_data()

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        action = event.button.id
        if action == "activity-add":
            self.open_add()
        elif action == "activity-transfer":
            self.open_transfer()
        elif action == "activity-edit":
            self.edit_selected()
        elif action == "activity-delete":
            self.delete_selected()
        elif action == "activity-import":
            self.app.push_screen(
                FormScreen("Preview activity CSV", [FormField("path", "CSV path")]),
                self._preview_import,
            )
        elif action == "activity-export":
            self.app.push_screen(
                FormScreen(
                    "Export activity",
                    [FormField("path", "CSV output path", "exports/activities.csv")],
                ),
                self._export,
            )

    def open_add(self) -> None:
        self.app.push_screen(
            FormScreen(
                "Add activity",
                [
                    FormField("kind", "Kind (income or expense)", "expense"),
                    FormField("amount", "Amount"),
                    FormField("category", "Category"),
                    FormField("account", "Account ID"),
                    FormField("description", "Description"),
                    FormField("date", "Date", date.today().isoformat()),
                ],
                submit_label="Add",
            ),
            self._add,
        )

    def open_transfer(self, source_id: int | None = None) -> None:
        self.app.push_screen(
            FormScreen(
                "Transfer between accounts",
                [
                    FormField("amount", "Amount"),
                    FormField("from", "Source account ID", str(source_id or "")),
                    FormField("to", "Destination account ID"),
                    FormField("description", "Description"),
                    FormField("date", "Date", date.today().isoformat()),
                ],
                submit_label="Transfer",
            ),
            self._transfer,
        )

    def _add(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            ActivityService(self.db_path).add_activity(
                values["kind"],
                values["amount"],
                values["category"],
                values["description"],
                values["date"],
                int(values["account"]),
            )
            self.ledger_app.refresh_all()
            self.app.notify("Activity added.")
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def _transfer(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            ActivityService(self.db_path).add_transfer(
                values["amount"],
                values["description"],
                values["date"],
                int(values["from"]),
                int(values["to"]),
            )
            self.ledger_app.refresh_all()
            self.app.notify("Transfer added.")
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def edit_selected(self) -> None:
        item_id = self.selected_id()
        if item_id is None:
            return
        record = ActivityService(self.db_path).get_activity(item_id)
        item = record.activity
        if item.kind.value == "opening":
            self.app.notify("Opening activity is read-only.", severity="warning")
            return
        account = item.posting(PostingRole.ACCOUNT)
        source = item.posting(PostingRole.SOURCE)
        destination = item.posting(PostingRole.DESTINATION)
        self.app.push_screen(
            FormScreen(
                f"Edit activity #{item_id}",
                [
                    FormField("kind", "Kind", item.kind.value),
                    FormField("amount", "Amount / observed balance", str(item.amount)),
                    FormField("category", "Category", item.category or ""),
                    FormField("account", "Account ID", str(account.account_id if account else "")),
                    FormField(
                        "from", "Source account ID", str(source.account_id if source else "")
                    ),
                    FormField(
                        "to",
                        "Destination account ID",
                        str(destination.account_id if destination else ""),
                    ),
                    FormField("description", "Description", item.description),
                    FormField("date", "Date", item.date.isoformat()),
                ],
            ),
            lambda values: self._edit(item_id, values),
        )

    def _edit(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            ActivityService(self.db_path).edit_activity(
                item_id,
                kind=values["kind"],
                amount=values["amount"],
                category=values["category"] or None,
                description=values["description"],
                activity_date=values["date"],
                account_id=int(values["account"]) if values["account"] else None,
                from_account_id=int(values["from"]) if values["from"] else None,
                to_account_id=int(values["to"]) if values["to"] else None,
            )
            self.ledger_app.refresh_all()
        except (FinanceTrackerError, ValueError) as exc:
            self.report_error(exc)

    def delete_selected(self) -> None:
        item_id = self.selected_id()
        if item_id is None:
            return
        self.app.push_screen(
            FormScreen(
                f"Delete activity #{item_id}?",
                [FormField("confirm", "Type DELETE to confirm")],
                submit_label="Delete",
                danger=True,
            ),
            lambda values: self._delete(item_id, values),
        )

    def _delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            ActivityService(self.db_path).delete_activity(item_id)
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _preview_import(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        path = Path(values["path"])
        try:
            with path.open(newline="", encoding="utf-8") as stream:
                preview = preview_activities_csv_file(stream, ActivityService(self.db_path))
            self.app.push_screen(
                FormScreen(
                    "Import preview",
                    [FormField("confirm", "Type IMPORT to write valid rows")],
                    note=(
                        f"{preview.valid_count} valid, "
                        f"{preview.duplicate_count} duplicate, "
                        f"{preview.invalid_count} invalid."
                    ),
                ),
                lambda confirm: self._import(path, confirm),
            )
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)

    def _import(self, path: Path, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "IMPORT":
            return
        try:
            result = import_activities_csv(path, ActivityService(self.db_path))
            self.ledger_app.refresh_all()
            self.app.notify(f"Imported {result.imported_count} activity item(s).")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)

    def _export(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            service = ActivityService(self.db_path)
            path = export_activities_csv(
                Path(values["path"]), service.list_activities(account_id=self.account_filter)
            )
            self.app.notify(f"Exported activity to {path}.")
        except (FinanceTrackerError, OSError) as exc:
            self.report_error(exc)


class ActivityAccountsView(LedgerView):
    """Account rows with transfer, adjustment, and history actions."""

    def __init__(self) -> None:
        super().__init__(id="accounts-view")
        self.row_ids: list[int] = []

    def compose(self) -> ComposeResult:
        yield Static("Accounts & net worth", classes="view-title")
        yield Static("", id="net-worth-line", classes="context-line")
        with Horizontal(classes="toolbar"):
            yield Button("Add account", variant="primary", id="v3-account-add")
            yield Button("Update balance", id="v3-account-adjust")
            yield Button("Transfer", id="v3-account-transfer")
            yield Button("Activity", id="v3-account-history")
            yield Button("Archive", id="v3-account-archive")
            yield Button("Delete", variant="error", id="v3-account-delete")
        yield DataTable(id="account-table", cursor_type="row", zebra_stripes=True)

    def on_mount(self) -> None:
        self.query_one(DataTable).add_columns(
            "ID", "Name", "Type", "Subtype", "Balance", "State", "As of", "Status"
        )
        self.refresh_data()

    def refresh_data(self) -> None:
        try:
            service = AccountService(self.db_path)
            accounts = service.list_accounts(include_archived=True)
            raw_accounts, activities = service.report_data(date.today())
            summary = build_net_worth_summary(raw_accounts, activities, date.today())
        except FinanceTrackerError as exc:
            self.report_error(exc)
            return
        self.query_one("#net-worth-line", Static).update(
            f"Net worth {format_money(summary.total_net_worth, self.currency)} · "
            f"{summary.account_state_warning_count} account state warning(s)"
        )
        table = self.query_one(DataTable)
        table.clear()
        self.row_ids = []
        for item in accounts:
            assert item.account.id is not None
            self.row_ids.append(item.account.id)
            table.add_row(
                str(item.account.id),
                item.account.name,
                item.account.type.value,
                item.account.subtype.value,
                format_money(item.balance, self.currency),
                item.balance_state.value,
                item.as_of.isoformat(),
                "active" if item.account.active else "archived",
            )

    def selected_id(self) -> int | None:
        table = self.query_one(DataTable)
        if not self.row_ids or table.cursor_row >= len(self.row_ids):
            self.app.notify("Select an account first.", severity="warning")
            return None
        return self.row_ids[table.cursor_row]

    @on(Button.Pressed)
    def button_pressed(self, event: Button.Pressed) -> None:
        item_id = self.selected_id() if event.button.id != "v3-account-add" else None
        if event.button.id == "v3-account-add":
            self.app.push_screen(
                FormScreen(
                    "Add account",
                    [
                        FormField("name", "Name"),
                        FormField("type", "Type", "asset"),
                        FormField("subtype", "Subtype", "cash"),
                        FormField("amount", "Opening balance"),
                        FormField("date", "Opening date", date.today().isoformat()),
                    ],
                ),
                self._add,
            )
        elif item_id is None:
            return
        elif event.button.id == "v3-account-adjust":
            self.app.push_screen(
                FormScreen(
                    f"Update account #{item_id} balance",
                    [
                        FormField("amount", "Observed balance"),
                        FormField("date", "Date", date.today().isoformat()),
                        FormField("description", "Description", "Balance update"),
                    ],
                ),
                lambda values: self._adjust(item_id, values),
            )
        elif event.button.id == "v3-account-transfer":
            self.ledger_app.action_workspace("transactions-tab")
            self.app.query_one(ActivityView).open_transfer(item_id)
        elif event.button.id == "v3-account-history":
            self.ledger_app.action_workspace("transactions-tab")
            self.app.query_one(ActivityView).filter_account(item_id)
        elif event.button.id == "v3-account-archive":
            self.app.push_screen(
                FormScreen(
                    f"Archive account #{item_id}",
                    [
                        FormField("date", "Closing date", date.today().isoformat()),
                        FormField("confirm", "Type ARCHIVE to confirm"),
                    ],
                    danger=True,
                    note="Calculated balance must already be zero and no later activity may exist.",
                ),
                lambda values: self._archive(item_id, values),
            )
        elif event.button.id == "v3-account-delete":
            self.app.push_screen(
                FormScreen(
                    f"Delete account #{item_id}",
                    [FormField("confirm", "Type DELETE to confirm")],
                    danger=True,
                ),
                lambda values: self._delete(item_id, values),
            )

    def _add(self, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            AccountService(self.db_path).create_account(
                values["name"],
                values["type"],
                values["amount"],
                values["date"],
                values["subtype"],
            )
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _adjust(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values:
            return
        try:
            AccountService(self.db_path).adjust_account(
                item_id, values["amount"], values["date"], values["description"]
            )
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _archive(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "ARCHIVE":
            return
        try:
            AccountService(self.db_path).archive_account(item_id, values["date"])
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)

    def _delete(self, item_id: int, values: dict[str, str] | None) -> None:
        if not values or values["confirm"] != "DELETE":
            return
        try:
            AccountService(self.db_path).delete_account(item_id)
            self.ledger_app.refresh_all()
        except FinanceTrackerError as exc:
            self.report_error(exc)


# Preserve import names used by the app while replacing the v2 implementations.
TransactionsView = ActivityView
AccountsView = ActivityAccountsView
