"""SQLite persistence for budgets."""

import sqlite3
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import BudgetNotFoundError
from finance_tracker.models.budgets import Budget, BudgetFilters


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
        assert existing.id is not None
        return self.update(existing.id, budget)

    def add(self, budget: Budget) -> Budget:
        cursor = self.connection.execute(
            """
            INSERT INTO budgets (category, month, year, amount)
            VALUES (?, ?, ?, ?)
            """,
            (budget.category, budget.month, budget.year, str(budget.amount)),
        )
        assert cursor.lastrowid is not None
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
            (budget.category, budget.month, budget.year, str(budget.amount), budget_id),
        )
        if cursor.rowcount == 0:
            raise BudgetNotFoundError(f"Budget {budget_id} was not found.")
        return self.get(budget_id)

    def list(
        self,
        filters: BudgetFilters | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[Budget]:
        clauses, params = _budget_filter_sql(filters or BudgetFilters())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        pagination = ""
        if limit is not None:
            pagination = " LIMIT ? OFFSET ?"
            params.extend((limit, offset))
        rows = self.connection.execute(
            f"SELECT * FROM budgets {where} "
            f"ORDER BY year DESC, month DESC, LOWER(category){pagination}",
            params,
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def count_filtered(self, filters: BudgetFilters | None = None) -> int:
        clauses, params = _budget_filter_sql(filters or BudgetFilters())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        row = self.connection.execute(
            f"SELECT COUNT(*) AS count FROM budgets {where}", params
        ).fetchone()
        return int(row["count"])

    def delete(self, budget_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
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


def _budget_filter_sql(filters: BudgetFilters) -> tuple[list[str], list[str | int]]:
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
    return clauses, params
