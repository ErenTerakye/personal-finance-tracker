# Roadmap

Personal Finance Tracker is a local-first portfolio project: a Python finance
tracker with a polished CLI, SQLite persistence, CSV workflows, reports, chart
generation, and a first-class FastAPI + React Web UI over the same local data.

The roadmap below is written for GitHub reviewers. It shows what already works,
what the project is intentionally not trying to become, and which improvements
would make it stronger without bloating the scope.

## Current Snapshot

- Python CLI supports transaction add/edit/list/delete, monthly budgets, category
  alias rules, recurring transaction templates, CSV import/export with
  transaction preview and duplicate safeguards, monthly summaries, multi-month
  trends, and optional PNG charts.
- SQLite is the only persistence layer. Money is represented with `Decimal` in
  Python and stored as text for predictable round-tripping.
- FastAPI exposes local JSON endpoints under `/api` and serves the packaged
  React + Vite + TypeScript SPA.
- The Web UI includes dashboard, transaction, budget, and rules workflows with
  responsive layouts, accessible dialogs, SVG charts, period controls, route
  navigation, browser CSV import/export, transaction CSV preview, dashboard
  report/chart downloads, persistent light/dark/system theme behavior, and
  English/Turkish language preferences.
- A static showcase exists for portfolio hosting, while real CRUD remains a
  local Python/SQLite workflow.
- Total net worth is available through dated asset/liability balance snapshots, CLI commands,
  FastAPI/OpenAPI, a compact Overview aggregate, and a dedicated lazy-loaded browser workspace.
- GitHub Actions mirrors the documented check set with Python tests, Ruff, mypy,
  frontend linters, OpenAPI drift and bundle budgets, production build, dependency
  audits, and cross-browser Playwright E2E tests.
- v1.1 packages the project as a clean public portfolio release with refreshed
  documentation, static showcase copy, reviewer screenshots, packaged SPA
  assets, demo artifacts, accessibility coverage, and install/package checks.
- Local quality checks last verified for v1.1 on July 10, 2026:
  - `.venv/bin/python -m pytest` - 69 passed.
  - `.venv/bin/python -m ruff check .` - passed.
  - `npm test` - 25 frontend unit tests passed.
  - `npm run build` - passed.
  - `npm run test:e2e -- --project=chromium` - 54 responsive/accessibility tests passed.
  - Critical Firefox/WebKit suite - 16 tests passed.
  - Packaged FastAPI + SQLite Playwright suite - 2 tests passed.
  - `.venv/bin/python -m build` - built the source distribution and universal
    wheel for `personal-finance-tracker` 1.1.0.
  - Fresh install checks passed with a clean virtual environment,
    `python -m pip install -e ".[dev,web]"`, `npm ci`, and `npm run build`.

The post-1.1 architecture cleanup is specified in
[`docs/ARCHITECTURE_CLEANUP_SPEC.md`](docs/ARCHITECTURE_CLEANUP_SPEC.md). It preserves the frozen CLI,
HTTP, SQLite, CSV, browser, and packaging contracts while assigning every Python and frontend
hotspot a capability-focused owner and enforcing dependency direction in automated checks.

## Guiding Principles

- Keep the project local-first and easy to understand from GitHub.
- Prefer portfolio-scale depth over product sprawl.
- Reuse the Python service, repository, and report layers from both CLI and web
  entrypoints.
- Keep raw SQL in database/repository modules and browser code out of financial
  domain rules.
- Preserve decimal-safe money handling across Python, SQLite, API responses, and
  browser displays.
- Treat currency as a local ledger setting first, not as mixed-currency
  accounting or exchange-rate automation.
- Keep Turkish language support focused on the Web UI until the CLI/reporting
  surface has a broader localization reason.
- Avoid authentication, hosted accounts, cloud sync, background workers, and
  multi-user concerns unless the project scope intentionally changes.

## Completed

### v0.2.0 Portfolio V1 Hardening

The existing app now feels complete, reviewable, and trustworthy for portfolio
reviewers.

- Added reviewer-facing badges for the CI-backed documented check set.
- Tightened the reproducible demo flow around generated `demo.sqlite3`, sample
  CSV imports, generated charts, and `finance-tracker web --db-path demo.sqlite3`.
- Aligned README, usage docs, static showcase copy, and tracked screenshots so
  they tell the same story.
- Added a small release checklist covering install, demo, checks, package build,
  static showcase refresh, screenshots, and generated SPA asset refresh.

### v0.3 Browser Workflow Parity

The browser now covers the common local workflows reviewers would expect from
the CLI-backed app.

- Added transaction and budget CSV import/export from the Web UI using the same
  CSV parsing and formatting rules as the CLI.
- Added dashboard downloads for monthly text reports, monthly PNG charts,
  six-month trend text reports, and six-month trend PNG charts.
- Improved visible loading, empty, import summary, validation, and API error
  states across dashboard, transactions, and budgets.
- Added focused API, React unit, and Playwright responsive coverage for the new
  browser workflows.

### v0.4 Finance Insight Depth

The app now has higher-value insight features while staying explicit and
local-first.

- Added category alias rules that canonicalize transaction and budget writes.
- Added manually applied monthly recurring transaction templates for predictable
  income and expenses.
- Added year-to-date totals and month-over-month deltas to monthly and trend
  reports.
- Added transaction CSV preview and duplicate-detection safeguards before
  write-heavy imports.
