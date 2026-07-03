# Roadmap

Personal Finance Tracker is a local-first portfolio project: a Python finance
tracker with a polished CLI, SQLite persistence, CSV workflows, reports, chart
generation, and a first-class FastAPI + React Web UI over the same local data.

The roadmap below is written for GitHub reviewers. It shows what already works,
what the project is intentionally not trying to become, and which improvements
would make it stronger without bloating the scope.

## Current Snapshot

- Python CLI supports transaction add/edit/list/delete, monthly budgets, CSV
  import/export, monthly summaries, multi-month trends, and optional PNG charts.
- SQLite is the only persistence layer. Money is represented with `Decimal` in
  Python and stored as text for predictable round-tripping.
- FastAPI exposes local JSON endpoints under `/api` and serves the packaged
  React + Vite + TypeScript SPA.
- The Web UI includes dashboard, transaction, and budget workflows with
  responsive layouts, accessible dialogs, SVG charts, period controls, route
  navigation, and persistent light/dark/system theme behavior.
- A static showcase exists for portfolio hosting, while real CRUD remains a
  local Python/SQLite workflow.
- GitHub Actions mirrors the documented check set with Python tests, Ruff,
  frontend unit tests, production build, and Playwright responsive E2E tests.
- Local quality checks last verified on July 3, 2026:
  - `.venv/bin/python -m pytest` - 49 passed, with one FastAPI/Starlette
    `TestClient` deprecation warning to watch.
  - `.venv/bin/python -m ruff check .` - passed.
  - `npm test` - 18 frontend unit tests passed.
  - `npm run build` - passed.
  - `npm run test:e2e` - 35 Playwright responsive E2E tests passed.

## Guiding Principles

- Keep the project local-first and easy to understand from GitHub.
- Prefer portfolio-scale depth over product sprawl.
- Reuse the Python service, repository, and report layers from both CLI and web
  entrypoints.
- Keep raw SQL in database/repository modules and browser code out of financial
  domain rules.
- Preserve decimal-safe money handling across Python, SQLite, API responses, and
  browser displays.
- Avoid authentication, hosted accounts, cloud sync, background workers, and
  multi-user concerns unless the project scope intentionally changes.

## Milestones

### v0.2 Portfolio V1 Hardening

Make the existing app feel complete, reviewable, and trustworthy.

- Resolve or document the FastAPI/Starlette `TestClient` deprecation warning.
- Add reviewer-facing badges for the CI-backed documented check set.
- Tighten the reproducible demo flow around `demo.sqlite3`, sample CSV imports,
  generated charts, and `finance-tracker web --db-path demo.sqlite3`.
- Align README, usage docs, project plan, static showcase, and screenshots so
  they tell the same story.
- Add a small release checklist covering install, demo, checks, package build,
  static showcase refresh, and generated SPA asset refresh.

### v0.3 Browser Workflow Parity

Bring the browser closer to the CLI for common local workflows.

- Add browser CSV import/export for transactions and budgets using the existing
  CSV behavior where possible.
- Add downloadable chart or report artifacts from the Web UI.
- Improve empty, loading, validation, and API error states across dashboard,
  transactions, and budgets.
- Keep browser workflow tests focused on visible user behavior and responsive
  layout stability.

### v0.4 Finance Insight Depth

Add higher-value finance features only after the core portfolio surface is
stable.

- Add recurring transaction templates for predictable income and expenses.
- Add category normalization or category rules to reduce report fragmentation.
- Add richer month-over-month and year-to-date summaries.
- Add CSV import preview and duplicate-detection safeguards before write-heavy
  imports.
- Keep all new behavior available through the service layer before exposing it
  in CLI or Web UI commands.

### v1.0 Portfolio Release

Prepare the project as a clean public showcase.

- Complete final documentation pass across README, usage docs, project plan, and
  roadmap.
- Run an accessibility and responsive QA pass on the Web UI.
- Refresh static showcase content, screenshots, and demo data.
- Verify install from a fresh clone on a clean virtual environment.
- Tag the release once checks, docs, demo flow, and packaged SPA assets are in
  sync.

## Backlog / Later

- Add lightweight SQLite migrations if schema changes outgrow
  `CREATE TABLE IF NOT EXISTS`.
- Split FastAPI request/response models from route definitions if the API grows.
- Generate frontend API types from an OpenAPI schema if manual TypeScript types
  become noisy or error-prone.
- Add richer chart options while keeping matplotlib isolated in `charts.py` and
  browser SVG charts in frontend components.
- Explore packaging polish such as a wheel build check or scripted demo reset.

## Non-Goals

- Hosted user accounts.
- Authentication or authorization.
- Cloud sync or remote databases.
- Multi-user collaboration.
- Background services, scheduled jobs, or daemons.
- A large web platform beyond the local-first portfolio application.
