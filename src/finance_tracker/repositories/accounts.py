"""SQLite persistence for accounts."""

import sqlite3
from datetime import date, datetime

from finance_tracker.exceptions import AccountNotFoundError, ValidationError
from finance_tracker.models.accounts import Account, AccountSubtype, AccountType


class AccountRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add(self, account: Account) -> Account:
        try:
            cursor = self.connection.execute(
                "INSERT INTO accounts (name, type, subtype) VALUES (?, ?, ?)",
                (account.name, account.type.value, account.subtype.value),
            )
        except sqlite3.IntegrityError as exc:
            if "accounts.name" in str(exc):
                raise ValidationError("Account names must be unique.") from exc
            raise
        assert cursor.lastrowid is not None
        return self.get(cursor.lastrowid)

    def get(self, account_id: int) -> Account:
        row = self.connection.execute(
            "SELECT * FROM accounts WHERE id = ?", (account_id,)
        ).fetchone()
        if row is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        return self._from_row(row)

    def get_by_name(self, name: str) -> Account:
        row = self.connection.execute(
            "SELECT * FROM accounts WHERE name = ? COLLATE NOCASE", (name.strip(),)
        ).fetchone()
        if row is None:
            raise AccountNotFoundError(f"Account '{name}' was not found.")
        return self._from_row(row)

    def update(self, account_id: int, name: str, subtype: AccountSubtype) -> Account:
        try:
            cursor = self.connection.execute(
                "UPDATE accounts SET name = ?, subtype = ? WHERE id = ?",
                (name, subtype.value, account_id),
            )
        except sqlite3.IntegrityError as exc:
            if "accounts.name" in str(exc):
                raise ValidationError("Account names must be unique.") from exc
            raise
        if cursor.rowcount == 0:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        return self.get(account_id)

    def archive(self, account_id: int, archived_on: date) -> Account:
        cursor = self.connection.execute(
            "UPDATE accounts SET archived_on = ? WHERE id = ?",
            (archived_on.isoformat(), account_id),
        )
        if cursor.rowcount == 0:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        return self.get(account_id)

    def delete(self, account_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        if cursor.rowcount == 0:
            raise AccountNotFoundError(f"Account {account_id} was not found.")

    def list_all(self, *, include_archived: bool = True) -> list[Account]:
        where = "" if include_archived else "WHERE archived_on IS NULL"
        rows = self.connection.execute(
            f"""
            SELECT * FROM accounts {where}
            ORDER BY CASE WHEN archived_on IS NULL THEN 0 ELSE 1 END,
                     CASE WHEN type = 'asset' THEN 0 ELSE 1 END,
                     name COLLATE NOCASE, id
            """
        ).fetchall()
        return [self._from_row(row) for row in rows]

    @staticmethod
    def _from_row(row: sqlite3.Row) -> Account:
        return Account(
            id=int(row["id"]),
            name=str(row["name"]),
            type=AccountType(row["type"]),
            subtype=AccountSubtype(row["subtype"]),
            archived_on=date.fromisoformat(row["archived_on"]) if row["archived_on"] else None,
            created_at=datetime.fromisoformat(row["created_at"]),
        )
