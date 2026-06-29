"""Repository layer for SQLite persistence."""

import sqlite3
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import TransactionNotFoundError
from finance_tracker.models import Transaction, TransactionFilters, TransactionType


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
        self.connection.commit()
        return self.get(cursor.lastrowid)

    def get(self, transaction_id: int) -> Transaction:
        row = self.connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()
        if row is None:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")
        return self._from_row(row)

    def list(self, filters: TransactionFilters | None = None) -> list[Transaction]:
        filters = filters or TransactionFilters()
        clauses: list[str] = []
        params: list[str | int] = []

        if filters.month is not None:
            clauses.append("CAST(strftime('%m', date) AS INTEGER) = ?")
            params.append(filters.month)
        if filters.year is not None:
            clauses.append("CAST(strftime('%Y', date) AS INTEGER) = ?")
            params.append(filters.year)
        if filters.category is not None:
            clauses.append("LOWER(category) = LOWER(?)")
            params.append(filters.category)
        if filters.transaction_type is not None:
            clauses.append("type = ?")
            params.append(filters.transaction_type.value)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.connection.execute(
            f"SELECT * FROM transactions {where} ORDER BY date DESC, id DESC",
            params,
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def delete(self, transaction_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        self.connection.commit()
        if cursor.rowcount == 0:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")

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
