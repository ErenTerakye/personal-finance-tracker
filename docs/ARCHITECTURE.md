# Architecture

This document is the architecture and compatibility source of truth.

## Product boundary

Personal Finance Tracker is a single-user, local-first application. Typer, Textual, FastAPI, and
React are inbound adapters over the same SQLite ledger. There is no authentication, cloud sync,
bank sync, background service, service worker, DI container, or server-state framework.

The ledger has one configured currency. Money is `Decimal` in Python and decimal text in SQLite
and JSON. Dates are ISO text. Browser display arithmetic uses integer cents.

## Dependency direction

```text
CLI / TUI / FastAPI / React
            |
        services
       /    |    \
 models  reports  CSV
            |
       repositories
            |
       database.py
```

- `models/` owns financial validation, account/activity values, posting rules, and immutable domain
  shapes.
- `services/` owns use-case orchestration and transaction boundaries.
- `database.py` owns connection behavior, schema creation, compatibility rejection, and schema
  verification.
- `repositories/` owns SQL and row mapping. Repositories never commit or roll back.
- `csv_io/` owns portable activity and budget formats.
- `reports/` owns deterministic calculations; `charts/` is the only matplotlib boundary.
- `cli/`, `tui/`, and `web/` translate input/output and call public services; they do not own
  financial rules or SQL.
- React routes compose in `app/`, workflows live in `features/`, browser transport lives in `api/`,
  and reusable behavior lives in `shared/`. Only `frontend/src/api/client.ts` calls `fetch`.

## Schema v3 activity ledger

Schema v3 is an intentional clean break. Fresh ledgers contain:

- `accounts`: unique case-insensitive name, immutable asset/liability type, compatible subtype,
  archive date.
- `activities`: `opening`, `income`, `expense`, `transfer`, or `adjustment`, with semantic amount,
  category/description, effective date, and stable ID.
- `activity_postings`: one or two account postings owned by an activity.
- `budgets`, `category_rules`, `recurring_templates`, and `settings`.

There are no `transactions` or balance-snapshot tables. A ledger declaring v1/v2, or a populated
unversioned ledger, is rejected without mutation and with backup/rebuild guidance. Recovery accepts
only complete schema-v3 ledgers.

### Posting shapes

| Activity | Posting shape | Cashflow/budget | Net worth |
| --- | --- | --- | --- |
| Opening | one `set_balance` account posting | excluded | establishes account balance |
| Income | one `delta` account posting | income | increases |
| Expense | one `delta` account posting | expense | decreases |
| Transfer | source and destination `delta` postings | excluded | zero |
| Adjustment | one `set_balance` account posting | excluded | observed minus prior balance |

Asset balance signs and liability balance signs are deliberately different from economic impact.
For assets, income adds and expense subtracts. For liabilities, income/refunds subtract and expense
adds. Transfers divide by each account's net-worth sign so every asset/liability pair moves equal
economic value and reconciles to zero.

### Deterministic ordering

Balance calculation sorts by effective date, opening-first precedence, then stable activity ID.
`set_balance` postings replace the calculated balance at that point; delta postings change it.
Consequently, a later observed-balance adjustment remains authoritative when earlier activity is
edited, backdated, or deleted. The same ordering is used for account history, activity effects,
net-worth history, and projections.

Negative calculated balances are valid. Presentation maps a negative asset to `overdrawn` and a
negative liability to `credit_balance`; arithmetic is unchanged.

## Use-case invariants

- Account creation inserts the account and read-only opening activity atomically.
- Account names are case-insensitively unique, supporting deterministic CLI and CSV references.
- Account type never changes. Subtype updates remain compatible with the type.
- New financial activity always has account postings; there is no unassigned state.
- Income/expense require an active account and category. They may be reclassified between each
  other.
- Transfer requires two distinct active accounts. Transfer kind is immutable.
- Adjustment records an observed balance for one active account. Adjustment kind is immutable.
- Opening cannot be edited, deleted, imported, or recur.
- Archive requires a calculated zero balance on the closing date and no later activity.
- Delete requires exactly the opening activity and removes account/opening in one transaction.
- Recurring templates support income, expense, and transfer only and perform account-aware
  duplicate detection.

Every service mutation owns one database transaction. Account creation, multi-posting activity,
recurring application, backup, and restore are rollback-safe. SQLite foreign keys are enabled for
every configured connection.

## Reports and attribution

Monthly totals, trends, savings rate, budget actuals, and category analytics filter to income and
expense activity. Transfers and adjustments can appear in recent activity but never become
spending.

Net worth is calculated only from account activity:

```text
total assets      = sum(calculated asset balances)
total liabilities = sum(calculated liability balances)
net worth         = total assets - total liabilities
```

Overview attribution splits net-worth change into cashflow, adjustments/valuation changes, and
transfers. Transfer attribution must be `0.00`. Account-state warnings replace the retired
snapshot-coverage concept.

## Public contracts

FastAPI OpenAPI is the wire-contract source. Activity create/update bodies are a discriminated
union:

- income/expense: `kind, amount, category, description, date, account_id`
- transfer: `kind, amount, description, date, from_account_id, to_account_id`
- adjustment: `kind, amount, description, date, account_id`

Canonical endpoints are paginated `GET /api/activities`, `POST /api/activities`, and
`PUT|DELETE /api/activities/{id}`, plus activity CSV preview/import/export. Responses expose
semantic account/source/destination references and calculated effects, never persistence postings.
Unknown `/api/*` paths return JSON 404 responses rather than the SPA shell.

The canonical browser route is `/activity`. `/transactions` is retained only as a query-preserving
client compatibility redirect. Primary navigation is Overview, Activity, Budgets, and Accounts;
Manage contains lower-frequency workflows.

The canonical CLI groups are `activity add|transfer|list|edit|delete|import|export` and
`account adjust`. No transaction or balance-snapshot command group is registered.

## CSV contract

Activity CSV has the exact header:

```text
kind,amount,category,description,date,account,from_account,to_account
```

`account` is required for income, expense, and adjustment; `from_account` and `to_account` are
required for transfer. Adjustment amount is the observed balance. Names resolve case-insensitively.
Preview validates per-kind fields, aliases categories, detects account-aware duplicates, and
calculates projected effects.

## Frontend behavior

Baseline 2026-capable browsers receive progressive enhancement. Core navigation, forms, dialogs,
CRUD, and CSV remain usable without optional motion/new presentation features.

Accessibility requirements include semantic structure, visible form labels, fieldsets, native
validation, focus and keyboard behavior, error announcements/focus, route focus, chart data tables,
reduced-motion handling, forced-colors support, and zoom/reflow. Submission is disabled only while
a valid request is pending.

Server responses and resource keys are cached locally by the existing lightweight hooks. Activity
writes invalidate activity, account, dashboard, and budget consumers as applicable.

## Generated and demo artifacts

- `frontend/src/generated/api.ts` is generated from FastAPI OpenAPI; never edit it manually.
- `src/finance_tracker/web/static/spa/` is the packaged Vite build.
- `examples/build_demo.py` creates accounts first, imports account-aware activity, adds transfers,
  applies recurring templates, records dated observed balances as adjustments, and archives one
  zero-balance account.
- `demo.sqlite3`, screenshots, chart images, and release evidence are generated artifacts and may
  be ignored by Git.

Applicable behavior changes require focused tests and the verification suite in root `AGENTS.md`.
