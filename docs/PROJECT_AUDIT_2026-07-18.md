# Project Audit — 2026-07-18

## Executive summary

Personal Finance Tracker is unusually complete for a portfolio-scale local application. Its domain
boundaries are explicit, money handling is decimal-safe at the application boundary, migrations are
versioned and tested, API types are generated, browser workflows have broad cross-browser coverage,
and the accessibility suite exercises more than an automated score.

The project is not blocked by a broad rewrite. The most valuable next work is concentrated in two
release-critical defects and four hardening areas:

1. **Close every SQLite connection deterministically.** The current service pattern leaks database
   connections because a `sqlite3.Connection` context manager does not close the connection.
2. **Make packaged SPA drift fail CI.** A clean production build does not match the SPA assets
   checked into the Python package, and CI does not compare those generated assets with Git.
3. **Require explicit opt-in before serving an unauthenticated ledger beyond loopback.** A warning
   is too weak for a server with mutating financial endpoints and no authentication.
4. **Add complete-ledger backup and restore.** CSV portability covers transactions and budgets but
   not accounts, balance history, rules, recurring templates, or settings.
5. **Bring frontend dependency and Hooks lint rules back in line with the documented architecture.**
6. **Reduce responsibility concentration in the largest route modules and make quality regressions
   visible through warning and coverage gates.**

The recommended order is to fix connection ownership first, add the packaged-build drift gate
second, then address remote binding and full-ledger recovery before further feature work.

## Scope and method

This audit reviewed the repository as a local-first finance product and as a public portfolio
artifact. It covered:

- Python domain models, services, repositories, SQLite configuration and migrations;
- Typer and FastAPI adapter boundaries, error handling, security headers, and hosting behavior;
- React composition, API transport, resource/mutation hooks, forms, dialogs, charts, i18n, CSS,
  accessibility, responsive behavior, and bundle controls;
- unit, integration, architecture, browser, packaged full-stack, coverage, and dependency checks;
- README, architecture, usage, roadmap, release, and generated-artifact documentation;
- repository hygiene and the state of generated files.

The review used the project's Baseline 2026 browser policy and current accessibility/form guidance.
No manual screen-reader session, multi-hour database soak test, or non-loopback penetration test was
performed. Those are called out where they would add confidence.

## Priority findings

### P0 — SQLite connections are committed but not closed

**Evidence**

- `database.connect()` returns a raw `sqlite3.Connection`.
- Services use `with connect(self.db_path) as connection:` in 37 source call sites.
- A SQLite connection's context manager commits or rolls back the transaction; it does not call
  `close()`.
- Running the Python suite with coverage produced **1,218 `ResourceWarning`s** for unclosed SQLite
  connections, despite all 107 tests passing.
- The worktree contained `demo.sqlite3-wal` and `demo.sqlite3-shm` before the audit. Those files are
  not proof of the leak by themselves, but they are consistent with an open WAL-mode ledger and
  expose the repository-hygiene gap described later.

**Impact**

Long-running Web UI sessions and command-heavy processes can accumulate file descriptors and
database handles. That increases the risk of resource exhaustion, delayed WAL cleanup, confusing
locking behavior, and platform-dependent failures that short tests will not expose.

**Recommended change**

Add one database-owned transaction context manager that opens, commits or rolls back, and always
closes the connection in `finally`. Migrate services to that API instead of relying on the raw
connection context protocol. Keep transaction ownership in services and repository commit behavior
unchanged.

Add a regression test that repeatedly executes a representative service operation, forces garbage
collection with `ResourceWarning` treated as an error, and proves no connection remains open. Run
the normal Python suite with at least `error::ResourceWarning` once the existing leak is fixed.

**Acceptance criteria**

- Every application-created connection has one obvious owner and deterministic close path.
- Success still commits and exceptions still roll back atomically.
- `.venv/bin/python -m pytest -W error::ResourceWarning` passes.
- A repeated Web/API operation does not grow open database descriptors.

### P0 — The packaged Web UI is stale and CI cannot detect it

**Evidence**

- `npm run build` succeeds and passes all bundle budgets.
- A sequential clean audit build changed `asset-manifest.json`, `index.html`, the initial CSS/JS
  hashes, and every lazy JavaScript chunk hash under `src/finance_tracker/web/static/spa/`.
- The generated build produced a different initial bundle (`index-D1eJJZnF.js` and
  `index-BQD1Amom.css`) from the checked-in package (`index-cb6_Komw.js` and
  `index-CCYq5sPH.css`).
- CI checks drift for `frontend/src/generated/api.ts`, but after `npm run build` it does not run a
  Git diff/status check for the packaged SPA directory.
- The packaged full-stack test passes against the checked-in assets. That proves the old bundle is
  functional, not that it represents the current React source.

**Impact**

The CLI package can ship browser code different from the reviewed frontend source. A source fix can
pass unit, lint, E2E, build, and full-stack checks while the wheel still contains an older UI. This
weakens release reproducibility and is especially visible in a portfolio repository where generated
assets are intentionally committed.

**Recommended change**

Choose and document one generated-asset policy. The current architecture implies that packaged SPA
assets remain committed, so CI should:

1. run OpenAPI generation;
2. build the SPA;
3. run bundle checks;
4. fail if either generated API types or any tracked/untracked file under the packaged SPA differs.

Use a clean checkout for release builds and add a single script such as `check:generated` so local
and CI behavior cannot diverge. Regenerate and commit the current SPA once the gate exists.

**Acceptance criteria**

- Two consecutive clean builds are byte-for-byte stable.
- CI fails when frontend source changes without refreshed packaged assets.
- The wheel smoke test runs against assets generated in the same job.
- The release checklist and README use the same generated-artifact command.

### P1 — Non-loopback hosting needs an explicit safety gate

**Evidence**

- The default host is safely set to `127.0.0.1`.
- `finance-tracker web --host 0.0.0.0` is allowed after printing a warning.
- The API has mutating endpoints and intentionally has no authentication or authorization.
- Security headers and same-origin browser behavior do not prevent a network client from calling an
  exposed API directly.

**Impact**

A copied development command, container configuration, or LAN demo can expose private financial
data and destructive operations to other network users. The current message informs the user but
does not prevent accidental exposure.

**Recommended change**

Reject non-loopback hosts by default. Require a deliberately named flag such as
`--allow-remote-unauthenticated` to proceed, print the resolved bind address and database path, and
cover IPv4/IPv6 loopback classification with tests. This preserves the no-authentication scope while
making the trust-boundary exception unmistakable.

### P1 — There is no complete-ledger recovery workflow

**Evidence**

- Transaction and budget CSV import/export are well tested.
- Accounts, dated balance snapshots, category rules, recurring templates, and settings are not part
  of those exports.
- The Accounts feature increases the amount of irreplaceable data stored only in SQLite.
- Documentation explains demo rebuilding but does not give a supported backup, integrity-check,
  restore, or recovery workflow for a user's real ledger.

**Impact**

Users can believe “export” protects their data while losing account history and configuration.
Because the product is local-first and has no cloud sync, recovery is a core ownership feature, not
an enterprise expansion.

**Recommended change**

Provide a complete-ledger backup command using SQLite's backup API so WAL state is captured safely.
Pair it with an integrity/schema-version check and a deliberately confirmed restore workflow. CSV
should remain the interoperable format for transactions and budgets; the database backup should be
the fidelity-preserving format for the whole ledger. Document where backups live and how to verify
and restore one. Browser download can follow later if it does not complicate the local trust model.

### P1 — Frontend architecture enforcement has drifted from the architecture document

**Evidence**

- The documented rule says features may not import other features.
- ESLint has separate cross-feature rules for `transactions`, `budgets`, `dashboard`, and `rules`.
- Current feature directories also include `manage` and `net-worth`, but neither has a matching rule.
- The rule lists are hand-maintained and name only selected sibling features, so a new feature is
  unprotected until configuration is updated correctly.
- `react-hooks/exhaustive-deps` and `react-hooks/set-state-in-effect` are disabled for the entire
  frontend. These rules target stale closures and effect-driven render chains in exactly the custom
  resource, routing, media, transition, and preference code this project owns.
- `@typescript-eslint/no-explicit-any` is also disabled globally rather than scoped to necessary
  adapter/test boundaries.

**Impact**

The repository can violate its main frontend dependency contract while lint remains green. Global
Hooks exceptions make future asynchronous state defects easier to introduce and harder to review.

**Recommended change**

Replace per-feature sibling lists with one rule that forbids any `features/*` module importing a
different `features/*` subtree. Add a small architecture test if ESLint glob semantics make that
awkward. Re-enable Hooks rules and fix findings incrementally, using narrow documented suppressions
only where an intentional custom-hook invariant is tested. Scope `any` exceptions to generated,
test, or boundary code.

### P2 — Responsibility is concentrated in a few frontend hotspots

**Evidence**

- `NetWorthView.tsx` is 1,303 lines and `WealthOverview.tsx` is 1,003 lines.
- `ManageView.tsx` is 987 lines, `BudgetsView.tsx` is 862 lines, and `app/App.tsx` is 851 lines.
- `net-worth.css` is 1,993 lines, `dashboard-components.css` is 1,422 lines, and `budgets.css` is
  1,189 lines.
- The two locale dictionaries are about 840 lines each and must remain structurally synchronized.
- The largest modules mix data preparation, workflow state, dialogs, analytics, layout, and view
  composition even though the repository otherwise favors capability ownership.

Line count alone is not a defect, and the existing architecture specification correctly rejects
arbitrary line-count gates. Here it is a signal of review surface and change coupling: account,
budget, and Manage work is likely to touch files with many unrelated responsibilities.

**Recommended change**

Decompose by stable responsibility, not by visual fragment. Good seams include account lifecycle,
balance check-in, history analytics, Manage section routes, budget inspector/form orchestration, and
route-state/history coordination. Keep feature-local components feature-local and preserve the
existing dependency direction. Add a typed locale-key parity test or generation step so dictionary
drift is caught without manually comparing two large files.

### P2 — Quality signals are broad but not regression-gated

**Evidence**

- Python coverage is **91%** overall, with service and report code generally above 90%; CLI account
  commands are the largest low-coverage area at 45%.
- Frontend coverage is **79.03% lines**, **77.93% statements**, **73.23% branches**, and **71.70%
  functions**.
- Neither pytest nor Vitest coverage is part of normal CI, and no conservative regression threshold
  is configured.
- The standard Python suite passed while the connection leak emitted no visible warning; the same
  suite under coverage exposed 1,218 warnings.

**Recommended change**

Add coverage reporting to CI with conservative floors just below the current baseline, then raise
them only when useful. More importantly, fail on `ResourceWarning` and retain focused behavior tests
for transaction boundaries, migrations, generated contracts, accessibility, and packaged delivery.
Coverage should protect against large regressions, not become a substitute for those tests.

### P2 — Repository and public-documentation hygiene need a short cleanup

**Evidence**

- `.gitignore` ignores `*.sqlite3` and `*.sqlite3-journal` but not `*.sqlite3-wal` or
  `*.sqlite3-shm`; both appeared as untracked files at audit start.
- `ROADMAP.md` reports 69 Python tests and 25 frontend unit tests, while the current runs contain
  107 and 145 respectively.
- The roadmap describes Total Net Worth as a fifth browser destination, while the current
  architecture intentionally exposes four primary destinations and integrates net worth into
  Accounts.
- The roadmap's “last verified” section can become stale immediately and duplicates release
  evidence maintained elsewhere.

**Recommended change**

