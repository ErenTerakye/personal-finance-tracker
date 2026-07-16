"""Account lifecycle use cases and transaction boundaries."""

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from finance_tracker.database import connect, initialize_database
from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import (
    Account,
    BalanceSnapshot,
    ResolvedAccount,
    parse_snapshot_date,
)
from finance_tracker.models.common import validate_text
from finance_tracker.repositories.accounts import (
    AccountRepository,
    BalanceSnapshotRepository,
)


@dataclass(frozen=True)
class SnapshotMutation:
    snapshot: BalanceSnapshot
    replaced: bool


@dataclass(frozen=True)
class BalanceCheckInResult:
    snapshots: list[BalanceSnapshot]
    replaced_count: int


class AccountService:
    def __init__(self, db_path: Path | str, *, initialize: bool = True) -> None:
        self.db_path = Path(db_path)
        if initialize:
            initialize_database(self.db_path)

    def create_account(
        self,
        name: str,
        account_type: str,
        initial_balance: str,
        initial_balance_date: str | date,
    ) -> Account:
        account = Account.create(name, account_type)
        effective_date = parse_snapshot_date(initial_balance_date)
        with connect(self.db_path) as connection:
            stored = AccountRepository(connection).add(account)
            assert stored.id is not None
            BalanceSnapshotRepository(connection).upsert(
                BalanceSnapshot.create(stored.id, initial_balance, effective_date)
            )
            return stored

    def list_accounts(
        self,
        as_of: str | date | None = None,
        *,
        include_archived: bool = False,
    ) -> list[ResolvedAccount]:
        resolved_date = parse_snapshot_date(as_of or date.today())
        with connect(self.db_path) as connection:
            return AccountRepository(connection).list_resolved(
                resolved_date,
                include_archived=include_archived,
            )

    def get_account(self, account_id: int) -> Account:
        with connect(self.db_path) as connection:
            return AccountRepository(connection).get(account_id)

    def edit_account_name(self, account_id: int, name: str) -> Account:
        clean_name = validate_text(name, "account name")
        with connect(self.db_path) as connection:
            repository = AccountRepository(connection)
            account = repository.get(account_id)
            self._require_active(account)
            return repository.update_name(account_id, clean_name)

    def set_balance(
        self,
        account_id: int,
        amount: str,
        effective_date: str | date,
    ) -> SnapshotMutation:
        snapshot = BalanceSnapshot.create(account_id, amount, effective_date)
        with connect(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            self._require_active(account)
            stored, replaced = BalanceSnapshotRepository(connection).upsert(snapshot)
            return SnapshotMutation(snapshot=stored, replaced=replaced)

    def check_in_balances(
        self,
        effective_date: str | date,
        updates: list[tuple[int, str]],
    ) -> BalanceCheckInResult:
        resolved_date = parse_snapshot_date(effective_date)
        if not updates:
            raise ValidationError("Update at least one account balance.")
        account_ids = [account_id for account_id, _amount in updates]
        if len(account_ids) != len(set(account_ids)):
            raise ValidationError("Each account can be updated only once per check-in.")
        prepared = [
            BalanceSnapshot.create(account_id, amount, resolved_date)
            for account_id, amount in updates
        ]
        with connect(self.db_path) as connection:
            accounts = AccountRepository(connection)
            snapshots = BalanceSnapshotRepository(connection)
            for snapshot in prepared:
                self._require_active(accounts.get(snapshot.account_id))
            stored: list[BalanceSnapshot] = []
            replaced_count = 0
            for snapshot in prepared:
                item, replaced = snapshots.upsert(snapshot)
                stored.append(item)
                replaced_count += int(replaced)
            return BalanceCheckInResult(
                snapshots=stored,
                replaced_count=replaced_count,
            )

    def list_snapshots(self, account_id: int) -> list[BalanceSnapshot]:
        with connect(self.db_path) as connection:
            AccountRepository(connection).get(account_id)
            return BalanceSnapshotRepository(connection).list_for_account(account_id)

    def delete_snapshot(self, account_id: int, effective_date: str | date) -> None:
        resolved_date = parse_snapshot_date(effective_date)
        with connect(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            self._require_active(account)
            snapshots = BalanceSnapshotRepository(connection)
            if snapshots.count_for_account(account_id) <= 1:
                raise ValidationError(
                    "The sole balance snapshot cannot be deleted."
                )
            snapshots.delete(account_id, resolved_date)

    def archive_account(
        self,
        account_id: int,
        closing_date: str | date,
        *,
        confirm_zero_balance: bool,
    ) -> Account:
        if not confirm_zero_balance:
            raise ValidationError(
                "Archiving requires confirmation that a closing zero balance will be recorded."
            )
        resolved_date = parse_snapshot_date(closing_date)
        with connect(self.db_path) as connection:
            accounts = AccountRepository(connection)
            snapshots = BalanceSnapshotRepository(connection)
            account = accounts.get(account_id)
            self._require_active(account)
            latest = snapshots.latest_for_account(account_id)
            if resolved_date < latest.effective_date:
                raise ValidationError(
                    "Closing date cannot be earlier than the latest balance snapshot."
                )
            snapshots.upsert(BalanceSnapshot.create(account_id, "0", resolved_date))
            return accounts.archive(account_id, resolved_date)

    def delete_account(self, account_id: int) -> None:
        with connect(self.db_path) as connection:
            accounts = AccountRepository(connection)
            snapshots = BalanceSnapshotRepository(connection)
            account = accounts.get(account_id)
            self._require_active(account)
            if snapshots.count_for_account(account_id) != 1:
                raise ValidationError(
                    "Only an active account with exactly one snapshot can be deleted."
                )
            accounts.delete(account_id)

    def report_data(
        self,
        through: str | date | None = None,
    ) -> tuple[list[Account], list[BalanceSnapshot]]:
        resolved_date = parse_snapshot_date(through or date.today())
        with connect(self.db_path) as connection:
            return (
                AccountRepository(connection).list_all(),
                BalanceSnapshotRepository(connection).list_all(through=resolved_date),
            )

    @staticmethod
    def _require_active(account: Account) -> None:
        if not account.active:
            raise ValidationError("Archived accounts cannot be changed.")