- Exposed the behavior through the service layer, CLI commands, FastAPI
  endpoints, and a compact Web UI Rules workflow.

### v0.5 Local Currency Readiness

Make the single-ledger money model explicit before adding localization polish.

- Support one configurable currency per local database, defaulting existing and
  demo data to `USD`.
- Add a small settings/config surface shared by CLI, FastAPI responses, reports,
  charts, CSV workflows, and Web UI formatting.
- Expose the active ledger currency through the API so the frontend stops
  hardcoding `en-US` and `USD` in money formatters.
- Preserve CSV compatibility by importing existing transaction and budget CSVs
  without currency columns using the active ledger currency.
- Add focused Python, React, and Playwright coverage for currency validation,
  defaults, formatting, API exposure, and `USD`/`TRY` display.

### v0.6 Web UI Localization

Add Turkish language support after currency contracts are stable.

- Add an English/Turkish language toggle in the browser, stored as a local
  browser preference.
- Introduce frontend translation dictionaries for labels, empty states, dialogs,
  validation display, navigation, month names, and accessible labels.
- Use locale-aware number, date, and currency formatting, including `tr-TR`,
  while reusing the active ledger currency from v0.5.
- Keep CLI output, generated text reports, and project documentation in English
  unless the project intentionally expands localization scope.
- Add React and Playwright coverage for translation fallback behavior, Turkish
  month labels, Turkish currency/date formatting, and responsive Turkish UI text.

### v1.0 Portfolio Release

Prepared the project as a clean public showcase.

- Completed final documentation pass across README, usage docs, project plan, and
  roadmap.
- Added automated accessibility scans and keyboard smoke checks to the
  Playwright Web UI suite, alongside existing responsive coverage.
- Refreshed static showcase content, reviewer screenshots, packaged SPA assets,
  and generated local demo artifacts from the July 2026 reviewer flow.
- Verified install from a clean virtual environment plus `npm ci`, production
  build, Python package build, and the full documented check set.

### Post-1.1 Architecture Cleanup

Completed the compatibility-first structural cleanup without expanding product scope.

- Split Python domain, persistence, service, format, CLI, and FastAPI hotspots into
  responsibility-focused packages while preserving public entrypoints and behavior.
- Split the React application into app composition, API transport, feature workflows, and shared
  hooks/components/formatting/i18n/theme/chart/style ownership.
- Added executable Python and frontend dependency boundaries plus CSS cascade/output checks.
- Added focused request lifecycle, adapter-contract, architecture, accessibility, and packaged
  full-stack verification around the frozen contracts.
- Synchronized generated API types, packaged SPA assets, architecture guidance, release material,
  and reviewer documentation from the final source tree.
- Recorded the final automated, cross-browser, package, performance, and live interaction results in
  [`docs/ARCHITECTURE_CLEANUP_EVIDENCE.md`](docs/ARCHITECTURE_CLEANUP_EVIDENCE.md).

### Total Net Worth

- Added schema version 2 with asset/liability accounts and dated balance snapshots.
- Added transactional account lifecycle safeguards, deterministic as-of summaries and bounded
  monthly history, CLI parity, and FastAPI/OpenAPI contracts.
- Added a fifth Net worth browser destination with English/Turkish copy, account workflows,
  responsive composition, and an accessible SVG chart plus complete data table.
- Renamed the Overview's income-minus-expenses concept to monthly net cashflow so it is not confused
  with net worth.

## Maintenance Focus

- Keep documentation, screenshots, packaged SPA assets, and release checklist in
  sync when reviewer-facing behavior changes.
- Keep accessibility and responsive checks current as the Web UI evolves.
- Prefer small, reviewable improvements from the backlog over new product scope.

## Backlog / Later

- Add richer chart options while keeping matplotlib isolated in `charts/` and browser SVG charts in
  shared frontend chart modules.
- Explore packaging polish such as a wheel build check or scripted demo reset.
- Explore mixed-currency transaction support, exchange-rate lookup, and
  per-transaction currency fields only after the single-ledger model proves
  useful.
- Consider Turkish CLI/report/documentation localization only if user-facing
  scope grows beyond the current local portfolio app.
- **TypeScript 7.x Migration Path**: Plan upgrade from `5.9.3` to the latest stable version `7.0.2` (Go-based compiler release):
  - **Tooling Check**: Verify compatibility for parser and linter tools (`typescript-eslint` v8) with TS 7.0's AST representation.
  - **Package Upgrade**: Run `npm install --save-dev typescript@7.0.2` and check corresponding dependencies/types.
  - **Compiler Config**: Verify the project reference structure (`tsc -b` with the primary `tsconfig.json` referencing `tsconfig.app.json` and `tsconfig.node.json`) compiled under the Go-based engine.
  - **Unicode Verification**: Inspect custom string-handling type logic for template literal type changes (TS 7.0 treats surrogate pairs as single Unicode units rather than split UTF-16 code units).
  - **Verification Suite**: Clean the state and run the complete validation chain: `rm -rf node_modules && npm ci && npm run lint && npm run build && npm test && npm run test:e2e`.

## Non-Goals

- Hosted user accounts.
- Authentication or authorization.
- Cloud sync or remote databases.
- Multi-user collaboration.
- Background services, scheduled jobs, or daemons.
- Exchange-rate fetching or automated currency conversion before a deliberate
  mixed-currency milestone.
- A large web platform beyond the local-first portfolio application.
