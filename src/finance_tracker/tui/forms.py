"""Reusable modal forms for terminal workflows."""

from __future__ import annotations

from dataclasses import dataclass

from textual.app import ComposeResult
from textual.containers import Horizontal, VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Label, Static


@dataclass(frozen=True)
class FormField:
    key: str
    label: str
    value: str = ""
    placeholder: str = ""
    password: bool = False


class FormScreen(ModalScreen[dict[str, str] | None]):
    """Small labeled form which returns trimmed string values."""

    BINDINGS = [("escape", "cancel", "Cancel")]

    def __init__(
        self,
        title: str,
        fields: list[FormField],
        *,
        submit_label: str = "Save",
        note: str | None = None,
        danger: bool = False,
    ) -> None:
        super().__init__()
        self.form_title = title
        self.fields = fields
        self.submit_label = submit_label
        self.note = note
        self.danger = danger

    def compose(self) -> ComposeResult:
        with VerticalScroll(id="form-dialog"):
            yield Static(self.form_title, classes="view-title")
            if self.note:
                yield Static(self.note, classes="danger-note" if self.danger else "context-line")
            with VerticalScroll(id="form-fields"):
                for field in self.fields:
                    yield Label(field.label, classes="field-label", id=f"label-{field.key}")
                    yield Input(
                        value=field.value,
                        placeholder=field.placeholder,
                        password=field.password,
                        id=f"field-{field.key}",
                    )
            with Horizontal(classes="dialog-actions"):
                yield Button("Cancel", id="cancel")
                yield Button(
                    self.submit_label, variant="error" if self.danger else "primary", id="submit"
                )

    def on_mount(self) -> None:
        if self.fields:
            self.query_one(f"#field-{self.fields[0].key}", Input).focus()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel":
            self.dismiss(None)
            return
        values = {
            field.key: self.query_one(f"#field-{field.key}", Input).value.strip()
            for field in self.fields
        }
        self.dismiss(values)

    def action_cancel(self) -> None:
        self.dismiss(None)


class HelpScreen(ModalScreen[None]):
    BINDINGS = [("escape", "dismiss_help", "Close"), ("?", "dismiss_help", "Close")]

    def compose(self) -> ComposeResult:
        with VerticalScroll(id="help-dialog"):
            yield Static("Keyboard guide", classes="view-title")
            yield Static(
                "1–5  Switch workspace     Ctrl+P  Command palette\n"
                "/    Focus search        A       Add transaction\n"
                "R    Refresh current data ?       Toggle this guide\n"
                "Q    Quit                  Esc     Close a dialog\n\n"
                "Tables support arrow-key navigation and Enter opens an edit form. "
                "Every workflow is also available through grouped commands."
            )
            with Horizontal(classes="dialog-actions"):
                yield Button("Close", variant="primary", id="close")

    def on_button_pressed(self, _event: Button.Pressed) -> None:
        self.dismiss(None)

    def action_dismiss_help(self) -> None:
        self.dismiss(None)
