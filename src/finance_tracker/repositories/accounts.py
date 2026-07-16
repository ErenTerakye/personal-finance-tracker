"""SQLite persistence for accounts and dated balance snapshots."""

import sqlite3
from datetime import date, datetime
from decimal import Decimal

from finance_tracker.exceptions import AccountNotFoundError, ValidationError
from finance_tracker.models.accounts import (
    Account,
    AccountType,
    BalanceSnapshot,
    ResolvedAccount,
)


class AccountRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add(self, account: Account) -> Account:
        cursor = self.connection.execute(
            "INSERT INTO accounts (name, type) VALUES (?, ?)",
            (account.name, account.type.value),
        )
        assert cursor.lastrowid is not None
        return self.get(cursor.lastrowid)

    def get(self, account_id: int) -> Account:
        row = self.connection.execute(
            "SELECT * FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
        if row is None:
            raise AccountNotFoundError(f"Account {account_id} was not found.")
        return self._account_from_row(row)

    def update_name(self, account_id: int, name: str) -> Account:
        cursor = self.connection.execute(
            "UPDATE accounts SET name = ? WHERE id = ?",
            (name, account_id),
        )
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

    def list_resolved(
        self,
        as_of: date,
        *,
        include_archived: bool = False,
    ) -> list[ResolvedAccount]:
        archived_clause = "" if include_archived else "WHERE a.archived_on IS NULL"
        rows = self.connection.execute(
            f"""
            SELECT
                a.*,
                s.amount AS resolved_amount,
                s.effective_date AS resolved_date
            FROM accounts AS a
            LEFT JOIN account_balance_snapshots AS s
              ON s.account_id = a.id
             AND s.effective_date = (
                SELECT MAX(candidate.effective_date)
                FROM account_balance_snapshots AS candidate
                WHERE candidate.account_id = a.id
                  AND candidate.effective_date <= ?
             )
            {archived_clause}
            ORDER BY
                CASE WHEN a.archived_on IS NULL THEN 0 ELSE 1 END,
                CASE WHEN a.type = 'asset' THEN 0 ELSE 1 END,
                LOWER(a.name),
                a.id
            """,
            (as_of.isoformat(),),
        ).fetchall()
        return [
            ResolvedAccount(
                account=self._account_from_row(row),
                as_of=as_of,
                balance=(
                    Decimal(row["resolved_amount"])
                    if row["resolved_amount"] is not None
                    else None
                ),
                balance_date=(
                    date.fromisoformat(row["resolved_date"])
                    if row["resolved_date"] is not None
                    else None
                ),
            )
            for row in rows
        ]

    def list_all(self) -> list[Account]:
        rows = self.connection.execute(
            """
            SELECT * FROM accounts
            ORDER BY
                CASE WHEN archived_on IS NULL THEN 0 ELSE 1 END,
                CASE WHEN type = 'asset' THEN 0 ELSE 1 END,
                LOWER(name),
                id
            """
        ).fetchall()
        return [self._account_from_row(row) for row in rows]

    @staticmethod
    def _account_from_row(row: sqlite3.Row) -> Account:
        return Account(
            id=int(row["id"]),
            name=row["name"],
            type=AccountType(row["type"]),
            archived_on=(
                date.fromisoformat(row["archived_on"]) if row["archived_on"] else None
            ),
            created_at=datetime.fromisoformat(row["created_at"]),
        )


class BalanceSnapshotRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def upsert(self, snapshot: BalanceSnapshot) -> tuple[BalanceSnapshot, bool]:
        existing = self.find(snapshot.account_id, snapshot.effective_date)
        if existing is None:
            cursor = self.connection.execute(
                """
                INSERT INTO account_balance_snapshots
                    (account_id, amount, effective_date)
                VALUES (?, ?, ?)
                """,
                (
                    snapshot.account_id,
                    str(snapshot.amount),
                    snapshot.effective_date.isoformat(),
                ),
            )
            assert cursor.lastrowid is not None
            return self.get(cursor.lastrowid), False
        self.connection.execute(
            """
            UPDATE account_balance_snapshots
            SET amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (str(snapshot.amount), existing.id),
        )
        assert existing.id is not None
        return self.get(existing.id), True

    def get(self, snapshot_id: int) -> BalanceSnapshot:
        row = self.connection.execute(
            "SELECT * FROM account_balance_snapshots WHERE id = ?",
            (snapshot_id,),
        ).fetchone()
        if row is None:
            raise ValidationError(f"Balance snapshot {snapshot_id} was not found.")
        return self._snapshot_from_row(row)

    def find(self, account_id: int, effective_date: date) -> BalanceSnapshot | None:
        row = self.connection.execute(
            """
            SELECT * FROM account_balance_snapshots
            WHERE account_id = ? AND effective_date = ?
            """,
            (account_id, effective_date.isoformat()),
        ).fetchone()
        return self._snapshot_from_row(row) if row is not None else None

    def list_for_account(self, account_id: int) -> list[BalanceSnapshot]:
        rows = self.connection.execute(
            """
            SELECT * FROM account_balance_snapshots
            WHERE account_id = ?
            ORDER BY effective_date DESC, id DESC
            """,
            (account_id,),
        ).fetchall()
        return [self._snapshot_from_row(row) for row in rows]

    def list_all(self, *, through: date | None = None) -> list[BalanceSnapshot]:
        where = "WHERE effective_date <= ?" if through is not None else ""
        params = (through.isoformat(),) if through is not None else ()
        rows = self.connection.execute(
            f"""
            SELECT * FROM account_balance_snapshots
            {where}
            ORDER BY account_id, effective_date, id
            """,
            params,
        ).fetchall()
        return [self._snapshot_from_row(row) for row in rows]

    def count_for_account(self, account_id: int) -> int:
        row = self.connection.execute(
            "SELECT COUNT(*) AS count FROM account_balance_snapshots WHERE account_id = ?",
            (account_id,),
        ).fetchone()
        return int(row["count"])

    def latest_for_account(self, account_id: int) -> BalanceSnapshot:
        row = self.connection.execute(
            """
            SELECT * FROM account_balance_snapshots
            WHERE account_id = ?
            ORDER BY effective_date DESC, id DESC
            LIMIT 1
            """,
            (account_id,),
        ).fetchone()
        if row is None:
            raise ValidationError("Every account must retain at least one balance snapshot.")
        return self._snapshot_from_row(row)

    def delete(self, account_id: int, effective_date: date) -> None:
        cursor = self.connection.execute(
            """
            DELETE FROM account_balance_snapshots
            WHERE account_id = ? AND effective_date = ?
            """,
            (account_id, effective_date.isoformat()),
        )
        if cursor.rowcount == 0:
            raise ValidationError(
                f"No balance snapshot exists for {effective_date.isoformat()}."
            )

    @staticmethod
    def _snapshot_from_row(row: sqlite3.Row) -> BalanceSnapshot:
        return BalanceSnapshot(
            id=int(row["id"]),
            account_id=int(row["account_id"]),
            amount=Decimal(row["amount"]),
            effective_date=date.fromisoformat(row["effective_date"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )
