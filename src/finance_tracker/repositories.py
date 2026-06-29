"""Repository layer for SQLite persistence."""

import sqlite3
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import BudgetNotFoundError, TransactionNotFoundError
from finance_tracker.models import (
    Budget,
    BudgetFilters,
    Transaction,
    TransactionFilters,
    TransactionType,
)


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
        self.connection.commit()
        if cursor.rowcount == 0:
            raise TransactionNotFoundError(f"Transaction {transaction_id} was not found.")
        return self.get(transaction_id)

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


class BudgetRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def set(self, budget: Budget) -> Budget:
        existing = self.find_for_period_category(
            category=budget.category,
            month=budget.month,
            year=budget.year,
        )
        if existing is None:
            return self.add(budget)
        return self.update(existing.id, budget)

    def add(self, budget: Budget) -> Budget:
        cursor = self.connection.execute(
            """
            INSERT INTO budgets (category, month, year, amount)
            VALUES (?, ?, ?, ?)
            """,
            (
                budget.category,
                budget.month,
                budget.year,
                str(budget.amount),
            ),
        )
        self.connection.commit()
        return self.get(cursor.lastrowid)

    def get(self, budget_id: int) -> Budget:
        row = self.connection.execute(
            "SELECT * FROM budgets WHERE id = ?",
            (budget_id,),
        ).fetchone()
        if row is None:
            raise BudgetNotFoundError(f"Budget {budget_id} was not found.")
        return self._from_row(row)

    def find_for_period_category(self, category: str, month: int, year: int) -> Budget | None:
        row = self.connection.execute(
            """
            SELECT * FROM budgets
            WHERE year = ? AND month = ? AND LOWER(category) = LOWER(?)
            """,
            (year, month, category),
        ).fetchone()
        return self._from_row(row) if row is not None else None

    def update(self, budget_id: int, budget: Budget) -> Budget:
        cursor = self.connection.execute(
            """
            UPDATE budgets
            SET category = ?, month = ?, year = ?, amount = ?
            WHERE id = ?
            """,
            (
                budget.category,
                budget.month,
                budget.year,
                str(budget.amount),
                budget_id,
            ),
        )
        self.connection.commit()
        if cursor.rowcount == 0:
            raise BudgetNotFoundError(f"Budget {budget_id} was not found.")
        return self.get(budget_id)

    def list(self, filters: BudgetFilters | None = None) -> list[Budget]:
        filters = filters or BudgetFilters()
        clauses: list[str] = []
        params: list[str | int] = []

        if filters.month is not None:
            clauses.append("month = ?")
            params.append(filters.month)
        if filters.year is not None:
            clauses.append("year = ?")
            params.append(filters.year)
        if filters.category is not None:
            clauses.append("LOWER(category) = LOWER(?)")
            params.append(filters.category)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.connection.execute(
            f"SELECT * FROM budgets {where} ORDER BY year DESC, month DESC, LOWER(category)",
            params,
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def delete(self, budget_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
        self.connection.commit()
        if cursor.rowcount == 0:
            raise BudgetNotFoundError(f"Budget {budget_id} was not found.")

    @staticmethod
    def _from_row(row: sqlite3.Row) -> Budget:
        return Budget(
            id=int(row["id"]),
            category=row["category"],
            month=int(row["month"]),
            year=int(row["year"]),
            amount=Decimal(row["amount"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )
