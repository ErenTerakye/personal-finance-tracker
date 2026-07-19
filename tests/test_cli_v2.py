import json

from typer.main import get_command
from typer.testing import CliRunner

from finance_tracker.cli.app import app


def _add_account(runner, db_path, name="Checking", account_type="asset", subtype="cash"):
    return runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "account",
            "add",
            "--name",
            name,
            "--type",
            account_type,
            "--subtype",
            subtype,
            "--balance",
            "100",
            "--date",
            "2026-01-01",
        ],
    )


def test_grouped_cli_exposes_canonical_activity_and_account_adjust_commands():
    root = get_command(app)
    assert "activity" in root.commands
    assert "transaction" not in root.commands
    assert set(root.commands["activity"].commands) == {
        "add",
        "transfer",
        "list",
        "edit",
        "delete",
        "import",
        "export",
    }
    assert "adjust" in root.commands["account"].commands
    assert "balance" not in root.commands["account"].commands


def test_cli_activity_add_transfer_list_adjust_and_delete_flow(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "ledger.sqlite3"
    assert _add_account(runner, db_path).exit_code == 0
    assert _add_account(runner, db_path, "Savings").exit_code == 0
    added = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "activity",
            "add",
            "expense",
            "12.50",
            "--account",
            "1",
            "--category",
            "Food",
            "--date",
            "2026-06-01",
        ],
    )
    transferred = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "activity",
            "transfer",
            "20",
            "--from-account",
            "1",
            "--to-account",
            "2",
            "--date",
            "2026-06-02",
        ],
    )
    adjusted = runner.invoke(
        app,
        ["--db-path", str(db_path), "account", "adjust", "1", "70", "--date", "2026-06-03"],
    )
    listed = runner.invoke(app, ["--db-path", str(db_path), "activity", "list"])
    refused = runner.invoke(app, ["--db-path", str(db_path), "activity", "delete", "3"])
    deleted = runner.invoke(
        app, ["--db-path", str(db_path), "activity", "delete", "3", "--confirm"]
    )

    assert added.exit_code == transferred.exit_code == adjusted.exit_code == 0
    assert "Checking" in listed.output and "Checking → Savings" in listed.output
    assert refused.exit_code == 1 and "--confirm" in refused.output
    assert deleted.exit_code == 0


def test_cli_json_envelopes_and_bare_home_are_activity_aware(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "ledger.sqlite3"
    assert _add_account(runner, db_path).exit_code == 0
    added = runner.invoke(
        app,
        [
            "--db-path",
            str(db_path),
            "--output",
            "json",
            "activity",
            "add",
            "income",
            "10",
            "--account",
            "1",
            "--category",
            "Other",
        ],
    )
    home = runner.invoke(app, ["--db-path", str(db_path), "--output", "json"])

    assert json.loads(added.output)["ok"] is True
    payload = json.loads(home.output)
    assert payload["ok"] is True
    assert "recent_activities" in payload["data"]
    assert "recent_transactions" not in payload["data"]


def test_inline_home_guided_add_requires_and_uses_an_account(monkeypatch, tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "ledger.sqlite3"
    _add_account(runner, db_path)
    answers = iter(["expense", "12.50", "Food", "Lunch", "2026-07-19", 1])
    monkeypatch.setattr("finance_tracker.cli.home.is_interactive_terminal", lambda: True)
    monkeypatch.setattr("finance_tracker.cli.home._launch_menu", lambda snapshot: "add")
    monkeypatch.setattr(
        "finance_tracker.cli.home.typer.prompt", lambda *args, **kwargs: next(answers)
    )

    result = runner.invoke(app, ["--db-path", str(db_path)])

    assert result.exit_code == 0
    assert "Added activity" in result.output
    assert "Checking" in result.output
