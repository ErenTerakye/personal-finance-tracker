import json

from typer.testing import CliRunner

from finance_tracker.cli import app


def test_v2_json_success_and_error_envelopes(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "cli.sqlite3"
    added = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "--output",
            "json",
            "transaction",
            "add",
            "expense",
            "12.50",
            "--category",
            "Food",
        ],
    )
    invalid = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "--output",
            "json",
            "transaction",
            "add",
            "expense",
            "0",
            "--category",
            "Food",
        ],
    )

    assert added.exit_code == 0
    assert json.loads(added.output)["ok"] is True
    assert "Added #1" in json.loads(added.output)["data"]["messages"][0]
    assert invalid.exit_code == 1
    assert json.loads(invalid.output) == {
        "ok": False,
        "error": {
            "code": "command_error",
            "message": "Amount must be greater than zero.",
        },
    }


def test_v2_removed_command_reports_exact_migration_without_running(tmp_path):
    result = CliRunner().invoke(
        app,
        ["--db-path", str(tmp_path / "cli.sqlite3"), "budget-status"],
    )

    assert result.exit_code == 2
    assert "Command 'budget-status' moved in v2" in result.output
    assert "finance-tracker budget status" in result.output


def test_bare_command_renders_inline_home_without_requiring_a_tty(tmp_path):
    result = CliRunner().invoke(app, ["--db-path", str(tmp_path / "cli.sqlite3")])

    assert result.exit_code == 0
    assert "Finance Tracker" in result.output
    assert "Net worth" in result.output
    assert "Workspace: finance-tracker tui" in result.output


def test_bare_command_supports_machine_readable_output(tmp_path):
    result = CliRunner().invoke(
        app,
        ["--db-path", str(tmp_path / "cli.sqlite3"), "--output", "json"],
    )

    assert result.exit_code == 0
    payload = json.loads(result.output)
    assert payload["ok"] is True
    assert payload["data"]["report"]["transaction_count"] == 0


def test_inline_home_can_add_a_transaction(monkeypatch, tmp_path):
    answers = iter(["expense", "12.50", "Food", "Lunch", "2026-07-19"])
    monkeypatch.setattr("finance_tracker.cli.home.is_interactive_terminal", lambda: True)
    monkeypatch.setattr("finance_tracker.cli.home._launch_menu", lambda snapshot: "add")
    monkeypatch.setattr(
        "finance_tracker.cli.home.typer.prompt", lambda *args, **kwargs: next(answers)
    )
    db_path = tmp_path / "cli.sqlite3"

    added = CliRunner().invoke(app, ["--db-path", str(db_path)])
    listed = CliRunner().invoke(
        app,
        ["--db-path", str(db_path), "transaction", "list", "--month", "7", "--year", "2026"],
    )

    assert added.exit_code == 0
    assert "Added #1" in added.output
    assert listed.exit_code == 0
    assert "Lunch" in listed.output


def test_explicit_tui_command_still_requires_an_interactive_terminal():
    result = CliRunner().invoke(app, ["tui"])

    assert result.exit_code == 2
    assert "requires an interactive terminal" in result.output


def test_atomic_balance_check_in_and_global_confirmation(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "cli.sqlite3"
    for name in ("Cash", "Savings"):
        created = runner.invoke(
            app,
            [
                "--db-path",
                str(db_path),
                "account",
                "add",
                "--name",
                name,
                "--type",
                "asset",
                "--balance",
                "10",
                "--date",
                "2026-07-01",
            ],
        )
        assert created.exit_code == 0

    checked_in = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "account",
            "balance",
            "check-in",
            "--date",
            "2026-07-19",
            "--balance",
            "1=125.50",
            "--balance",
            "2=250.25",
        ],
    )
    deleted = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "--yes",
            "account",
            "delete",
            "2",
        ],
    )

    assert checked_in.exit_code == 0
    assert "Recorded 2 balance(s)" in checked_in.output
    # The account now has two snapshots, so domain safety still rejects deletion despite --yes.
    assert deleted.exit_code == 1
    assert "exactly one snapshot" in deleted.output
