# Architecture

## Scope and trust model

Personal Finance Tracker is a single-user, local-first layered modular monolith. The Textual TUI,
grouped Typer CLI, and React browser UI share one SQLite ledger through the same Python use cases.
The FastAPI server binds to `127.0.0.1` by default and has no authentication, remote account,
telemetry, cloud sync, background worker, or service worker. Non-loopback binding is rejected unless
the operator passes `--allow-remote-unauthenticated`, making that trust-boundary exception explicit.

## Containers and dependency direction

```text
Typer command groups ───────┐
Textual workspace ──────────┼─> services ─> repositories ─> SQLite
FastAPI routers/schemas ────┘       │
       ▲                            ├─> CSV adapters
       │                            └─> reports ─> matplotlib charts
React feature modules ── same-origin JSON/CSV/text/PNG
```

- `models/` contains framework-free domain values and validation.
- `database.py` owns connection configuration, schema SQL, and ordered migrations.
- `repositories/` owns parameterized SQL and row mapping but never commits independently.
- `services/` owns application validation, orchestration, complete commit/rollback units, and the
  shared framework-neutral overview read model.
- `csv_io/`, `reports/`, and `charts/` own their formats and calculations. Matplotlib appears only
  in `charts/`.
- `cli/`, `tui/`, and `web/` are inbound adapters. They call public services and never import
  repositories or execute SQL. Textual imports remain isolated in `tui/`.
- Python import boundaries are checked by `tests/architecture/test_python_imports.py`.

The frontend follows one dependency direction:

```text
main.tsx -> app/ -> features/ -> api/
                 \           -> shared/
                  -----------> shared/
api/ -> types.ts -> generated/api.ts
```

Feature folders own workflows and may import `api/` and `shared/`, but never another feature. App
composition owns routing and cross-feature composition. `shared/` owns reusable components, hooks,
formatting, i18n, theme, charts, and layered styles. Browser transport is isolated in `api/`, and
`fetch` is used only by `api/client.ts`. ESLint enforces these boundaries.

## Terminal delivery

The Typer root renders an inline overview by default. Interactive terminals receive a compact
Textual launcher in normal scrollback with arrow, number, mouse, and quit bindings; pipes receive a
non-blocking snapshot and command hints, while `--output json` remains machine-readable. The
full-screen Textual workspace launches only through the explicit `tui` command and only when the
terminal is capable. The TUI operates directly on the selected SQLite ledger,
uses five stable destinations, responsive 80×24 layouts, modal forms, keyboard/mouse input,
non-color status labels, and the built-in fuzzy command palette. No FastAPI process is required.
Command-mode JSON wraps money and dates without changing their decimal/ISO contracts, and
destructive automation requires explicit confirmation.

## Request and transaction flow

A CLI command, TUI action, or FastAPI router validates adapter input and calls a concrete service. The service
opens a configured connection, constructs repositories for that connection, and owns the complete
transaction. Repositories execute SQL and return domain models. Successful use cases commit at the
service boundary; failures roll back before project exceptions are translated by the inbound
adapter. The database-owned transaction context always closes its connection after either outcome.

This explicit construction is deliberately small. The project has one persistence implementation
and does not use repository protocols, a dependency-injection container, or a global server-state
cache.

## Web delivery

During development Vite proxies `/api` to FastAPI at `127.0.0.1:8000`. Production builds are written
to `src/finance_tracker/web/static/spa`, included in the wheel, and served by FastAPI with an
`index.html` fallback for browser routes. Unknown client routes render the React not-found view.

FastAPI's OpenAPI document is the source for the checked-in TypeScript wire types. Financial API
responses use `Cache-Control: no-store`; the server also supplies CSP, `nosniff`, referrer,
permissions, and frame-ancestor protections.

The browser uses small custom resource and mutation hooks for request cancellation, stale-response
guards, error normalization, duplicate-submit prevention, and explicit refresh. A bounded,
page-session-only resource cache deduplicates route preparation, keeps successful reads fresh for a
short window, and invalidates related data after mutations. It does not persist financial responses,
add a server-state dependency, perform optimistic updates, or retry failed requests automatically.

Browser composition exposes exactly four primary destinations: Overview (`/`), Transactions
(`/transactions`), Budgets (`/budgets`), and Accounts (`/accounts`). Lower-frequency setup is
secondary under `/manage/*`. The app layer owns canonical-route metadata, compatibility redirects,
document titles, route focus, browser-history continuity, and cross-feature context handoff.
`app/routeLifecycle.ts` owns route module preparation, compatibility normalization, period parsing,
idle scheduling, and focus readiness. Manage's data and preferences sections and the budget
inspector are feature-local owners rather than responsibilities embedded in their route composers.
Feature modules continue to own their workflows and never import one another. Compatibility paths
translate `/cash-flow` to `/`, `/net-worth` to `/accounts`, and `/rules` to
`/manage/automations`, retaining only relevant query parameters.

Primary destinations are prepared sequentially during browser idle time and on navigation intent.
Visited routes remain in React Activity boundaries so their loaded results, filters, and local view
state can be restored without rebuilding the route. The app shell owns the delayed route-loading
threshold, stable page-shaped fallback, route focus, scroll restoration, and content-only View
Transition boundary; unsupported or reduced-motion environments switch views immediately.

## Styling, accessibility, and browser policy

Global CSS is split into the ordered native cascade layers `tokens`, `reset`, `base`, `layout`,
`components`, `features`, `utilities`, and `overrides`. The source order and built output are checked
without adding a CSS architecture dependency. Persistent application-shell styles remain eager,
while route-owned feature, component, motion, and accessibility rules are imported from their
feature directories and emitted with the corresponding lazy route chunks.

The production bundle check measures minified assets after gzip as a stable compressed-transfer
proxy. It caps render-blocking initial CSS at 12 KiB, each individual lazy CSS chunk at 7 KiB,
the cumulative lazy CSS loaded by any route at 8 KiB, and all CSS at 32 KiB. Route totals are derived
from Vite's production manifest and include shared component styles, so splitting a route across
multiple files cannot hide stylesheet growth. Styles shared by the default dashboard and multiple
routes remain in the initial bundle when doing so reduces route requests and aggregate compressed
transfer without approaching the initial limit. The aggregate ceiling leaves approximately 6%
maintenance headroom at the measured 30.18 KiB production baseline. The 32 KiB aggregate ceiling is
the executable release contract; raising it requires measured output and rationale here rather than
an automatic adjustment when utilization grows. The Accounts and Overview route utilization is an
optimization signal, not a reason to split styles solely to satisfy source-size metrics.

The UI targets Baseline 2026 and progressively enhances native dialogs, popovers, container queries,
same-document view transitions, and modern CSS. Core navigation, forms, dialogs, and CRUD remain
usable without optional motion. Semantic landmarks, route focus, dialog focus restoration, live
status regions, chart data alternatives, responsive reflow, forced-colors support, and reduced
motion are verification targets.

## Database and compatibility

SQLite schema changes remain ordered in `database.py` and tracked with `PRAGMA user_version`. An
existing unversioned v1 database is stamped and upgraded in place without discarding records.
Connections enable foreign keys, WAL, a busy timeout, and `synchronous=NORMAL` with explicit Python
3.14 transaction behavior. Money remains `Decimal` in Python and decimal text in SQLite and JSON.
Individual transaction, budget, recurring, and balance values are capped at
`90071992547409.91`—the largest cent value whose integer minor units fit in JavaScript's safe
integer range. The browser formats decimal strings directly and uses integer-cent helpers for
display-side sums, differences, and comparisons; floating-point chart coordinates are
presentation-only. Dates remain ISO text.

The 39 CLI commands, 40 HTTP operations, OpenAPI schema names, CSV headers, SQLite schema/indexes,
documented canonical and compatibility browser routes, security headers, and package entrypoints
frozen by
[`ARCHITECTURE_CLEANUP_SPEC.md`](ARCHITECTURE_CLEANUP_SPEC.md) are compatibility contracts. Tests
characterize those contracts, and generated OpenAPI output is changed only through the generator.
`npm run check:generated` snapshots and regenerates OpenAPI types and the packaged SPA, checks
bundle budgets, and fails on any added, removed, or modified file in either generated surface.

Complete-ledger recovery is separate from interoperable CSV workflows. `LedgerRecoveryService`
uses SQLite's backup API for consistent WAL-aware copies and validates declared-version table,
column, and index manifests along with integrity and foreign keys. Restore copies into the active
ledger directory, migrates and re-verifies that temporary database against the current contract,
and atomically replaces the active file only after preparation succeeds.

## Demo source and generated artifacts

The reviewer ledger is generated local state, not a checked-in database. `examples/build_demo.py`
combines the inspectable transaction and budget CSVs with category rules, recurring templates,
settings, and account balance histories through public services. `demo.sqlite3`, report images,
exports, and screenshots remain generated artifacts; the example sources and deterministic
integration test are the reproducibility contract.
