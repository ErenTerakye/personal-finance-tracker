from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from typer.testing import CliRunner

from finance_tracker.cli import app
from finance_tracker.database import connect
from finance_tracker.exceptions import AccountNotFoundError, ValidationError
from finance_tracker.reports import build_net_worth_history, build_net_worth_summary
from finance_tracker.repositories import BalanceSnapshotRepository
from finance_tracker.services import AccountService
from finance_tracker.web.app import create_app


def test_account_service_resolves_as_of_balances_and_replaces_same_day(tmp_path):
    service = AccountService(tmp_path / "finance.sqlite3")
    cash = service.create_account("Cash", "asset", "1000.10", "2026-01-01")
    card = service.create_account("Card", "liability", "250.05", "2026-01-10")
    assert cash.id is not None
    assert card.id is not None

    created = service.set_balance(cash.id, "1200.25", "2026-06-01")
    replaced = service.set_balance(cash.id, "1250.35", "2026-06-01")
    historical = service.list_accounts("2026-05-31", include_archived=True)
    current = service.list_accounts("2026-06-01", include_archived=True)

    assert created.replaced is False
    assert replaced.replaced is True
    assert {item.account.name: item.balance for item in historical} == {
        "Card": Decimal("250.05"),
        "Cash": Decimal("1000.10"),
    }
    assert {item.account.name: item.balance for item in current}["Cash"] == Decimal(
        "1250.35"
    )
    assert len(service.list_snapshots(cash.id)) == 2


def test_net_worth_reports_assets_minus_liabilities_and_unresolved_history(tmp_path):
    service = AccountService(tmp_path / "finance.sqlite3")
    asset = service.create_account("Savings", "asset", "1000", "2026-03-10")
    liability = service.create_account("Loan", "liability", "1200", "2026-04-01")
    assert asset.id is not None
    assert liability.id is not None
    service.set_balance(asset.id, "1600", "2026-06-30")
    service.set_balance(liability.id, "1000", "2026-06-30")
    accounts, snapshots = service.report_data("2026-07-16")

    march = build_net_worth_summary(accounts, snapshots, date(2026, 3, 31))
    june = build_net_worth_summary(accounts, snapshots, date(2026, 6, 30))
    history = build_net_worth_history(
        accounts,
        snapshots,
        date(2026, 7, 16),
        months=4,
    )

    assert march.total_assets == Decimal("1000.00")
    assert march.total_liabilities == Decimal("0.00")
    assert march.unresolved_account_count == 1
    assert june.total_net_worth == Decimal("600.00")
    assert [point.as_of for point in history.points] == [
        date(2026, 4, 30),
        date(2026, 5, 31),
        date(2026, 6, 30),
        date(2026, 7, 16),
    ]
    assert history.change_amount == Decimal("0.00")
    assert history.change_percent == Decimal("0.0")


def test_zero_prior_net_worth_omits_history_percentage(tmp_path):
    service = AccountService(tmp_path / "finance.sqlite3")
    asset = service.create_account("Cash", "asset", "100", "2026-05-01")
    liability = service.create_account("Card", "liability", "100", "2026-05-01")
    assert asset.id is not None
    assert liability.id is not None
    service.set_balance(asset.id, "150", "2026-06-01")
    accounts, snapshots = service.report_data("2026-06-30")

    history = build_net_worth_history(
        accounts,
        snapshots,
        date(2026, 6, 30),
        months=2,
    )

    assert history.change_amount == Decimal("50.00")
    assert history.change_percent is None


def test_archive_records_closing_zero_and_protects_mutation(tmp_path):
    service = AccountService(tmp_path / "finance.sqlite3")
    account = service.create_account("Old car", "asset", "5000", "2026-01-01")
    assert account.id is not None

    archived = service.archive_account(
        account.id,
        "2026-06-30",
        confirm_zero_balance=True,
    )
    before = service.list_accounts("2026-06-29", include_archived=True)[0]
    after = service.list_accounts("2026-06-30", include_archived=True)[0]

    assert archived.archived_on == date(2026, 6, 30)
    assert before.balance == Decimal("5000.00")
    assert after.balance == Decimal("0.00")
    with pytest.raises(ValidationError, match="Archived accounts"):
        service.set_balance(account.id, "10", "2026-07-01")


def test_snapshot_and_account_deletion_guards(tmp_path):
    service = AccountService(tmp_path / "finance.sqlite3")
    account = service.create_account("Correction", "asset", "10", "2026-01-01")
    assert account.id is not None

    with pytest.raises(ValidationError, match="sole balance"):
        service.delete_snapshot(account.id, "2026-01-01")
    service.set_balance(account.id, "20", "2026-02-01")
    with pytest.raises(ValidationError, match="exactly one snapshot"):
        service.delete_account(account.id)
    service.delete_snapshot(account.id, "2026-02-01")
    service.delete_account(account.id)
    with pytest.raises(AccountNotFoundError):
        service.get_account(account.id)


