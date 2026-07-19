"""Account lifecycle use cases backed by account activity."""

from datetime import date
from decimal import Decimal
from pathlib import Path

from finance_tracker.database import initialize_database
from finance_tracker.database import transaction as database_transaction
from finance_tracker.exceptions import ValidationError
from finance_tracker.models.accounts import (
    Account,
    ResolvedAccount,
    balance_state,
    parse_account_subtype,
    parse_balance_date,
)
from finance_tracker.models.activities import Activity, ActivityKind, ActivityRecord
from finance_tracker.models.common import validate_text
from finance_tracker.repositories.accounts import AccountRepository
from finance_tracker.repositories.activities import ActivityRepository
from finance_tracker.services.activities import (
    _record_by_id,
    calculate_account_balance,
)


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
        subtype: str = "other",
    ) -> Account:
        account = Account.create(name, account_type, subtype)
        effective_date = parse_balance_date(initial_balance_date)
        with database_transaction(self.db_path) as connection:
            stored = AccountRepository(connection).add(account)
            assert stored.id is not None
            ActivityRepository(connection).add(
                Activity.set_balance(
                    ActivityKind.OPENING,
                    initial_balance,
                    "Opening balance",
                    effective_date,
                    stored.id,
                )
            )
            return stored

    def list_accounts(
        self,
        as_of: str | date | None = None,
        *,
        include_archived: bool = False,
    ) -> list[ResolvedAccount]:
        resolved_date = parse_balance_date(as_of or date.today())
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection).list_all(include_archived=include_archived)
            return [self._resolve(connection, account, resolved_date) for account in accounts]

    def get_account(self, account_id: int) -> Account:
        with database_transaction(self.db_path) as connection:
            return AccountRepository(connection).get(account_id)

    def get_resolved_account(
        self, account_id: int, as_of: str | date | None = None
    ) -> ResolvedAccount:
        resolved_date = parse_balance_date(as_of or date.today())
        with database_transaction(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            return self._resolve(connection, account, resolved_date)

    def resolve_account_reference(self, reference: str | int) -> Account:
        with database_transaction(self.db_path) as connection:
            repository = AccountRepository(connection)
            return (
                repository.get(reference)
                if isinstance(reference, int)
                else repository.get_by_name(reference)
            )

    def edit_account(
        self, account_id: int, *, name: str | None = None, subtype: str | None = None
    ) -> Account:
        with database_transaction(self.db_path) as connection:
            repository = AccountRepository(connection)
            account = repository.get(account_id)
            self._require_active(account)
            clean_name = validate_text(name, "account name") if name is not None else account.name
            clean_subtype = (
                parse_account_subtype(subtype, account.type)
                if subtype is not None
                else account.subtype
            )
            return repository.update(account_id, clean_name, clean_subtype)

    def edit_account_name(self, account_id: int, name: str) -> Account:
        return self.edit_account(account_id, name=name)

    def adjust_account(
        self,
        account_id: int,
        observed_balance: str,
        effective_date: str | date,
        description: str = "Balance update",
    ) -> ActivityRecord:
        resolved_date = parse_balance_date(effective_date)
        with database_transaction(self.db_path) as connection:
            account = AccountRepository(connection).get(account_id)
            self._require_active(account)
            stored = ActivityRepository(connection).add(
                Activity.set_balance(
                    ActivityKind.ADJUSTMENT,
                    observed_balance,
                    description,
                    resolved_date,
                    account_id,
                )
            )
            assert stored.id is not None
            return _record_by_id(connection, stored.id)

    def archive_account(self, account_id: int, closing_date: str | date) -> Account:
        resolved_date = parse_balance_date(closing_date)
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection)
            activities = ActivityRepository(connection)
            account = accounts.get(account_id)
            self._require_active(account)
            if activities.has_activity_after(account_id, resolved_date):
                raise ValidationError("Account has activity after the closing date.")
            balance = calculate_account_balance(connection, account_id, resolved_date)
            if balance != Decimal("0.00"):
                raise ValidationError(
                    "Account balance must be zero on the closing date; "
                    f"calculated balance is {balance}."
                )
            return accounts.archive(account_id, resolved_date)

    def delete_account(self, account_id: int) -> None:
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection)
            activities = ActivityRepository(connection)
            account = accounts.get(account_id)
            self._require_active(account)
            if activities.count_for_account(account_id) != 1:
                raise ValidationError(
                    "Only an account with no activity beyond its opening entry can be deleted."
                )
            opening = activities.list_for_account(account_id)[0]
            if opening.kind is not ActivityKind.OPENING:
                raise ValidationError("Account opening activity is missing.")
            assert opening.id is not None
            activities.delete(opening.id)
            accounts.delete(account_id)

    def report_data(
        self, through: str | date | None = None
    ) -> tuple[list[Account], list[Activity]]:
        resolved_date = parse_balance_date(through or date.today())
        with database_transaction(self.db_path) as connection:
            accounts = AccountRepository(connection).list_all(include_archived=True)
            activities = [
                activity
                for activity in ActivityRepository(connection).list(descending=False)
                if activity.date <= resolved_date
            ]
            return accounts, activities

    @staticmethod
    def _resolve(connection, account: Account, as_of: date) -> ResolvedAccount:
        assert account.id is not None
        history = ActivityRepository(connection).list_for_account(
            account.id, through=as_of, descending=False
        )
        opening = next(
            (activity for activity in history if activity.kind is ActivityKind.OPENING),
            None,
        )
        if opening is None or opening.id is None:
            raise ValidationError(f"Account {account.id} has no opening activity.")
        return ResolvedAccount(
            account=account,
            as_of=as_of,
            balance=calculate_account_balance(connection, account.id, as_of),
            balance_state=balance_state(
                account.type, calculate_account_balance(connection, account.id, as_of)
            ),
            opening_balance=opening.amount,
            opening_date=opening.date,
            opening_activity_id=opening.id,
        )

    @staticmethod
    def _require_active(account: Account) -> None:
        if not account.active:
            raise ValidationError("Archived accounts cannot be changed.")
