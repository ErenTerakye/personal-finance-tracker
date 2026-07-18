# Project Audit — 2026-07-18

## Executive summary

Personal Finance Tracker is a strong portfolio-scale local application. Its backend layers are
clear, its core financial calculations use `Decimal`, migrations and transaction boundaries have
focused tests, FastAPI drives generated TypeScript contracts, the packaged SPA is reproducible, and
the browser suite covers accessibility and responsive behavior across three engines.

The audit also prompted substantial hardening that is now present on `main`: SQLite connections are
closed deterministically, generated API and SPA drift fails CI, non-loopback hosting requires
explicit opt-in, quality gates include warnings and coverage, frontend feature boundaries are
checked generically, and complete-ledger recovery commands were added.

Post-remediation validation originally found one release-blocking defect in that new recovery workflow:
`ledger-verify` accepts a structurally invalid SQLite file based only on integrity and
`user_version`, and `ledger-restore` can replace the active ledger with it before migration fails.
The follow-up remediation in this working tree closes that defect and the remaining contract,
precision, maintainability, and release-hygiene findings. The evidence below retains the original
failure descriptions so the reason for each change remains reviewable.

## Current risk register

| Priority | Finding | Status |
| --- | --- | --- |
| P0 | Restore can replace the active ledger with a structurally invalid database | Fixed and regression-gated |
| P1 | The documented CSS bundle contract does not match the executable gate | Fixed at 32 KiB gzip |
| P2 | Browser-side financial arithmetic loses decimal precision at high values | Fixed with an explicit range and integer-cent helpers |
| P2 | Several frontend route and stylesheet modules remain responsibility hotspots | Stable workflow seams extracted |
| P2 | Local generation commands leave avoidable environment/worktree friction | Fixed and re-verified |
| Resolved | SQLite connection leak | Fixed and regression-gated |
| Resolved | Packaged SPA drift not detected by CI | Fixed and verified |
| Resolved | Accidental unauthenticated non-loopback hosting | Fixed and tested |
| Resolved | Frontend dependency and Hooks lint gaps | Fixed and checked |
| Resolved | Coverage, warning, and repository-sidecar gaps | Fixed and checked |

## Scope and method

The audit treated the repository as both a local-first finance product and a public portfolio
artifact. It reviewed:

- domain models, services, repositories, SQLite connection behavior, schema, and migrations;
- CLI, FastAPI routers and schemas, error translation, hosting behavior, and security headers;
- CSV, report, chart, account-history, backup, verification, and restore workflows;
- React composition, API transport, resource and mutation hooks, forms, dialogs, charts, i18n,
  styling, accessibility, responsive behavior, and bundle controls;
- unit, integration, architecture, browser, packaged full-stack, coverage, packaging, generated
  artifacts, and dependency checks;
- README, Usage, Architecture, Roadmap, Project Plan, and release documentation.

The frontend review used the repository's Baseline 2026 policy and current accessibility, form, and
deferred-rendering guidance. The audit did not include a manual screen-reader session, destructive
testing against a real user ledger, a multi-hour concurrency soak, or a non-loopback penetration
test.

## Remediated findings

### P0 — Restore trusts version metadata without validating the ledger schema

**Evidence**

- `LedgerRecoveryService.verify()` checks that the file is readable, `PRAGMA integrity_check`
  returns `ok`, and `PRAGMA user_version` is between 1 and the current version.
- It does not verify required tables, columns, indexes, foreign keys, or an application-owned schema
  signature before declaring the file a valid ledger.
- `restore()` verifies the source, copies it to a temporary file, verifies that copy with the same
  incomplete checks, and then replaces the active database. Only after replacement does it call
  `initialize_database()`.
- A valid empty SQLite database stamped with `PRAGMA user_version = 1` is accepted by
  `ledger-verify`. Restoring it replaces the active ledger and then fails with
  `sqlite3.OperationalError: no such table: settings` while attempting the v2 migration.
- The existing recovery tests cover a complete current backup, corrupt bytes, an unsupported future
  version, and CLI confirmation. They do not cover structurally incomplete or falsely versioned
  databases.

**Impact**

The command intended to protect user data can destroy the active ledger after reporting the source
as verified. `--confirm` protects against accidental invocation, but it cannot make an invalid
backup safe. This is release-blocking because the README and Usage documentation now advertise
complete-ledger recovery as a supported ownership feature.

**Recommended change**

Prepare the restore completely before touching the active path:

1. copy the backup into a temporary database in the active ledger's directory;
2. validate a version-specific schema manifest, including required tables and critical columns;
3. run all required migrations against that temporary database;
4. run `integrity_check`, `foreign_key_check`, and the current schema-contract check on the migrated
   temporary database;
5. close every handle, then atomically replace the active file only after every step succeeds.

Return the final migrated schema version, not the source version. Add a regression test using an
integrity-clean but structurally incomplete v1 file and prove both that restore is rejected and that
the original active ledger remains readable and unchanged. Also test a genuine v1 backup through
migration and a current-version database with a missing required table.

