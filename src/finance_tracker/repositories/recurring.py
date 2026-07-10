"""SQLite persistence for recurring templates."""

import sqlite3
from datetime import datetime
from decimal import Decimal

from finance_tracker.exceptions import RecurringTemplateNotFoundError
from finance_tracker.models.recurring import RecurringTemplate
from finance_tracker.models.transactions import TransactionType


class RecurringTemplateRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add(self, template: RecurringTemplate) -> RecurringTemplate:
        cursor = self.connection.execute(
            """
            INSERT INTO recurring_templates
                (type, amount, category, description, day_of_month, active)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                template.type.value,
                str(template.amount),
                template.category,
                template.description,
                template.day_of_month,
                int(template.active),
            ),
        )
        assert cursor.lastrowid is not None
        return self.get(cursor.lastrowid)

    def get(self, template_id: int) -> RecurringTemplate:
        row = self.connection.execute(
            "SELECT * FROM recurring_templates WHERE id = ?",
            (template_id,),
        ).fetchone()
        if row is None:
            raise RecurringTemplateNotFoundError(
                f"Recurring template {template_id} was not found."
            )
        return self._from_row(row)

    def list(self, active_only: bool = False) -> list[RecurringTemplate]:
        where = "WHERE active = 1" if active_only else ""
        rows = self.connection.execute(
            f"SELECT * FROM recurring_templates {where} ORDER BY active DESC, day_of_month, id"
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def delete(self, template_id: int) -> None:
        cursor = self.connection.execute(
            "DELETE FROM recurring_templates WHERE id = ?",
            (template_id,),
        )
        if cursor.rowcount == 0:
            raise RecurringTemplateNotFoundError(
                f"Recurring template {template_id} was not found."
            )

    @staticmethod
    def _from_row(row: sqlite3.Row) -> RecurringTemplate:
        return RecurringTemplate(
            id=int(row["id"]),
            type=TransactionType(row["type"]),
            amount=Decimal(row["amount"]),
            category=row["category"],
            description=row["description"],
            day_of_month=int(row["day_of_month"]),
            active=bool(row["active"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )
