"""Export account histories for the hosted, session-only Sites demo."""

from __future__ import annotations

import json

from examples.build_demo import ACCOUNT_HISTORIES, ARCHIVED_ACCOUNT


def _account(
    account_id: int,
    name: str,
    account_type: str,
    history: tuple[tuple[str, str], ...],
    archived_on: str | None = None,
) -> dict[str, object]:
    snapshots = list(history)
    if archived_on is not None:
        snapshots.append((archived_on, "0.00"))
    return {
        "id": account_id,
        "name": name,
        "type": account_type,
        "archived_on": archived_on,
        "created_at": f"{history[0][0]}T09:00:00",
        "snapshots": [
            {
                "id": account_id * 1000 + index,
                "account_id": account_id,
                "amount": amount,
                "effective_date": effective_date,
                "created_at": f"{effective_date}T09:00:00",
                "updated_at": f"{effective_date}T09:00:00",
            }
            for index, (effective_date, amount) in enumerate(snapshots, start=1)
        ],
    }


def main() -> None:
    accounts = [
        _account(index, name, account_type, history)
        for index, (name, account_type, history) in enumerate(
            ACCOUNT_HISTORIES,
            start=1,
        )
    ]
    archived_name, archived_type, archived_history, archived_on = ARCHIVED_ACCOUNT
    accounts.append(
        _account(
            len(accounts) + 1,
            archived_name,
            archived_type,
            archived_history,
            archived_on,
        )
    )
    print(json.dumps({"accounts": accounts}, separators=(",", ":")))


if __name__ == "__main__":
    main()