**Acceptance criteria**

- No rejected backup can mutate or replace the active ledger.
- Verification proves application compatibility, not just SQLite file integrity.
- A valid older backup is migrated and re-verified before replacement.
- The reported schema version describes the restored active ledger.

### P1 — Architecture documentation and the CSS budget gate disagree

**Evidence**

- `docs/ARCHITECTURE.md`, the declared architecture source of truth, says total production CSS is
  capped at **32 KiB gzip** and records a **23.70 KiB** baseline.
- `scripts/check_bundle.mjs` actually permits **40 KiB gzip** total CSS.
- The audited build contains **30.18 KiB gzip** total CSS, with the Accounts route at **6.93 KiB of
  its 8 KiB route budget** and initial CSS at **8.29 KiB of 12 KiB**.
- The current output passes both the documented 32 KiB total and the executable 40 KiB limit, so
  this is not a present budget failure. It is a contract failure: future growth between 32 and 40
  KiB would pass CI contrary to the architecture document.

**Impact**

Reviewers cannot tell which limit is intentional, and a budget increase can occur without the
measured rationale the architecture document itself requires. The stale baseline also hides that
aggregate CSS grew by roughly 27% from the documented figure.

**Recommended change**

Choose one limit and make the script, Architecture, release checklist, and release evidence agree.
If 40 KiB is intentional, record why the ceiling changed, the current 30.18 KiB baseline, and the
remaining headroom. If 32 KiB remains the intended contract, lower the executable gate. Treat the
Accounts and Overview route CSS utilization as an optimization signal rather than splitting files
solely to satisfy line counts.

### P2 — Browser-side arithmetic weakens the decimal-safe money contract

**Evidence**

- The backend accepts and preserves `Decimal` values as decimal text in SQLite and JSON.
- The frontend converts those strings to binary `Number` in `shared/format/money.ts`, daily activity
  totals, budget aggregates, chart geometry, balance comparisons, and other derived display values.
- The backend accepts `90071992547409.91` exactly, while JavaScript converts it to
  `90071992547409.9` and formats it as `$90,071,992,547,409.90`, losing one cent.
- Normal household-scale values are unaffected, and authoritative reports remain calculated in
  Python with `Decimal`.

**Impact**

The UI can display or derive a value different from the stored ledger for sufficiently large
amounts. This is an edge case for the current product scale, but it contradicts an otherwise strong
decimal-text wire contract and could become more relevant for high-inflation currencies or large
asset portfolios.

**Recommended change**

Define an explicit supported amount range. Either reject values beyond the largest cent-exact
JavaScript-safe amount at the domain boundary, or add small string/decimal helpers for browser-side
addition, comparison, and formatting without introducing a broad state or finance dependency.
Whichever policy is chosen, test the same boundary through model, API, and browser formatting.

### P2 — Responsibility remains concentrated in frontend hotspots

**Evidence**

- The audit remediation successfully reduced `NetWorthView.tsx` from 1,303 lines to 299 and
  `WealthOverview.tsx` from 1,003 lines to 564 by extracting account lifecycle, balance check-in,
  and trend-explorer workflows.
- Remaining large workflow modules include `ManageView.tsx` (989 lines), `BudgetsView.tsx` (868),
  and `app/App.tsx` (851).
- Large style surfaces include `net-worth.css` (1,993 lines), `dashboard-components.css` (1,422),
  and `budgets.css` (1,189).
- The English and Turkish locale dictionaries are approximately 840 lines each. Type-level parity
  now protects their structure, but additions still require coordinated review across large files.

Line count is not itself a defect, and arbitrary size gates would work against the repository's
architecture. Here it is a change-coupling signal: navigation state, route preparation, dialogs,
data orchestration, and several independent Manage or budget workflows still share broad review
surfaces.

**Recommended change**

Continue extracting only stable workflow seams: Manage section owners, budget inspector/form
orchestration, and route-state/history coordination are the clearest candidates. Keep feature-local
components local, preserve the feature dependency rule, and avoid creating generic components that
only hide line count.

### P2 — Local quality commands have avoidable hygiene friction

**Evidence**

- `npm run check:generated` calls `python3`; it failed outside an activated virtual environment
  because FastAPI was unavailable, then passed when `.venv/bin` was placed first on `PATH`. The
  documentation does instruct contributors to activate the environment, so behavior is documented
  but not self-diagnosing.
- `npm run test:coverage` creates `frontend/coverage/`, which is not ignored and makes a clean
  worktree appear dirty after running a documented release command.
- Vitest emits an `ExperimentalWarning` about unavailable localStorage during both unit and coverage
  runs even though tests pass.

**Recommended change**

Ignore the generated coverage directory, or direct coverage output to an already ignored build
location. Make OpenAPI generation fail with an actionable environment message or allow an explicit
Python executable override. Remove or document the benign Vitest warning so real warning regressions
remain visible.

## Hardening completed during the audit

The following original findings were resolved and revalidated:

