"""Compact Textual launcher rendered inside normal terminal scrollback."""

from __future__ import annotations

from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import OptionList, Static
from textual.widgets.option_list import Option

from finance_tracker.reports import format_money
from finance_tracker.services import OverviewSnapshot

_ACTIONS = (
    ("add", "Add activity", "Record income or expense"),
    ("activity", "Review activity", "Browse the unified account ledger"),
    ("budgets", "Check budgets", "See category pressure"),
    ("adjust", "Update account balance", "Record an observed balance"),
    ("workspace", "Workspace", "Open advanced full-screen mode"),
)


class FinanceTrackerHome(App[str | None]):
    """A short-lived, keyboard-first launcher that does not use the alternate screen."""

    CSS_PATH = "home.tcss"
    ENABLE_COMMAND_PALETTE = False
    BINDINGS = [
        Binding("q", "quit_home", "Quit", priority=True, show=False),
        Binding("escape", "quit_home", "Quit", priority=True, show=False),
        Binding("1", "choose('add')", "Add", priority=True, show=False),
        Binding("2", "choose('activity')", "Activity", priority=True, show=False),
        Binding("3", "choose('budgets')", "Budgets", priority=True, show=False),
        Binding("4", "choose('adjust')", "Update balance", priority=True, show=False),
        Binding("5", "choose('workspace')", "Workspace", priority=True, show=False),
    ]

    def __init__(self, snapshot: OverviewSnapshot) -> None:
        # Preserve the terminal's own background instead of resolving ANSI default
        # through Textual's dark theme into a painted RGB viewport.
        super().__init__(ansi_color=True)
        self.snapshot = snapshot

    def compose(self) -> ComposeResult:
        yield Static(self._brand(), id="brand")
        yield Static(self._pulse(), id="pulse")
        yield OptionList(
            *(
                Option(
                    self._option(number, title, description, selected=number == 1),
                    id=action,
                )
                for number, (action, title, description) in enumerate(_ACTIONS, start=1)
            ),
            id="actions",
            compact=True,
        )
        yield Static("↑↓ Navigate   Enter Select   1–5 Direct   Q Quit", id="shortcuts")

    def on_mount(self) -> None:
        actions = self.query_one("#actions", OptionList)
        actions.highlighted = 0
        actions.focus()

    def on_option_list_option_selected(self, event: OptionList.OptionSelected) -> None:
        self.exit(event.option.id)

    def on_option_list_option_highlighted(self, event: OptionList.OptionHighlighted) -> None:
        actions = self.query_one("#actions", OptionList)
        for index, (_, title, description) in enumerate(_ACTIONS):
            actions.replace_option_prompt_at_index(
                index,
                self._option(index + 1, title, description, selected=index == event.option_index),
            )

    def action_choose(self, action: str) -> None:
        self.exit(action)

    def action_quit_home(self) -> None:
        self.exit(None)

    def _brand(self) -> Text:
        context = f"{self.snapshot.year}-{self.snapshot.month:02d} · {self.snapshot.currency}"
        brand = Text()
        for art, copy, style in (
            ("  ______ _______  ", "FINANCE TRACKER", "bold #83c9c3"),
            (" |  ____|__   __| ", "Local-first money command center", "#a9b2c0"),
            (" | |__     | |    ", context, "#c8bd67"),
            (" |_|       |_|    ", "Your ledger stays on this machine.", "#667487"),
        ):
            brand.append(art, style="#c8bd67")
            brand.append(copy, style=style)
            brand.append("\n")
        return brand

    def _pulse(self) -> Text:
        report = self.snapshot.report
        currency = self.snapshot.currency
        attention = sum(status.status != "ok" for status in self.snapshot.budget_statuses)
        pulse = Text()
        pulse.append(" Income ", style="bold #83c9c3")
        pulse.append(f"{format_money(report.total_income, currency):<14}")
        pulse.append("Expenses ", style="bold #d99282")
        pulse.append(f"{format_money(report.total_expenses, currency):<14}")
        pulse.append("Net ", style="bold #83c9c3")
        pulse.append(format_money(report.net_savings, currency))
        pulse.append("\n")
        pulse.append(" Net worth ", style="bold #c8bd67")
        pulse.append(f"{format_money(self.snapshot.net_worth.total_net_worth, currency)}   ")
        pulse.append(f"{report.transaction_count} cashflow activities   ", style="#a9b2c0")
        pulse.append(f"{attention} budgets need attention", style="#a9b2c0")
        return pulse

    @staticmethod
    def _option(number: int, title: str, description: str, *, selected: bool) -> Text:
        option = Text()
        option.append("›" if selected else " ", style="bold #83c9c3")
        option.append(f" {number}. ", style="bold")
        option.append(f"{title:<21}", style="bold")
        option.append(description, style="#a9b2c0")
        return option
