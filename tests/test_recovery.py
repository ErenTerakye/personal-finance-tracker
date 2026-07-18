import sqlite3

from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.services import (
    AccountService,
    BudgetService,
    CategoryRuleService,
    LedgerRecoveryService,
    RecurringTemplateService,
    SettingsService,
    TransactionService,
)


def test_complete_ledger_backup_and_restore_preserves_every_domain(tmp_path):
    ledger = tmp_path / "ledger.sqlite3"
    backup = tmp_path / "backups" / "ledger.sqlite3"
    transactions = TransactionService(ledger)
    transactions.add_transaction("expense", "12.50", "Food", "Lunch", "2026-07-18")
    BudgetService(ledger).set_budget("Food", "200", 7, 2026)
    CategoryRuleService(ledger).set_rule("groceries", "Food")
    RecurringTemplateService(ledger).add_template("income", "100", "Interest", "", 18)
    SettingsService(ledger).set_currency("TRY")
    accounts = AccountService(ledger)
    account = accounts.create_account("Checking", "asset", "500", "2026-07-18")

    recovery = LedgerRecoveryService(ledger)
    verification = recovery.backup(backup)
    transactions.delete_transaction(1)
    accounts.delete_account(account.id)
    recovery.restore(backup)

    assert verification.integrity == "ok"
    assert TransactionService(ledger).list_transactions()[0].description == "Lunch"
    assert BudgetService(ledger).list_budgets()[0].amount == 200
    assert CategoryRuleService(ledger).list_rules()[0].alias == "groceries"
    assert RecurringTemplateService(ledger).list_templates()[0].category == "Interest"
    assert SettingsService(ledger).get_currency() == "TRY"
    assert AccountService(ledger).list_accounts("2026-07-18")[0].balance == 500


def test_restore_rejects_corrupt_backup_without_replacing_ledger(tmp_path):
    ledger = tmp_path / "ledger.sqlite3"
    TransactionService(ledger).add_transaction("income", "10", "Other", "Safe", "2026-07-18")
    corrupt = tmp_path / "corrupt.sqlite3"
    corrupt.write_text("not sqlite", encoding="utf-8")

    try:
        LedgerRecoveryService(ledger).restore(corrupt)
    except Exception as exc:
        assert "Cannot read ledger backup" in str(exc)
    else:
        raise AssertionError("corrupt backup unexpectedly restored")

    assert TransactionService(ledger).list_transactions()[0].description == "Safe"


def test_recovery_cli_requires_confirmation_and_reports_verification(tmp_path):
    ledger = tmp_path / "ledger.sqlite3"
    backup = tmp_path / "ledger-backup.sqlite3"
    TransactionService(ledger).add_transaction("income", "10", "Other", "Safe", "2026-07-18")
    runner = CliRunner()

    created = runner.invoke(
        app, ["ledger-backup", str(backup), "--db-path", str(ledger)]
    )
    verified = runner.invoke(app, ["ledger-verify", str(backup)])
    refused = runner.invoke(
        app, ["ledger-restore", str(backup), "--db-path", str(ledger)]
    )
    restored = runner.invoke(
        app,
        ["ledger-restore", str(backup), "--confirm", "--db-path", str(ledger)],
    )

    assert created.exit_code == 0
    assert verified.exit_code == 0
    assert "integrity ok" in verified.output
    assert refused.exit_code == 1
    assert "Use --confirm" in refused.output
    assert restored.exit_code == 0


def test_verify_rejects_unsupported_schema_version(tmp_path):
    backup = tmp_path / "future.sqlite3"
    connection = sqlite3.connect(backup)
    try:
        connection.execute("PRAGMA user_version = 999")
        connection.commit()
    finally:
        connection.close()

    result = CliRunner().invoke(app, ["ledger-verify", str(backup)])

    assert result.exit_code == 1
    assert "Unsupported ledger schema version" in result.output
