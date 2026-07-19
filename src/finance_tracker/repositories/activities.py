"""SQLite persistence for activities and their account postings."""

import builtins
import sqlite3
from datetime import date, datetime
from decimal import Decimal

from finance_tracker.exceptions import ActivityNotFoundError, ValidationError
from finance_tracker.models.activities import (
    Activity,
    ActivityFilters,
    ActivityKind,
    Posting,
    PostingKind,
    PostingRole,
)
from finance_tracker.repositories.common import period_bounds


class ActivityRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def add(self, activity: Activity) -> Activity:
        _validate_posting_shape(activity)
        cursor = self.connection.execute(
            """
            INSERT INTO activities (kind, amount, category, description, effective_date)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                activity.kind.value,
                str(activity.amount),
                activity.category,
                activity.description,
                activity.date.isoformat(),
            ),
        )
        assert cursor.lastrowid is not None
        activity_id = cursor.lastrowid
        self._add_postings(activity_id, activity.postings)
        return self.get(activity_id)

    def get(self, activity_id: int) -> Activity:
        row = self.connection.execute(
            "SELECT * FROM activities WHERE id = ?", (activity_id,)
        ).fetchone()
        if row is None:
            raise ActivityNotFoundError(f"Activity {activity_id} was not found.")
        return self._from_row(row)

    def update(self, activity_id: int, activity: Activity) -> Activity:
        _validate_posting_shape(activity)
        cursor = self.connection.execute(
            """
            UPDATE activities
            SET kind = ?, amount = ?, category = ?, description = ?, effective_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                activity.kind.value,
                str(activity.amount),
                activity.category,
                activity.description,
                activity.date.isoformat(),
                activity_id,
            ),
        )
        if cursor.rowcount == 0:
            raise ActivityNotFoundError(f"Activity {activity_id} was not found.")
        self.connection.execute(
            "DELETE FROM activity_postings WHERE activity_id = ?", (activity_id,)
        )
        self._add_postings(activity_id, activity.postings)
        return self.get(activity_id)

    def delete(self, activity_id: int) -> None:
        cursor = self.connection.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
        if cursor.rowcount == 0:
            raise ActivityNotFoundError(f"Activity {activity_id} was not found.")

    def list(
        self,
        filters: ActivityFilters | None = None,
        *,
        limit: int | None = None,
        offset: int = 0,
        descending: bool = True,
    ) -> builtins.list[Activity]:
        clauses, params = _filter_sql(filters or ActivityFilters())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        # Opening wins same-day ordering independently of its generated id.
        kind_order = "CASE WHEN kind = 'opening' THEN 0 ELSE 1 END"
        if descending:
            order = f"effective_date DESC, {kind_order} DESC, id DESC"
        else:
            order = f"effective_date ASC, {kind_order} ASC, id ASC"
        pagination = ""
        if limit is not None:
            pagination = " LIMIT ? OFFSET ?"
            params.extend((limit, offset))
        rows = self.connection.execute(
            f"SELECT * FROM activities {where} ORDER BY {order}{pagination}", params
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def count_filtered(self, filters: ActivityFilters | None = None) -> int:
        clauses, params = _filter_sql(filters or ActivityFilters())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        row = self.connection.execute(f"SELECT COUNT(*) FROM activities {where}", params).fetchone()
        return int(row[0])

    def list_for_account(
        self, account_id: int, *, through: date | None = None, descending: bool = False
    ) -> builtins.list[Activity]:
        return (
            self.list(
                ActivityFilters(account_id=account_id),
                descending=descending,
            )
            if through is None
            else self._list_for_account_through(account_id, through, descending)
        )

    def _list_for_account_through(
        self, account_id: int, through: date, descending: bool
    ) -> builtins.list[Activity]:
        direction = "DESC" if descending else "ASC"
        opening_direction = "DESC" if descending else "ASC"
        rows = self.connection.execute(
            f"""
            SELECT a.* FROM activities AS a
            WHERE a.effective_date <= ?
              AND EXISTS (
                SELECT 1 FROM activity_postings AS p
                WHERE p.activity_id = a.id AND p.account_id = ?
              )
            ORDER BY a.effective_date {direction},
                     CASE WHEN a.kind = 'opening' THEN 0 ELSE 1 END {opening_direction},
                     a.id {direction}
            """,
            (through.isoformat(), account_id),
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def has_activity_after(self, account_id: int, after: date) -> bool:
        row = self.connection.execute(
            """
            SELECT 1 FROM activities AS a
            JOIN activity_postings AS p ON p.activity_id = a.id
            WHERE p.account_id = ? AND a.effective_date > ? LIMIT 1
            """,
            (account_id, after.isoformat()),
        ).fetchone()
        return row is not None

    def count_for_account(self, account_id: int) -> int:
        row = self.connection.execute(
            "SELECT COUNT(*) FROM activity_postings WHERE account_id = ?", (account_id,)
        ).fetchone()
        return int(row[0])

    def exists_matching(self, activity: Activity) -> bool:
        rows = self.connection.execute(
            """
            SELECT id FROM activities
            WHERE kind = ? AND amount = ?
              AND COALESCE(category, '') = COALESCE(?, '') COLLATE NOCASE
              AND description = ? AND effective_date = ?
            """,
            (
                activity.kind.value,
                str(activity.amount),
                activity.category,
                activity.description,
                activity.date.isoformat(),
            ),
        ).fetchall()
        expected = sorted((posting.account_id, posting.role.value) for posting in activity.postings)
        for row in rows:
            actual = sorted(
                (int(item["account_id"]), str(item["role"]))
                for item in self.connection.execute(
                    "SELECT account_id, role FROM activity_postings WHERE activity_id = ?",
                    (row["id"],),
                ).fetchall()
            )
            if actual == expected:
                return True
        return False

    def _add_postings(self, activity_id: int, postings: tuple[Posting, ...]) -> None:
        self.connection.executemany(
            """
            INSERT INTO activity_postings
                (activity_id, account_id, posting_kind, role, amount)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    activity_id,
                    posting.account_id,
                    posting.posting_kind.value,
                    posting.role.value,
                    str(posting.amount),
                )
                for posting in postings
            ],
        )

    def _from_row(self, row: sqlite3.Row) -> Activity:
        postings = tuple(
            Posting(
                id=int(item["id"]),
                activity_id=int(item["activity_id"]),
                account_id=int(item["account_id"]),
                posting_kind=PostingKind(item["posting_kind"]),
                role=PostingRole(item["role"]),
                amount=Decimal(item["amount"]),
            )
            for item in self.connection.execute(
                "SELECT * FROM activity_postings WHERE activity_id = ? ORDER BY id",
                (row["id"],),
            ).fetchall()
        )
        return Activity(
            id=int(row["id"]),
            kind=ActivityKind(row["kind"]),
            amount=Decimal(row["amount"]),
            category=str(row["category"]) if row["category"] is not None else None,
            description=str(row["description"]),
            date=date.fromisoformat(row["effective_date"]),
            postings=postings,
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )


def _filter_sql(filters: ActivityFilters) -> tuple[list[str], list[str | int]]:
    clauses: list[str] = []
    params: list[str | int] = []
    if filters.month is not None and filters.year is not None:
        start, end = period_bounds(filters.year, filters.month)
        clauses.append("effective_date >= ? AND effective_date < ?")
        params.extend((start, end))
    elif filters.month is not None:
        clauses.append("CAST(strftime('%m', effective_date) AS INTEGER) = ?")
        params.append(filters.month)
    elif filters.year is not None:
        clauses.append("effective_date >= ? AND effective_date < ?")
        params.extend((f"{filters.year:04d}-01-01", f"{filters.year + 1:04d}-01-01"))
    if filters.category is not None:
        clauses.append("category = ? COLLATE NOCASE")
        params.append(filters.category)
    if filters.kind is not None:
        clauses.append("kind = ?")
        params.append(filters.kind.value)
    if filters.account_id is not None:
        clauses.append(
            "EXISTS (SELECT 1 FROM activity_postings AS fp "
            "WHERE fp.activity_id = activities.id AND fp.account_id = ?)"
        )
        params.append(filters.account_id)
    if filters.search:
        clauses.append(
            "(description LIKE ? ESCAPE '\\' OR COALESCE(category, '') LIKE ? ESCAPE '\\')"
        )
        escaped = filters.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params.extend((f"%{escaped}%", f"%{escaped}%"))
    return clauses, params


def _validate_posting_shape(activity: Activity) -> None:
    """Reject malformed aggregate writes before either ledger table is changed."""
    shape = tuple(
        (posting.posting_kind, posting.role) for posting in activity.postings
    )
    expected: tuple[tuple[PostingKind, PostingRole], ...]
    if activity.kind in {ActivityKind.OPENING, ActivityKind.ADJUSTMENT}:
        expected = ((PostingKind.SET_BALANCE, PostingRole.ACCOUNT),)
    elif activity.kind in {ActivityKind.INCOME, ActivityKind.EXPENSE}:
        expected = ((PostingKind.DELTA, PostingRole.ACCOUNT),)
    else:
        expected = ()
    valid_shape = (
        len(shape) == 2
        and set(shape)
        == {
            (PostingKind.DELTA, PostingRole.SOURCE),
            (PostingKind.DELTA, PostingRole.DESTINATION),
        }
        if activity.kind is ActivityKind.TRANSFER
        else shape == expected
    )
    if not valid_shape:
        raise ValidationError(
            f"{activity.kind.value.title()} activity has an invalid posting shape."
        )
    if len({posting.account_id for posting in activity.postings}) != len(
        activity.postings
    ):
        raise ValidationError("An activity cannot post to the same account twice.")
