"""SQLite persistence for transactions."""

import sqlite3
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import TransactionNotFoundError
from finance_tracker.models.transactions import (
    Transaction,
    TransactionFilters,
    TransactionType,
)
from finance_tracker.repositories.common import period_bounds


class TransactionRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add(self, transaction: Transaction) -> Transaction:
        cursor = self.connection.execute(
            """
            INSERT INTO transactions (type, amount, category, description, date)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                transaction.type.value,
                str(transaction.amount),
                transaction.category,
                transaction.description,
                transaction.date.isoformat(),
            ),
        )
        assert cursor.lastrowid is not None
        return self.get(cursor.lastrowid)

    def get(self, transaction_id: int) -> Transaction:
        row = self.connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        if row is None:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")
        return self._from_row(row)

    def update(self, transaction_id: int, transaction: Transaction) -> Transaction:
        cursor = self.connection.execute(
            """
            UPDATE transactions
            SET type = ?, amount = ?, category = ?, description = ?, date = ?
            WHERE id = ?
            """,
            (
                transaction.type.value,
                str(transaction.amount),
                transaction.category,
                transaction.description,
                transaction.date.isoformat(),
                transaction_id,
            ),
        )
        if cursor.rowcount == 0:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")
        return self.get(transaction_id)

    def list(
        self,
        filters: TransactionFilters | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Transaction]:
        filters = filters or TransactionFilters()
        clauses, params = _transaction_filter_sql(filters)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        pagination = ""
        if limit is not None:
            pagination = " LIMIT ? OFFSET ?"
            params.extend((limit, offset))
        rows = self.connection.execute(
            f"SELECT * FROM transactions {where} ORDER BY date DESC, id DESC{pagination}",
            params,
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def count_filtered(self, filters: TransactionFilters | None = None) -> int:
        clauses, params = _transaction_filter_sql(filters or TransactionFilters())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        row = self.connection.execute(
            f"SELECT COUNT(*) AS count FROM transactions {where}", params
        ).fetchone()
        return int(row["count"])

    def delete(self, transaction_id: int) -> None:
        cursor = self.connection.execute(
            "DELETE FROM transactions WHERE id = ?", (transaction_id,)
        )
        if cursor.rowcount == 0:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")

    def exists_matching(self, transaction: Transaction) -> bool:
        row = self.connection.execute(
            """
            SELECT 1 FROM transactions
            WHERE type = ?
              AND amount = ?
              AND LOWER(category) = LOWER(?)
              AND description = ?
              AND date = ?
            LIMIT 1
            """,
            (
                transaction.type.value,
                str(transaction.amount),
                transaction.category,
                transaction.description,
                transaction.date.isoformat(),
            ),
        ).fetchone()
        return row is not None

    def count(self) -> int:
        row = self.connection.execute("SELECT COUNT(*) AS count FROM transactions").fetchone()
        return int(row["count"])

    @staticmethod
    def _from_row(row: sqlite3.Row) -> Transaction:
        return Transaction(
            id=int(row["id"]),
            type=TransactionType(row["type"]),
            amount=Decimal(row["amount"]),
            category=row["category"],
            description=row["description"],
            date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
            created_at=datetime.fromisoformat(row["created_at"]),
        )


def _transaction_filter_sql(
    filters: TransactionFilters,
) -> tuple[list[str], list[str | int]]:
    clauses: list[str] = []
    params: list[str | int] = []
    if filters.month is not None and filters.year is not None:
        start, end = period_bounds(filters.year, filters.month)
        clauses.append("date >= ? AND date < ?")
        params.extend((start, end))
    elif filters.month is not None:
        clauses.append("CAST(strftime('%m', date) AS INTEGER) = ?")
        params.append(filters.month)
    elif filters.year is not None:
        clauses.append("date >= ? AND date < ?")
        params.extend((f"{filters.year:04d}-01-01", f"{filters.year + 1:04d}-01-01"))
    if filters.category is not None:
        clauses.append("LOWER(category) = LOWER(?)")
        params.append(filters.category)
    if filters.transaction_type is not None:
        clauses.append("type = ?")
        params.append(filters.transaction_type.value)
    return clauses, params
