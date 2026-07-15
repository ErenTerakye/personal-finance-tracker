# Personal Finance Tracker — Agent Guide

## Purpose and Scope

This repository is a portfolio-scale, single-user, local-first finance tracker. It demonstrates a
Typer CLI, FastAPI and React delivery, SQLite persistence, CSV workflows, deterministic reports,
chart generation, tests, and practical documentation.

Keep changes simple, local-first, reviewable, and easy to understand from GitHub. This file applies
to the entire repository. If a future subtree needs materially different rules, place a focused
`AGENTS.md` nearer that code instead of expanding this file.

## Start Here

- `README.md`: product overview, installation, demo flow, and project structure.
- `docs/ARCHITECTURE.md`: system boundaries, dependency direction, compatibility contracts, and
  generated artifacts. Treat it as the architecture source of truth.
- `docs/USAGE.md`: CLI, Web UI, CSV, and development instructions.
- `docs/PROJECT_PLAN.md`: roadmap and current project scope.
- `docs/RELEASE_CHECKLIST.md`: exhaustive release verification; use it for release work rather than
  routine edits.
- `pyproject.toml` and `package.json`: runtime requirements, dependencies, and runnable commands.

Before editing, inspect the relevant implementation, tests, and documentation. Preserve unrelated
worktree changes. Prefer the established local pattern over introducing a new abstraction.

## Setup and Run

The supported toolchains are Python 3.14+ and Node.js 24+.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm install
npm run build
```

Run the packaged local application with `finance-tracker web --db-path demo.sqlite3`. For frontend
development, run that FastAPI command and `npm run dev` in separate terminals; Vite serves on
`127.0.0.1:5173` and proxies `/api` to FastAPI on port 8000. Use temporary databases in tests and a
disposable explicit `--db-path` for manual checks; do not modify a user's default ledger.

## Architecture Guardrails

- Keep `cli/` and `web/` as inbound adapters. They translate input/output and call public services;
  they do not own domain rules, import repositories, or execute SQL.
- Keep domain validation in `models/`, use-case orchestration and transaction ownership in
  `services/`, connection and migration behavior in `database.py`, and raw SQL and row mapping in
  `repositories/`. Repositories never commit or roll back independently.
- Keep CSV behavior in `csv_io/`, deterministic report calculations in `reports/`, and matplotlib
  usage exclusively in `charts/`.
- In the frontend, compose routes in `app/`, own workflows in `features/`, isolate browser transport
  in `api/`, and keep reusable UI, hooks, formatting, i18n, charts, theme, and styles in `shared/`.
- Frontend features may import `api/` and `shared/`, but not other features. Only
  `frontend/src/api/client.ts` may call `fetch`.
- Treat FastAPI's OpenAPI output as the wire-contract source. Regenerate
  `frontend/src/generated/api.ts` with `npm run generate:api`; never hand-edit it.
- Do not add authentication, cloud sync, service workers, background services, a DI container, or a
  server-state library unless the project scope changes through a documented architecture decision.

## Implementation Conventions

- Prefer standard-library Python unless a dependency clearly improves the user or developer
  experience. Ask before adding a production dependency.
- Store money as `Decimal` in Python and decimal text in SQLite and JSON. Store dates as ISO text.
- Raise project exceptions for expected user-facing errors. Keep framework types inside adapters.
- Keep functions small enough to test directly and preserve public CLI, HTTP, CSV, database, and
  browser-route contracts unless the task explicitly changes them.
- Target Baseline 2026-capable browsers with progressive enhancement. Core navigation, forms,
  dialogs, and CRUD must remain usable when optional motion or newer presentation features are
  unavailable. Avoid large polyfills for styling, animation, or navigation.
- Preserve accessibility: semantic structure, keyboard and focus behavior, status announcements,
  reduced motion, forced colors, zoom/reflow, and chart alternatives are product requirements.

## Tests and Verification

Add or update focused tests when behavior changes. At minimum, cover affected validation, schema or
repository queries, service transactions, CLI/API contracts, CSV rules, report calculations, chart
output, or browser workflows. Run the smallest relevant checks while iterating, then run every
applicable check below before handoff.

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

Run `npm run test:e2e` for user-visible browser behavior and `npm run test:e2e:fullstack` for changes
that cross React, FastAPI, packaged static assets, or SQLite. Use `docs/RELEASE_CHECKLIST.md` for
dependency, packaging, audit, screenshot, demo-data, or release work. If a check cannot run, report
the exact command and reason; do not imply that verification passed.

## Documentation and Completion

Update `README.md` for user-visible features, `docs/USAGE.md` for CLI commands, options, CSV columns,
or setup steps, `docs/ARCHITECTURE.md` for durable design or contract changes, and
`docs/PROJECT_PLAN.md` when scope or roadmap changes.

Work is complete when the requested behavior is implemented, focused regression coverage exists,
applicable checks pass, generated artifacts are current, documentation matches behavior, and the
final diff contains no unrelated changes. Review the diff for regressions and state which checks
were run in the handoff.