Ignore SQLite WAL/SHM sidecars explicitly without broadening ignores beyond local ledger artifacts.
Replace fragile test counts in the roadmap with links to CI/release evidence, and align destination
language with `docs/ARCHITECTURE.md`. Keep historical goal/release documents as records, but make
README, Architecture, Usage, Roadmap, and the release checklist agree on current behavior.

## Areas that are already strong

These should be preserved while addressing the priorities above:

- **Layering:** adapters, services, repositories, models, CSV, reports, and charts have clear owners;
  Python architecture tests enforce important parts of the direction.
- **Transaction semantics:** service-level operations and migration rollback have focused tests.
- **Money contracts:** Python uses `Decimal`, API money is serialized as text, and SQLite stores
  decimal text rather than binary floating point.
- **API contracts:** FastAPI OpenAPI drives generated TypeScript types; request schemas reject unsafe
  input and API errors are normalized.
- **Local security posture:** loopback is the default; API responses are `no-store`; CSP,
  `nosniff`, referrer, permission, and frame protections are present; dependency audits were clean.
- **Accessibility:** native dialogs, keyboard workflows, focus behavior, forced colors, 200% text
  reflow, reduced motion, chart tables, and automated axe checks are covered across Chromium,
  Firefox, and WebKit. Manual screen-reader testing remains useful release validation, but no major
  accessibility defect was identified in this audit.
- **Responsive behavior:** the E2E matrix covers 320px through 1920px and multiple interaction
  modes rather than relying on screenshots alone.
- **Performance discipline:** route splitting and explicit gzip budgets are present and the current
  source build is within every configured budget.
- **Dependency health:** both npm and Python advisory audits reported no known vulnerabilities.

## Suggested implementation sequence

### Phase 1 — Reliability and release truth

1. Introduce the close-safe database transaction context and migrate all service call sites.
2. Turn `ResourceWarning` into an error and add a connection lifecycle regression test.
3. Add the generated SPA drift check to CI and refresh the checked-in production build.
4. Verify wheel contents and packaged full-stack behavior from that same build.

### Phase 2 — Protect user data and the trust boundary

1. Require explicit opt-in for non-loopback hosting.
2. Add full-ledger backup, validation, and restore commands plus documentation.
3. Ignore SQLite WAL/SHM sidecars and add a release check for accidental ledger artifacts.

### Phase 3 — Reduce future regression cost

1. Generalize frontend feature-boundary enforcement.
2. Re-enable Hooks linting with narrow, reviewed exceptions.
3. Decompose the account, Manage, budget, and app-composition hotspots along workflow boundaries.
4. Add conservative coverage regression floors and locale-key parity validation.
5. Refresh Roadmap/current-state documentation and remove duplicated volatile counts.

## Verification performed

| Command | Result |
| --- | --- |
| `.venv/bin/python -m pytest` | 107 passed |
| `.venv/bin/python -m ruff check .` | Passed |
| `.venv/bin/python -m mypy` | Passed across 80 source files |
| Python coverage audit | 91% total; exposed 1,218 unclosed-connection warnings |
| `npm test` | 145 passed across 22 files |
| `npm run test:coverage` | 79.03% lines; 73.23% branches |
| `npm run lint` | Passed, including Stylelint and CSS architecture checks |
| `npm run format:check` | Passed |
| `npm run generate:api` | Passed; generated API type remained clean |
| `npm run build` | Passed; revealed packaged SPA drift |
| `npm run check:bundle` | Passed all JS/CSS and route budgets |
| `npm run test:e2e` | 303 passed across Chromium, Firefox, and WebKit |
| `npm run test:e2e:fullstack` | 3 passed against packaged FastAPI/SQLite application |
| `npm audit --audit-level=high` | No vulnerabilities |
| `.venv/bin/python -m pip_audit` | No known third-party vulnerabilities |

The audit intentionally did not modify the pre-existing untracked `demo.sqlite3-wal` and
`demo.sqlite3-shm` files.
