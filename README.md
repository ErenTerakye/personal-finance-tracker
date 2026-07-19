# Personal Finance Tracker

[![CI](https://github.com/ErenTerakye/personal-finance-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/ErenTerakye/personal-finance-tracker/actions/workflows/ci.yml)
![Python 3.14](https://img.shields.io/badge/python-3.14-blue)
![Node 24](https://img.shields.io/badge/node-24-43853d)

A local-first finance tracker with an inline interactive CLI, optional Textual workspace, grouped
Typer commands, FastAPI JSON API, React browser UI, SQLite persistence, CSV workflows, and data
visualization.

## Highlights

- Use a scrollback-friendly terminal home for everyday actions, or open a keyboard-first workspace
  with Overview, Transactions, Budgets, Accounts, and Manage destinations.
- Automate every terminal workflow through grouped commands, global database selection,
  machine-readable JSON envelopes, predictable exit codes, and safe confirmations.
- Add, edit, list, delete, import, and export financial transactions.
- Set monthly category budgets and compare them to actual expenses.
- Normalize category aliases so imports and manual entries roll into clean categories.
- Create monthly recurring transaction templates and apply them explicitly when needed.
- Import and export transactions and budgets with CSV files.
- Back up, verify, and restore the complete SQLite ledger, including account history and settings.
- Store records locally in SQLite.
- Track asset and liability accounts with dated manual balance snapshots and deterministic total
  net worth history.
- Generate monthly and multi-month income, expense, net savings, category, YTD, and month-over-month reports.
- Save optional PNG charts for monthly reports and trend reports.
- Run a polished local FastAPI JSON API and React “ledger editorial” workspace with Overview,
  Transactions, Budgets, Accounts, and focused Manage workflows.
- Move between warmed workspaces without first-open flicker while preserving visited filters and
  respecting reduced-motion preferences.
- Preview transaction CSV imports before writing, skip duplicates by default, import/export budget CSV files, and download report/chart artifacts from Overview.
- Configure one local ledger currency and use locale-aware English/Turkish browser formatting.
- Verify responsive and accessibility behavior with Playwright coverage.
- Use a clean `src/` package layout with Typer, pytest, and Ruff.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm install
npm run build
```

## Quick Start

```bash
.venv/bin/python examples/build_demo.py --force
mkdir -p reports exports
finance-tracker --db-path demo.sqlite3
finance-tracker transaction list --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker overview --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker report monthly --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker report trends --months 12 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker report net-worth-history --months 120 --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
```

The bare `finance-tracker` command shows an inline ledger snapshot and focused action menu, then
returns to the shell. Use `finance-tracker tui` for the full-screen terminal workspace, or
`finance-tracker web` for the browser workspace at `http://127.0.0.1:8000`. The detailed fictional
demo has 120 months of net-worth history from August 2016 through July 2026, plus 281 merchant-level
transactions across 16–20 active days per month in its detailed trailing year. It includes
realistic same-day activity, budgets, category aliases, recurring entries, asset/liability
histories, an archived account, and meaningful report states. `demo.sqlite3` is generated local
state, intentionally ignored by git, and can be rebuilt at any time.

The default database path is `./data/finance_tracker.sqlite3`. That file is local runtime state for your own machine and may not match the documented demo. For the reviewer demo, start the local Web UI against the generated demo database:

```bash
finance-tracker web --db-path demo.sqlite3
```

## Demo Flow

Run a fresh local demo without touching the default database:

```bash
.venv/bin/python examples/build_demo.py --force
mkdir -p reports exports
finance-tracker budget status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker category list --db-path demo.sqlite3
finance-tracker recurring list --db-path demo.sqlite3
finance-tracker account list --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker report net-worth-history --months 120 --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker transaction import examples/sample_transactions.csv --preview --db-path demo.sqlite3
finance-tracker report monthly --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker report trends --months 12 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
finance-tracker transaction export exports/transactions.csv --db-path demo.sqlite3
finance-tracker budget export exports/budgets.csv --db-path demo.sqlite3
```

See [examples/README.md](examples/README.md) for the scenario inventory and suggested review
points.

## Reviewer Screenshots

Reviewer screenshots are refreshed from the detailed July 2026 demo using
`finance-tracker web --db-path demo.sqlite3` after running the example builder.

![Overview desktop screenshot](docs/assets/screenshots/dashboard-desktop.png)

![Transactions mobile screenshot](docs/assets/screenshots/transactions-mobile.png)

![Budgets desktop screenshot](docs/assets/screenshots/budgets-desktop.png)

## Inline Home, Terminal Workspace, and Grouped Commands

Run `finance-tracker` to see the current month's cash flow, net worth, budget attention, and recent
activity without leaving the normal terminal scrollback. In an interactive terminal, choose a
one-shot action to add a transaction, review the month, inspect budgets, check in balances, or open
the full-screen workspace. Navigate with the arrow keys and Enter, select directly with `1`–`5`, or
quit with `Q`. Non-interactive use prints the snapshot and command hints without prompting;
`--output json` returns the same overview contract as the explicit `overview` command.

Run `finance-tracker tui` when you want the persistent full-screen workspace. Use `1`–`5` for
destinations, `Ctrl+P` for the fuzzy command palette, `/` for search, `A` for the global transaction
form, `R` to refresh, and `?` for the complete keyboard guide. The layout works from 80×24 upward
and exposes the same actions through buttons and optional mouse input.

For scripts, select the database globally and request a stable JSON envelope:

```bash
finance-tracker --db-path demo.sqlite3 --output json overview --month 7 --year 2026
finance-tracker --db-path demo.sqlite3 --output json transaction list --type expense
finance-tracker --db-path demo.sqlite3 --yes data restore backups/demo.sqlite3
```

The v2 command surface intentionally replaces the former flat names with capability groups. Calling
a removed v1 name prints its exact replacement and exits without running it.

## Web UI

The local Web UI is an intentional portfolio-scale scope expansion: a Personal Finance Tracker for trend-first monthly review, transaction entry, and budget pressure checks. It remains local-first: the Python server reads and writes your SQLite database on your machine.

The 2026 interface uses one stable four-destination model—Overview, Transactions, Budgets, and
Accounts—across its persistent desktop rail and compact bottom navigation. A visible Manage entry
houses Automations, Categories, Data, and Preferences, while Add transaction remains the same
global action on every route. Shared route headers, contextual controls, native dialogs,
progressive data menus, and English/Turkish labels keep the application predictable without
flattening each destination into the same layout. The current design goal is documented in
[docs/WEB_UI_COHESION_AND_FLOW_GOAL.md](docs/WEB_UI_COHESION_AND_FLOW_GOAL.md).

Architecture: FastAPI exposes JSON endpoints under `/api`, and a React + Vite + TypeScript SPA is served from the same local server after `npm run build`. Money values are sent as decimal strings and browser-side display arithmetic uses integer cents. Individual amounts and balances are supported through `90071992547409.91` without losing a cent.

The browser application includes:

- A unified Overview at `/` with cashflow orientation, a concise net-worth summary, budget
  attention, recent transactions, and context-preserving links into detailed work.
- A searchable Transactions ledger at `/transactions` with add/edit/delete workflows, visible
  filter context, and progressively disclosed CSV data actions.
- A responsive Budgets workspace at `/budgets` with monthly health, planned/spent/uncovered
  metrics, category search and sorting, pressure-ranked guardrails, and a focused inspector.
- An Accounts workspace at `/accounts` with current and historical net worth, account movement,
  composition, balance coverage, atomic balance check-ins, account management, and an accessible
  chart data table.
- A secondary Manage area at `/manage/automations`, `/manage/categories`, `/manage/data`, and
  `/manage/preferences` for recurring work, category aliases, import/export, currency, language,
  and theme.
- Compatibility redirects from `/cash-flow` to `/`, `/net-worth` to `/accounts`, and `/rules` to
  `/manage/automations`, preserving relevant query context.
- Compact period controls for month-to-month review without always exposing month/year fields.
- Task-focused transaction and budget dialogs with prominent amount entry, grouped details, responsive controls, context-aware zero-data states, recoverable page-load errors, and edit/delete flows.
- Browser transaction CSV preview with duplicate detection and category alias display before import, plus CSV export for transactions and budgets.
- Overview downloads for monthly text reports, monthly PNG charts, six-month trend text reports,
  and six-month trend PNG charts.
- Read-only transaction tables that collapse into mobile-friendly record lists with compact row actions.
- A theme action that follows your system color setting until you explicitly pin Light or Dark,
  with synchronized controls in the desktop rail, compact-header preferences panel, and Manage →
  Preferences.
- Calm, progressive Overview motion: instant top-level route handoffs, directional period context,
  responsive rolling values, two-way export and chart-tooltip lifecycles, immediate pending/pressed
  feedback, and spatial-motion-free reduced-motion states.
- English/Turkish language controls with local browser preference persistence, stable compact-header
  geometry across translations, and locale-aware money/date formatting using the active ledger
  currency.

For frontend development against a freshly rebuilt detailed demo, run:

```bash
npm run dev:demo
```

This rebuilds `demo.sqlite3`, starts the reload-enabled Python API, starts Vite, and cleans up the
API process when Vite exits. It stops with a clear message instead of replacing the database when
port 8000 or 5173 is already occupied.

To preserve changes made to the current demo database, run the Python app and Vite separately:

```bash
finance-tracker web --db-path demo.sqlite3
npm run dev
```

Open `http://127.0.0.1:5173`; Vite proxies `/api` to the Python process on port 8000. Activate `.venv` before generating API types so the script can import FastAPI and the application package.

The browser interface uses modern platform features progressively, including semantic landmarks, accessible forms, native dialogs and popovers, SVG charts, container queries, color-scheme-aware dark mode with a persistent local override, mobile-safe viewport units, same-document view transitions, and reduced-motion-aware animation. Dashboard and budget period changes keep the current data usable while loading, then reveal the latest period as one coordinated surface while key financial digits roll up or down to their new values. The support policy is Baseline 2026-capable browsers; newer features must degrade without large polyfills.

GitHub Pages can host static files only, so it cannot run the live Python/SQLite app. A static showcase is available in [docs/showcase/index.html](docs/showcase/index.html) for portfolio hosting, while real CRUD requires `finance-tracker web`.

Sites deployment uses `npm run build:sites` to package the React UI with a small hosted-demo Worker
adapter seeded from the same inspectable transaction and budget CSV files as the local demo. The
published demo is interactive for review, but its changes are session-only; durable CRUD remains
available through the local FastAPI + SQLite app.

## Common Commands

```bash
finance-tracker transaction add income 2500 --category Salary --description "July salary" --date 2026-07-01
finance-tracker transaction add expense 428.75 --category Food --description "Groceries and summer market" --date 2026-07-09
finance-tracker transaction edit 2 --amount 52.25 --category Household
finance-tracker category set groceries Food
finance-tracker recurring add expense 1600 --category Rent --description "Monthly rent" --day 1
finance-tracker recurring apply --month 7 --year 2026
finance-tracker budget set Food 480 --month 7 --year 2026
finance-tracker budget status --month 7 --year 2026
finance-tracker report net-worth --as-of 2026-07-16
finance-tracker report net-worth-history --months 12 --as-of 2026-07-16
finance-tracker report trends --months 6 --end-month 7 --end-year 2026
finance-tracker transaction list --month 7 --year 2026
finance-tracker transaction export exports/transactions.csv
finance-tracker budget export exports/budgets.csv
finance-tracker transaction delete 1
```

Override the default database path with `--db-path` or the `FINANCE_TRACKER_DB` environment variable.

## CSV Formats

Transaction import and export use:

```csv
type,amount,category,description,date
income,4200.00,Salary,July salary,2026-07-01
expense,428.75,Food,Groceries and summer market,2026-07-09
```

Budget import and export use:

```csv
category,amount,month,year
Food,480.00,7,2026
Rent,1600.00,7,2026
```

## Project Structure

```text
examples/                 # Synthetic CSV sources and deterministic demo builder
src/finance_tracker/
  models/            # Framework-free domain objects and validation
  repositories/      # SQL queries and row mapping without commits
  services/          # Transactional use-case coordination
  csv_io/            # Transaction and budget CSV adapters
  reports/           # Monthly/trend calculations and text formatting
  charts/            # PNG chart rendering with isolated matplotlib use
  cli/               # Typer composition and capability command groups
  tui/               # Textual workspace, views, forms, and terminal styling
  web/               # FastAPI composition, schemas, routers, and SPA host
  database.py        # SQLite setup and ordered migrations
```

```text
frontend/src/
  app/               # React composition and routes
  api/               # Browser transport, artifacts, and API errors
  features/          # Overview, transactions, budgets, accounts, and Manage workflows
  shared/            # Reusable UI, hooks, format, i18n, charts, theme, and styles
  generated/         # OpenAPI-generated TypeScript contract
```

## Development

After activating the virtual environment, run:

```bash
.venv/bin/python -m pytest --cov=finance_tracker --cov-fail-under=90
.venv/bin/python -m ruff check .
.venv/bin/python -m mypy
npm run test:coverage
npm run lint
npm run format:check
npm run check:generated
npm run check:css
npm run test:e2e
npm run test:e2e:fullstack
.venv/bin/python -m pip_audit
.venv/bin/python -m build
```

For the first Playwright run on a new machine, install the configured browsers with `npx playwright install --with-deps chromium firefox webkit`.

GitHub Actions runs the Python checks on Python 3.14 and the frontend checks on Node 24.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/ARCHITECTURE_CLEANUP_EVIDENCE.md](docs/ARCHITECTURE_CLEANUP_EVIDENCE.md),
[ROADMAP.md](ROADMAP.md), [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md),
[docs/USAGE.md](docs/USAGE.md), and [AGENTS.md](AGENTS.md) for deeper project notes.

Use [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) when refreshing the demo, screenshots, packaged SPA assets, and release checks.
