"""Machine-readable envelope support for existing thin command adapters."""

from __future__ import annotations

import json
from collections.abc import Callable
from contextlib import redirect_stderr, redirect_stdout
from functools import wraps
from io import StringIO

import typer

from finance_tracker.cli.runtime import current_runtime


def json_command[**P, R](function: Callable[P, R]) -> Callable[P, R]:
    """Capture a command's human notices in a predictable JSON envelope."""

    @wraps(function)
    def wrapped(*args: P.args, **kwargs: P.kwargs) -> R:
        if current_runtime().output != "json":
            return function(*args, **kwargs)
        stdout = StringIO()
        stderr = StringIO()
        try:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                result = function(*args, **kwargs)
        except typer.Exit:
            message = (stderr.getvalue() or stdout.getvalue()).strip()
            if message.startswith("Error: "):
                message = message.removeprefix("Error: ")
            typer.echo(
                json.dumps(
                    {
                        "ok": False,
                        "error": {"code": "command_error", "message": message},
                    }
                ),
                err=True,
            )
            raise
        messages = [line for line in stdout.getvalue().splitlines() if line]
        typer.echo(json.dumps({"ok": True, "data": {"messages": messages}}))
        return result

    return wrapped
