"""SQLite persistence for category rules."""

import sqlite3
from datetime import datetime

from finance_tracker.exceptions import CategoryRuleNotFoundError
from finance_tracker.models.category_rules import CategoryRule


class CategoryRuleRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def set(self, rule: CategoryRule) -> CategoryRule:
        existing = self.find_by_alias(rule.alias)
        if existing is None:
            return self.add(rule)
        assert existing.id is not None
        return self.update(existing.id, rule)

    def add(self, rule: CategoryRule) -> CategoryRule:
        cursor = self.connection.execute(
            """
            INSERT INTO category_rules (alias, category)
            VALUES (?, ?)
            """,
            (rule.alias, rule.category),
        )
        assert cursor.lastrowid is not None
        return self.get(cursor.lastrowid)

    def get(self, rule_id: int) -> CategoryRule:
        row = self.connection.execute(
            "SELECT * FROM category_rules WHERE id = ?",
            (rule_id,),
        ).fetchone()
        if row is None:
            raise CategoryRuleNotFoundError(f"Category rule {rule_id} was not found.")
        return self._from_row(row)

    def find_by_alias(self, alias: str) -> CategoryRule | None:
        row = self.connection.execute(
            "SELECT * FROM category_rules WHERE LOWER(alias) = LOWER(?)",
            (alias,),
        ).fetchone()
        return self._from_row(row) if row is not None else None

    def resolve_category(self, category: str) -> str:
        rule = self.find_by_alias(category)
        return rule.category if rule is not None else category

    def update(self, rule_id: int, rule: CategoryRule) -> CategoryRule:
        cursor = self.connection.execute(
            """
            UPDATE category_rules
            SET alias = ?, category = ?
            WHERE id = ?
            """,
            (rule.alias, rule.category, rule_id),
        )
        if cursor.rowcount == 0:
            raise CategoryRuleNotFoundError(f"Category rule {rule_id} was not found.")
        return self.get(rule_id)

    def list(self) -> list[CategoryRule]:
        rows = self.connection.execute(
            "SELECT * FROM category_rules ORDER BY LOWER(alias)"
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def delete(self, rule_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM category_rules WHERE id = ?", (rule_id,))
        if cursor.rowcount == 0:
            raise CategoryRuleNotFoundError(f"Category rule {rule_id} was not found.")

    @staticmethod
    def _from_row(row: sqlite3.Row) -> CategoryRule:
        return CategoryRule(
            id=int(row["id"]),
            alias=row["alias"],
            category=row["category"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
