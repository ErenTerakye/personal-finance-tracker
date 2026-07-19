# Project Plan

## Purpose

Personal Finance Tracker is a portfolio-ready Python application for recording income and expenses, storing records in SQLite, moving data through CSV files, producing monthly financial reports, and presenting the same local data in a browser-based dashboard.

The project is intentionally local-first and easy to run. It demonstrates Python packaging, CLI design, object-oriented domain modeling, persistence, CSV processing, testing, data visualization, a FastAPI JSON API, and a React + Vite Web UI.

## Architecture

The application uses a layered structure:

- `cli/` owns grouped Typer composition, automation output, migration diagnostics, and exits.
- `tui/` owns the Textual application shell, responsive terminal views, forms, and interaction.
- `models/` owns domain objects and validation helpers by capability.
- `services/` coordinates transactional use cases, deterministic connection closure, and complete-ledger recovery while keeping entrypoints away from persistence details.
- `repositories/` owns SQL queries and row mapping without committing transactions.
- `database.py` owns SQLite connection setup and ordered `PRAGMA user_version` migrations.
- `csv_io/` owns portable transaction and budget CSV import/export behavior.
- `reports/` owns monthly and trend report calculations and text formatting.
- `charts/` owns optional PNG chart generation with matplotlib.
- `web/` owns FastAPI composition, schemas, routers, middleware, errors, responses, and static SPA
  hosting.
- `frontend/src/app/` composes browser routes, `features/` owns workflows, `api/` owns transport, and
  `shared/` owns reusable UI, hooks, formatting, i18n, charts, theme, and layered CSS.

SQL should stay in repository/database modules. Business validation should stay in models/services. CLI commands should stay thin and user-facing. Web routes should call the same service and report layers rather than duplicating business rules.

## Data Model

The first version stores transactions with:

- `id`: SQLite autoincrement primary key
- `type`: `income` or `expense`
- `amount`: positive decimal value stored as text for predictable decimal round-tripping
- `category`: required text label
- `description`: optional text note
- `date`: ISO date string, `YYYY-MM-DD`
- `created_at`: SQLite timestamp

The SQLite schema enforces valid transaction types with a `CHECK` constraint.

Asset and liability accounts are stored separately from transactions. Each account has one or more
dated, non-negative balance snapshots; the latest snapshot on or before an as-of date determines
its value. Liability balances are positive amounts owed and are subtracted exactly once in the
deterministic net worth report layer. Archiving records a final zero snapshot without deleting
history.

Monthly category budgets are stored separately with:

- `id`: SQLite autoincrement primary key
- `category`: required text label matched case-insensitively for status calculations
- `month`: integer month, `1-12`
- `year`: positive integer year
- `amount`: positive decimal value stored as text
- `created_at`: SQLite timestamp

Each category can have one budget per month and year. Setting the same category/month/year again updates the existing budget.

Category alias rules are stored with:

- `id`: SQLite autoincrement primary key
- `alias`: required category spelling to normalize
- `category`: required canonical category name
- `created_at`: SQLite timestamp

Aliases are unique case-insensitively. Transaction and budget writes resolve the
alias before storing records.

Recurring transaction templates are stored with:

- `id`: SQLite autoincrement primary key
- `type`: `income` or `expense`
- `amount`: positive decimal value stored as text
- `category`: required text label, resolved through category rules when saved
- `description`: optional text note
- `day_of_month`: integer day, `1-31`
- `active`: integer boolean flag
- `created_at`: SQLite timestamp

Templates are manually applied for a selected month and year. Applying templates
creates real transactions and skips duplicates.

## CLI Commands

Primary command:

```bash
finance-tracker
```

Supported commands:

- Bare `finance-tracker` prints an inline ledger home and offers focused one-shot actions in a TTY.
- `tui` explicitly opens the persistent full-screen terminal workspace.
- `overview` prints monthly cash flow, budget attention, recent activity, and net worth.
- `transaction add|list|edit|delete|import|export` owns ledger entries and CSV movement.
- `budget set|list|status|delete|import|export` owns monthly category plans.
- `account add|list|edit|archive|delete` and `account balance set|list|delete|check-in`
  own accounts, dated snapshots, and atomic multi-account updates.
- `recurring add|list|apply|delete` and `category set|list|delete` own Manage workflows.
- `report monthly|trends|net-worth|net-worth-history` owns deterministic reporting and charts.
- `data init|backup|verify|restore`, `settings get|set`, and `web` own local operations.

Global `--db-path`, `--output table|json`, `--no-color`, and `--yes` options apply across groups.
The v2 surface is intentionally breaking; old names are rejected with migration guidance.

Database path defaults to `./data/finance_tracker.sqlite3`, which is local runtime state and ignored
by git. Users can override it with `--db-path` or `FINANCE_TRACKER_DB`; reproducible demos should
use `examples/build_demo.py` to combine the inspectable CSV sources with rules, recurring
templates, settings, and account histories in a separate `demo.sqlite3`.

## Web UI

The shipped information architecture is Overview, Transactions, Budgets, and Accounts, backed by
a semantic ledger-editorial design system, four-item compact bottom navigation, a persistent wide
rail, a visible secondary Manage area, progressive disclosures, self-hosted typography, and
accessibility/responsive verification.

The Web UI is an intentional scope expansion from the original CLI-first milestone while preserving the local-first architecture. It runs with:

```bash
finance-tracker web --host 127.0.0.1 --port 8000
```

Non-loopback hosts require the explicit `--allow-remote-unauthenticated` trust-boundary override.

The Python app exposes JSON endpoints under `/api` and serves the compiled React SPA for browser routes. During development, Vite proxies `/api` to the FastAPI process at `127.0.0.1:8000`. OpenAPI generates checked-in TypeScript wire types; list responses are paginated while CSV exports remain complete.

Supported browser workflows:

- Unified Overview at `/` with cashflow orientation, a concise net-worth summary, recent
  transactions, budget pressure, and context-preserving links into detailed work.
- Route-aware SPA navigation for `/`, `/transactions`, `/budgets`, and `/accounts`, with Manage at
  `/manage/automations`, `/manage/categories`, `/manage/data`, and `/manage/preferences`.
- Compatibility redirects from `/cash-flow`, `/net-worth`, and `/rules` to their canonical
  destinations while retaining relevant query context.
- An Accounts workspace with as-of position, integrated history, account movement and
  composition analytics, coverage facts, atomic balance check-ins, account/snapshot workflows, and
  an accessible chart/table.
- Transaction add, edit, delete, and filtering through native dialog workflows.
- Budget set/update, delete, filtering, and budget status comparison with pressure as the primary view.
- Browser CSV import/export for transactions and budgets, reusing the same CSV validation and formatting rules as the CLI.
- Browser transaction CSV preview before import, showing valid rows, invalid rows, duplicate rows, and category alias changes.
- Focused Manage sections for recurring templates, category aliases, local data operations,
  currency, language, and theme preferences.
- Overview downloads for monthly and trend text reports plus PNG charts generated through the
  Python report/chart layers.

Browser support policy: target Baseline 2026-capable browsers. Newly available platform features, such as native dialogs and popovers, SVG chart affordances, container queries, color-scheme-aware dark mode, same-document view transitions, and reduced-motion-aware animation, are allowed when they are progressive enhancements and the core local CRUD workflows remain usable without large polyfills.

The live Web UI is not designed for GitHub Pages because Pages only serves static files. The repository can include a static showcase page for portfolio presentation, but live CRUD requires running the local Python server.

## CSV Format

Transaction CSV files use this header:

```csv
type,amount,category,description,date
```

Budget CSV files use this header:

```csv
category,amount,month,year
```

Invalid data rows are skipped during import and reported to the user. Missing required columns stop the import. Transaction imports skip duplicates by default using the same type, amount, canonical category, trimmed description, and date; users can preview rows first and can opt into duplicate imports when intentional.

## Suggested Commit Order

1. Add project metadata and source/test directories.
2. Add documentation and agent guidance.
3. Add SQLite schema and repository layer.
4. Add transaction models and service layer.
5. Add Typer CLI commands.
6. Add CSV import/export.
7. Add monthly reports and chart output.
8. Add tests and README polish.

## Current Development Direction

The project is in portfolio-release maintenance mode. The architecture cleanup defined in
`ARCHITECTURE_CLEANUP_SPEC.md` reorganized the modular monolith by capability without changing the
core local-first CLI, SQLite, reporting, charting, FastAPI, or React workflows. Future changes should
preserve the enforced dependency direction and focus on small correctness, documentation,
accessibility, packaging, and demo-quality improvements.

The CLI and local FastAPI/React Web UI should remain aligned, the reviewer demo should stay easy to reproduce, and the project should remain portfolio-scale: no authentication, cloud sync, background workers, or hosted database unless the project scope changes again.

Use [../ROADMAP.md](../ROADMAP.md) as the source of truth for upcoming milestones and future-work ordering.

## Testing Strategy

Use pytest with temporary SQLite databases. Cover:

- Schema creation.
- Transaction validation and persistence.
- Filtering by month, year, category, and type.
- CSV import/export round trips.
- Budget CSV import/export round trips.
- Monthly budget create/update/delete flows.
- Budget status calculations by category.
- Monthly and trend report calculations.
- Category alias canonicalization.
- Recurring template creation and manual application.
- Transaction CSV preview and duplicate safeguards.
- Chart output for monthly and trend reports.
- Web API dashboard data, form validation feedback, CRUD flows, filters, category rules, recurring templates, CSV import/export, and downloadable report/chart artifacts.
- React app composition, focused feature workflows, request cancellation/stale guards, mutation
  locking, CSV import preview dialogs, delete-dialog behavior, API-client transport, downloadable
  artifact links, and SVG chart behavior.
- Currency tests cover ledger currency validation/defaults, settings persistence, report and chart formatting, CSV compatibility, API exposure, and frontend `USD`/`TRY` formatting.
- Turkish Web UI tests cover translation lookup and fallback behavior, Turkish month labels, `tr-TR` date/number/currency formatting, local language preference, and responsive Turkish text in key browser workflows.
- Playwright coverage includes keyboard navigation, dialogs, responsive reflow, theme/motion
  preferences, and automated accessibility scans across the primary browser routes.
- CLI smoke flows through Typer's test runner.
- GitHub Actions runs warning/coverage-gated pytest and Ruff on Python 3.14, plus coverage-gated
  frontend tests, generated API/SPA drift checks, a same-job wheel build, and Playwright responsive
  E2E tests on Node 24.
