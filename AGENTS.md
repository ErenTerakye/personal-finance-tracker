# Agent Guide

## Project Intent

This repository is a portfolio project: a clean local-first finance tracker that demonstrates a
Typer CLI, FastAPI and React delivery, SQLite persistence, CSV processing, object-oriented design,
monthly reports, chart generation, tests, and practical documentation.

Keep the project simple, local-first, and easy to understand from GitHub.

## Architecture Rules

- Keep `cli/` and `web/` as inbound adapters. They translate input/output and call public use cases;
  they do not own domain rules, import repositories, or execute SQL.
- Keep domain validation in `models/` and use-case orchestration and transaction ownership in
  `services/`.
- Keep connection and migration behavior in `database.py`; keep raw SQL and row mapping in
  `repositories/`. Repositories never commit or roll back independently.
- Keep CSV behavior in `csv_io/`, deterministic report calculations in `reports/`, and matplotlib
  usage exclusively in `charts/`.
- Keep FastAPI framework types in `web/` and Typer/terminal presentation in `cli/`.
- In the frontend, compose routes in `app/`, own workflows in `features/`, isolate browser transport
  in `api/`, and keep reusable UI, hooks, formatting, i18n, charts, theme, and styles in `shared/`.
- Frontend features may import `api/` and `shared/`, but not other features. Only
  `frontend/src/api/client.ts` may call `fetch`.
- Do not add authentication, cloud sync, service workers, background services, a DI container, or a
  server-state library unless the project scope changes through a separate architecture decision.

## Module Responsibilities

- `config.py`: database path defaults and environment override.
- `database.py`: SQLite connection setup, schema creation, indexes, and ordered migrations.
- `models/`: domain dataclasses, enums, parsing, and validation by capability.
- `repositories/`: SQL persistence and row mapping by aggregate.
- `services/`: transactional application use cases by capability.
- `csv_io/`: transaction and budget CSV adapters plus row-level import reporting.
- `reports/`: report value models, monthly/trend calculations, and text formatting.
- `charts/`: monthly/trend PNG rendering and shared matplotlib helpers.
- `cli/`: Typer root composition, shared terminal presentation, and command groups.
- `web/`: FastAPI app composition, dependencies, middleware, errors, schemas, routers, responses,
  and SPA hosting.
- `frontend/src/app/`: browser app composition and routes.
- `frontend/src/features/`: dashboard, transaction, budget, and rules workflows.
- `frontend/src/api/`: fetch transport, artifact URLs, and API error normalization.
- `frontend/src/shared/`: reusable components, charts, hooks, formatting, i18n, theme, and layered CSS.

## Coding Conventions

- Target Python 3.14+.
- Prefer standard-library features unless a dependency clearly improves the CLI or report experience.
- Store money as `Decimal` in Python and text in SQLite.
- Store dates as ISO strings in SQLite.
- Raise project exceptions for expected user-facing errors.
- Keep functions small enough to test directly.

## Browser Support & Baseline Target

The frontend application targets modern execution environments.

- **Baseline Target**: **Baseline 2026** (or newer).
  - This enables native use of modern web capabilities, including the Navigation API for client-side routing, Container Style Queries, the Popover API, CSS `@scope`, same-document View Transitions, and CSS entry/exit animations/transitions (`@starting-style` and `transition-behavior: allow-discrete`).
- **Minimum Browser Support**:
  - Chrome 132+
  - Safari 19+ (or newer releases supporting the Navigation API)
  - Firefox 147+
  - Edge 132+
  - Mobile: iOS Safari 19+, Chrome/Firefox for Android (2026 releases)
- **Fallback Philosophy**:
  - Adopt progressive enhancement.
  - Do not introduce complex polyfills or large external dependencies for visual styling, animations, or navigation.
  - Ensure features degrade gracefully (e.g. if modern transitions are unsupported, modal dialogs open/close and views navigate instantly, remaining fully functional).

## Testing Expectations

Use pytest and temporary directories/databases. Add or update tests when changing:

- Validation rules.
- SQL schema or repository queries.
- CLI command behavior.
- CSV import/export rules.
- Monthly report calculations.
- Chart output behavior.

Run:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
.venv/bin/python -m mypy
npm test
npm run lint
npm run format:check
npm run build
npm run check:bundle
```

## Documentation Expectations

Update `README.md` for user-visible feature changes. Update `docs/USAGE.md` when CLI commands, options, CSV columns, or setup steps change. Update `docs/PROJECT_PLAN.md` when the roadmap or architecture changes.
