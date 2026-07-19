"""Full-screen terminal workspace for the local ledger."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from textual.app import App, ComposeResult, SystemCommand
from textual.binding import Binding
from textual.containers import Container
from textual.events import Resize
from textual.screen import Screen
from textual.widgets import Footer, Header, Input, TabbedContent, TabPane

from finance_tracker.config import resolve_db_path
from finance_tracker.services import ActivityService
from finance_tracker.tui.forms import HelpScreen
from finance_tracker.tui.views import (
    AccountsView,
    BudgetsView,
    LedgerView,
    ManageView,
    OverviewView,
    TransactionsView,
)


class FinanceTrackerTui(App[None]):
    """Keyboard-first finance workspace backed directly by local services."""

    CSS_PATH = "app.tcss"
    TITLE = "Finance Tracker"
    SUB_TITLE = "Local ledger workspace"
    ENABLE_COMMAND_PALETTE = True
    COMMAND_PALETTE_BINDING = "ctrl+p"
    BINDINGS = [
        Binding("q", "quit", "Quit", priority=True),
        Binding("r", "refresh", "Refresh", priority=True),
        Binding("?", "help", "Help", priority=True),
        Binding("a", "add_activity", "Add activity", priority=True),
        Binding("slash", "focus_search", "Search", priority=True),
        Binding("1", "workspace('overview-tab')", "Overview", show=False, priority=True),
        Binding("2", "workspace('transactions-tab')", "Activity", show=False, priority=True),
        Binding("3", "workspace('budgets-tab')", "Budgets", show=False, priority=True),
        Binding("4", "workspace('accounts-tab')", "Accounts", show=False, priority=True),
        Binding("5", "workspace('manage-tab')", "Manage", show=False, priority=True),
    ]

    def __init__(self, *, db_path: Path | None = None) -> None:
        super().__init__()
        self.db_path = resolve_db_path(db_path).resolve()
        ActivityService(self.db_path)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container(id="workspace"), TabbedContent(initial="overview-tab"):
            with TabPane("1 Overview", id="overview-tab"):
                yield OverviewView()
            with TabPane("2 Activity", id="transactions-tab"):
                yield TransactionsView()
            with TabPane("3 Budgets", id="budgets-tab"):
                yield BudgetsView()
            with TabPane("4 Accounts", id="accounts-tab"):
                yield AccountsView()
            with TabPane("5 Manage", id="manage-tab"):
                yield ManageView()
        yield Footer()

    def on_mount(self) -> None:
        self.sub_title = str(self.db_path)
        self._set_density(self.size.width)

    def on_resize(self, event: Resize) -> None:
        self._set_density(event.size.width)

    def _set_density(self, width: int) -> None:
        self.set_class(width < 100, "narrow")

    def action_workspace(self, tab_id: str) -> None:
        self.query_one(TabbedContent).active = tab_id

    def check_action(self, action: str, parameters: tuple[object, ...]) -> bool | None:
        return not (
            isinstance(self.focused, Input)
            and action
            in {
                "quit",
                "refresh",
                "help",
                "add_activity",
                "focus_search",
                "workspace",
            }
        )

    def action_refresh(self) -> None:
        active = self.query_one(TabbedContent).active
        pane = self.query_one(f"#{active}", TabPane)
        view = pane.query(LedgerView).first()
        view.refresh_data()  # type: ignore[attr-defined]
        self.notify("Ledger refreshed.")

    def refresh_all(self) -> None:
        for view in self.query(LedgerView):
            view.refresh_data()  # type: ignore[attr-defined]

    def action_help(self) -> None:
        self.push_screen(HelpScreen())

    def action_add_activity(self) -> None:
        self.action_workspace("transactions-tab")
        self.query_one(TransactionsView).open_add()

    def action_focus_search(self) -> None:
        active = self.query_one(TabbedContent).active
        selector = {
            "transactions-tab": "#transaction-search",
            "budgets-tab": "#budget-search",
        }.get(active)
        if selector is None:
            self.notify("Search is available in Activity and Budgets.", severity="information")
            return
        self.query_one(selector, Input).focus()

    def get_system_commands(self, screen: Screen) -> Iterable[SystemCommand]:
        yield from super().get_system_commands(screen)
        yield SystemCommand(
            "Add activity", "Open the global account-aware form", self.action_add_activity
        )
        yield SystemCommand("Refresh ledger", "Reload all workspace data", self.refresh_all)
        yield SystemCommand(
            "Go to Overview",
            "Show monthly orientation",
            lambda: self.action_workspace("overview-tab"),
        )
        yield SystemCommand(
            "Go to Activity",
            "Search and edit the ledger",
            lambda: self.action_workspace("transactions-tab"),
        )
        yield SystemCommand(
            "Go to Budgets",
            "Review category pressure",
            lambda: self.action_workspace("budgets-tab"),
        )
        yield SystemCommand(
            "Go to Accounts",
            "Review balances and net worth",
            lambda: self.action_workspace("accounts-tab"),
        )
        yield SystemCommand(
            "Go to Manage",
            "Open automations, data, and settings",
            lambda: self.action_workspace("manage-tab"),
        )