@pytest.mark.parametrize(
    ("operation", "message"),
    [
        (lambda service, account_id: service.set_balance(account_id, "-1", "2026-01-01"), "zero"),
        (
            lambda service, account_id: service.set_balance(
                account_id, "1", "2099-01-01"
            ),
            "future",
        ),
        (
            lambda service, account_id: service.archive_account(
                account_id,
                "2025-12-31",
                confirm_zero_balance=True,
            ),
            "earlier",
        ),
    ],
)
def test_account_validation_rejects_invalid_balance_lifecycle(
    tmp_path, operation, message
):
    service = AccountService(tmp_path / "finance.sqlite3")
    account = service.create_account("Cash", "asset", "10", "2026-01-01")
    assert account.id is not None
    with pytest.raises(ValidationError, match=message):
        operation(service, account.id)


def test_account_creation_rolls_back_when_initial_snapshot_fails(tmp_path, monkeypatch):
    db_path = tmp_path / "finance.sqlite3"
    service = AccountService(db_path)

    def fail_snapshot(self, snapshot):
        raise RuntimeError("forced snapshot failure")

    monkeypatch.setattr(BalanceSnapshotRepository, "upsert", fail_snapshot)

    with pytest.raises(RuntimeError, match="forced snapshot failure"):
        service.create_account("Cash", "asset", "10", "2026-01-01")

    with connect(db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0


def test_cli_account_and_net_worth_flow(tmp_path):
    runner = CliRunner()
    db_path = tmp_path / "finance.sqlite3"
    add_asset = runner.invoke(
        app,
        [
            "account-add",
            "--name",
            "Cash",
            "--type",
            "asset",
            "--balance",
            "1000",
            "--date",
            "2026-01-01",
            "--db-path",
            str(db_path),
        ],
    )
    add_liability = runner.invoke(
        app,
        [
            "account-add",
            "--name",
            "Card",
            "--type",
            "liability",
            "--balance",
            "250",
            "--date",
            "2026-01-01",
            "--db-path",
            str(db_path),
        ],
    )
    summary = runner.invoke(
        app,
        ["net-worth", "--as-of", "2026-07-16", "--db-path", str(db_path)],
    )
    history = runner.invoke(
        app,
        [
            "net-worth-history",
            "--months",
            "2",
            "--as-of",
            "2026-07-16",
            "--db-path",
            str(db_path),
        ],
    )

    assert add_asset.exit_code == 0
    assert add_liability.exit_code == 0
    assert "Assets:       $1,000.00" in summary.output
    assert "Liabilities:  $250.00" in summary.output
    assert "Net worth:    $750.00" in summary.output
    assert "2026-06-30" in history.output
    assert "2026-07-16" in history.output


def test_api_account_snapshot_archive_and_net_worth_flow(tmp_path):
    client = TestClient(create_app(tmp_path / "finance.sqlite3"))
    created = client.post(
        "/api/accounts",
        json={
            "name": "Savings",
            "type": "asset",
            "initial_balance": "1000.00",
            "initial_balance_date": "2026-01-01",
        },
    )
    set_balance = client.put(
        "/api/accounts/1/balance-snapshots/2026-06-30",
        json={"amount": "1250.50"},
    )
    summary = client.get("/api/net-worth", params={"as_of": "2026-07-16"})
    history = client.get(
        "/api/net-worth/history",
        params={"as_of": "2026-07-16", "months": 2},
    )
    archive_without_confirmation = client.post(
        "/api/accounts/1/archive",
        json={"closing_date": "2026-07-16", "confirm_zero_balance": False},
    )
    archived = client.post(
        "/api/accounts/1/archive",
        json={"closing_date": "2026-07-16", "confirm_zero_balance": True},
    )

    assert created.status_code == 201
    assert created.json()["account"]["resolved_balance"] == "1000.00"
    assert set_balance.json()["snapshot"]["amount"] == "1250.50"
    assert summary.json()["total_net_worth"] == "1250.50"
    assert history.json()["points"][-1]["as_of"] == "2026-07-16"
    assert archive_without_confirmation.status_code == 400
    assert archived.json()["account"]["archived_on"] == "2026-07-16"
    assert client.get("/api/accounts").json()["accounts"] == []
    assert len(
        client.get(
            "/api/accounts",
            params={"include_archived": True},
        ).json()["accounts"]
    ) == 1
