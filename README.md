# Personal Finance Tracker

A portfolio-scale, single-user, local-first finance tracker with a Typer CLI, FastAPI, React,
SQLite, account-aware CSV workflows, deterministic reports, charts, tests, and practical
documentation.

[View the hosted showcase](https://erenterakye.github.io/personal-finance-tracker/).
GitHub Pages presents the project’s static reviewer showcase; the complete local-first application
continues to run locally with FastAPI and SQLite.

The tracker uses one unified **Activity** ledger. Every opening balance, income, expense, transfer,
and observed-balance adjustment belongs to an account and explains both cashflow and net-worth
movement. Balances are calculated from ordered activity; there is no unassigned activity or
separate snapshot system.

## Highlights

- Create asset and liability accounts with compatible subtypes: cash, investment, property,
  credit card, loan, or other.
- Record income and expenses against an account, transfer value between accounts, and update an
  account from an observed balance.
- Derive current and historical balances, net worth, account composition, warning states, and
  change attribution from the activity ledger.
- Keep transfers and adjustments visible in recent activity while excluding them from cashflow,
  budgets, and category spending.
- Use the same local SQLite ledger from the CLI, full-screen terminal workspace, FastAPI, and
  responsive React UI.
- Import and export the account-aware activity CSV format with preview, duplicate detection, and
  category aliasing.
- Back up, verify, and atomically restore the complete ledger.

## Requirements and setup

- Python 3.14+
- Node.js 24+

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm install
npm run build
```

## Build and explore the demo

```bash
.venv/bin/python examples/build_demo.py --db-path demo.sqlite3 --force
finance-tracker --db-path demo.sqlite3
finance-tracker activity list --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
```

The deterministic demo contains seven accounts, 1,116 activities, 120 monthly budgets, five
category rules, four recurring templates, realistic transfers, and a populated ten-year
net-worth history. Its inspectable sources are
[`examples/sample_activities.csv`](examples/sample_activities.csv) and
[`examples/sample_budgets.csv`](examples/sample_budgets.csv).

## Core CLI flow

```bash
# Accounts create their read-only opening activity atomically.
finance-tracker account add --name "Everyday checking" --type asset --subtype cash \
  --balance 1500 --date 2026-07-01
finance-tracker account add --name "Emergency fund" --type asset --subtype cash \
  --balance 5000 --date 2026-07-01

# Income and expenses require an account and category.
finance-tracker activity add income 2500 --account 1 --category Salary \
  --description "July salary" --date 2026-07-01
finance-tracker activity add expense 428.75 --account 1 --category Food \
  --description "Groceries" --date 2026-07-09

# Transfers have zero cashflow and net-worth impact.
finance-tracker activity transfer 500 --from-account 1 --to-account 2 \
  --description "Monthly savings" --date 2026-07-10

# An observed balance creates an explicit adjustment activity.
finance-tracker account adjust 1 3025.40 --date 2026-07-16

finance-tracker activity list --account 1
finance-tracker report monthly --month 7 --year 2026
finance-tracker report net-worth --as-of 2026-07-16
```

The bare `finance-tracker` command keeps normal terminal scrollback and presents focused actions
for Add activity, Review activity, Check budgets, Update account balance, and the full-screen
workspace. Use `--output json` for machine-readable command envelopes.

See [`docs/USAGE.md`](docs/USAGE.md) for the complete CLI, Web UI, CSV, recovery, and development
guide.

## Web UI

Run `finance-tracker web --db-path demo.sqlite3`, then open the printed local address. The primary
destinations are Overview (`/`), Activity (`/activity`), Budgets (`/budgets`), and Accounts
(`/accounts`). `/transactions` remains a query-preserving browser compatibility redirect to
`/activity`.

The Activity workspace provides kind, account, category, period, and text filters; semantic
account references; balance effects; protected opening entries; projected balances before save;
and account-aware CSV. Account rows link back into filtered activity and expose Update balance.
Forms use visible labels, semantic fieldsets, native validation, error announcements/focus, and
pending-only submission locking. Charts retain accessible data tables, reduced-motion behavior,
forced-colors support, and responsive reflow.

FastAPI exposes the canonical JSON contract under `/api`, including paginated `/api/activities`.
OpenAPI is the wire-contract source; regenerate TypeScript types with `npm run generate:api`.

## Activity CSV

```text
kind,amount,category,description,date,account,from_account,to_account
expense,42.50,Food,Lunch,2026-07-19,Everyday checking,,
transfer,500.00,,Monthly savings,2026-07-20,,Everyday checking,Emergency fund
adjustment,3012.25,,Observed bank balance,2026-07-21,Everyday checking,,
```

Account names are case-insensitively unique, so CSV references are deterministic. For adjustment
rows, `amount` is the observed balance. Opening rows cannot be imported; they are created with the
account.

```bash
finance-tracker activity import examples/sample_activities.csv --preview --db-path demo.sqlite3
finance-tracker activity export exports/activities.csv --db-path demo.sqlite3
```

## Schema compatibility

Schema v3 is an intentional clean break from the earlier transaction/snapshot schemas. The app
never silently drops or guesses old financial data. Opening a v1, v2, or populated unversioned
ledger is rejected with instructions to back it up and rebuild/import into a new v3 ledger.

## Architecture and verification

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the system-boundary and compatibility source of
  truth.
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) records completed scope and remaining roadmap.
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) contains exhaustive release checks.

Routine verification:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
.venv/bin/python -m mypy
npm test
npm run lint
npm run format:check
npm run generate:api
git diff --exit-code -- frontend/src/generated/api.ts
npm run build
npm run check:bundle
```

Use `npm run test:e2e` for browser behavior and `npm run test:e2e:fullstack` for the packaged
React–FastAPI–SQLite path.