- **Connection ownership:** the database now owns a close-safe transaction context, service call
  sites use it, `ResourceWarning` is an error, and a repeated-operation descriptor test passes.
- **Packaged SPA truth:** `npm run check:generated` regenerates OpenAPI types and the production SPA,
  runs bundle checks, and rejects tracked or untracked drift. CI builds the wheel from that output.
- **Hosting trust boundary:** non-loopback hosts are rejected unless
  `--allow-remote-unauthenticated` is supplied; IPv4, IPv6, and hostname behavior is tested.
- **Recovery capability:** WAL-aware complete-ledger backup, verification, confirmation, and restore
  commands now exist and preserve all domains for a valid current backup. The P0 finding above must
  be closed before treating restore validation as complete.
- **Frontend enforcement:** a generic architecture script prevents cross-feature imports; Hooks
  rules are re-enabled; `any` exceptions are scoped to tests; locale dictionaries have typed parity.
- **Quality gates:** Python and frontend coverage floors are in CI, Python resource warnings fail,
  and dependency, lint, formatting, CSS architecture, generated-contract, bundle, browser, and
  package checks remain in the release workflow.
- **Repository hygiene:** SQLite WAL and SHM sidecars are ignored, and volatile test counts and stale
  route language were removed from the Roadmap.

## Areas that are already strong

- **Layering:** adapters, services, repositories, models, CSV, reports, and charts have clear owners;
  architecture tests enforce the important dependency directions.
- **Transaction semantics:** services own commits and rollbacks, repositories do neither, and
  atomic account and recurring workflows have focused regression coverage.
- **Financial storage:** Python calculations use `Decimal`; money is serialized and stored as text;
  dates use ISO text; reports are deterministic.
- **API contracts:** FastAPI OpenAPI drives generated TypeScript types, request schemas reject extra
  fields, API errors are normalized, and CSV bodies are size- and encoding-bounded.
- **Local security posture:** loopback is the default; remote exposure requires explicit opt-in;
  API responses are `no-store`; CSP, `nosniff`, referrer, permission, and frame protections are
  present; npm and Python advisory audits were clean.
- **Accessibility:** semantic landmarks, native dialogs, keyboard workflows, focus restoration,
  forced colors, 200% text reflow, reduced motion, chart data alternatives, and automated axe checks
  are exercised across Chromium, Firefox, and WebKit.
- **Responsive behavior:** browser tests cover 320px through 1920px and multiple interaction modes.
- **Performance discipline:** route splitting and gzip budgets are executable; every current JS,
  CSS, and route budget passed.
- **Delivery:** the sdist and wheel build successfully with the packaged SPA, and real React,
  FastAPI, and SQLite read/write workflows pass in the full-stack browser suite.

## Recommended implementation order

1. Fix restore validation and prove rejected backups cannot change the active ledger.
2. Reconcile the CSS architecture contract with the executable budget and current measurements.
3. Choose and test an explicit high-value money policy for the browser boundary.
4. Remove coverage/environment warning friction from the documented local check sequence.
5. Continue hotspot extraction only when feature work touches a stable workflow seam.
6. Before release, add a manual screen-reader pass and a disposable backup/restore rehearsal using a
   genuine migrated v1 ledger.

## Verification performed

| Command or check | Result |
| --- | --- |
| `.venv/bin/python -m pytest --cov=finance_tracker --cov-fail-under=90` | 122 passed; 91.07% coverage; resource-warning gate active |
| `.venv/bin/python -m ruff check .` | Passed |
| `.venv/bin/python -m mypy` | Passed across 82 source files |
| `npm test` | 145 passed across 22 files |
| `npm run test:coverage` | Passed thresholds; 79.03% lines, 73.29% branches, 71.76% functions |
| `npm run lint` | Passed ESLint, feature architecture, Stylelint, and CSS architecture checks |
| `npm run format:check` | Passed |
| `npm run check:generated` with the documented virtual environment active | Generated API and packaged SPA matched source |
| `npm run check:bundle` | Passed; 89.34 KiB initial JS, 8.29 KiB initial CSS, 30.18 KiB total CSS |
| `npm run test:e2e` | 303 passed across Chromium, Firefox, and WebKit |
| `npm run test:e2e:fullstack` | 3 passed against packaged FastAPI and SQLite |
| `npm audit --audit-level=high` | No vulnerabilities |
| `.venv/bin/python -m pip_audit` | No known third-party vulnerabilities |
| `.venv/bin/python -m build` | sdist and wheel built successfully with packaged SPA assets |
| Targeted invalid-restore probe | Reproduced P0: integrity-clean fake v1 accepted, active replacement attempted, migration failed |

## Audit limitations

Automated checks cannot establish full usability or operational resilience. Release confidence would
benefit from a manual screen-reader session, keyboard-only use with real data density, a long-running
Web/API descriptor and concurrency soak, restore interruption testing, and a restore rehearsal on
copies of realistic older ledgers. None of those tests should use a user's only ledger copy.
