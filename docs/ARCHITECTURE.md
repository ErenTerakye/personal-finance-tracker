# Architecture

## Scope and trust model

Personal Finance Tracker is a single-user, local-first application. The CLI and browser UI share one SQLite ledger on the user's machine. The web server binds to `127.0.0.1` by default and has no authentication, remote account, telemetry, cloud sync, background worker, or service worker. Binding it to a non-loopback interface exposes an unauthenticated financial ledger and is intentionally discouraged.

## Data flow

```text
Typer CLI ───────┐
                 ├─> services ─> repositories ─> SQLite
FastAPI routers ─┘       │
       ▲                 ├─> CSV import/export
       │                 └─> reports ─> matplotlib charts
React SPA ── JSON/CSV/report requests
```

- `cli.py` and the FastAPI layer translate input/output; they do not own domain rules or SQL.
- `models.py` validates domain values. Money remains `Decimal` in Python, decimal text in JSON, and text in SQLite.
- `services.py` defines use cases and transaction boundaries.
- `repositories.py` owns SQL and row mapping but never commits independently.
- `csv_io.py`, `reports.py`, and `charts.py` isolate their respective formats and calculations.
- FastAPI's OpenAPI schema generates the checked-in TypeScript wire types in `frontend/src/generated/api.ts`.

## Web delivery

During development Vite proxies `/api` to FastAPI at `127.0.0.1:8000`. Production builds are written into the Python package and FastAPI serves the SPA with an `index.html` fallback. Unknown client routes are handled by the React not-found view. Financial API responses use `Cache-Control: no-store`; the server also supplies CSP, `nosniff`, referrer, permissions, and frame-ancestor protections.

## Database and migrations

SQLite schema changes are ordered in `database.py` and tracked with `PRAGMA user_version`. An existing unversioned v1 database is stamped and upgraded in place without discarding records. Every migration runs transactionally. Connections enable foreign keys, WAL, a busy timeout, and `synchronous=NORMAL`, and use explicit Python 3.14 transaction behavior.

Repositories do not commit. A service use case owns one connection and commits or rolls back the complete unit of work, so multi-write operations can be atomic. Date queries use ISO ranges and indexed filter expressions.

## Compatibility policy

The API keeps English `notice` alongside stable `notice_code` during the 1.1 compatibility release. Errors use `{ "error": { "code", "message", "fields?" } }`; the frontend can still read the legacy error shapes while older clients migrate. List endpoints retain their entity arrays and add `page: { limit, offset, total }`.
