# Total Net Worth Feature Goal

> **Superseded:** This snapshot-only design documents the original net-worth milestone. Schema v3
> replaced it with the unified account activity ledger described in `docs/ARCHITECTURE.md` and
> `docs/PROJECT_PLAN.md`. It is retained as historical design evidence and is not a current command,
> API, persistence, or product contract.

## Document Status

- **Status:** Superseded historical design
- **Scope:** Asset and liability accounts, dated balance snapshots, total net worth reporting, CLI
  parity, FastAPI contracts, and a dedicated React Web UI destination
- **Target:** Python 3.14+, Node.js 24+, and Baseline 2026-capable browsers defined in `AGENTS.md`
- **Primary audience:** An implementation agent, contributors, reviewers, and portfolio visitors
- **Source of truth for:** Product intent, domain rules, public contracts, delivery phases, tests, and
  acceptance criteria for the first total net worth release
- **Architecture boundary:** The existing local-first modular monolith, one SQLite database, and one
  configured ledger currency

## Agent Mission

Implement the required work in this document as one coherent finance capability. Preserve the
project's existing transaction, budget, category-rule, recurring-template, CSV, report, chart,
localization, browser-route, security, and packaging contracts unless this document explicitly
changes one.

The feature is complete only when the same net worth rules are available through the domain and
service layers, CLI, FastAPI/OpenAPI, and React Web UI. Do not implement a browser-only balance
calculator or duplicate financial rules in adapters.

## Goal

Add a trustworthy total net worth feature that answers:

1. What are all tracked assets worth as of a selected date?
2. What is owed across all tracked liabilities as of that date?
3. What is the resulting total net worth?
4. How has that total changed over recent months?
5. Which accounts and balance updates explain the composition?

The canonical calculation is:

```text
total net worth = total assets - total liabilities
```

The current Overview uses “net position” for monthly income minus expenses. That value is cashflow,
not net worth. The implementation must rename that user-facing concept to **monthly net cashflow**
or an equivalent localized phrase wherever the two could be confused. It must never relabel monthly
cashflow as net worth.

## Why This Work Exists

The project records financial activity and monthly plans but cannot describe the user's broader
financial position. Income minus expenses answers whether a month generated or consumed cash; it
does not include savings balances, property, investments, loans, credit-card debt, or other
holdings and obligations.

A credible net worth feature therefore needs explicit balance sources. Deriving a lifetime balance
from the existing transaction table would be misleading because transactions have no source or
destination account, opening balance, transfer model, or reconciliation state.

This feature should deepen the portfolio project without turning it into a bank-sync product or
double-entry accounting system. Manual dated balance snapshots provide that balance: they support
accurate as-of totals and useful history while remaining understandable, local-first, deterministic,
and reviewable.

## Product Outcome

When this goal is complete, the user can:

1. Create an asset or liability account with an initial dated balance.
2. Record later balance snapshots without recreating prior history.
3. See total assets, total liabilities, and total net worth as of today or a past date.
4. Inspect a deterministic monthly net worth history.
5. Correct a snapshot entered for the wrong amount or date.
6. Archive a closed account without erasing its historical contribution.
7. Use the same capability from the CLI and Web UI.
8. Understand first-use, partial-history, zero, and negative-net-worth states without relying on
   color alone.
9. Keep all financial data on the local machine in the existing SQLite ledger.

For a portfolio reviewer, the result should demonstrate careful financial modeling, migration
safety, decimal-safe calculations, API contract discipline, accessible data visualization,
responsive React workflows, and full-stack test coverage.

## Approach Decision

### Option 1: Current balances only

Store one editable current balance per account.

This is the smallest implementation, but it cannot answer what net worth was on an earlier date.
Every edit destroys the previous state, making a trend chart fabricated or impossible. This option
is rejected.

### Option 2: Dated balance snapshots

Store stable account records and manually entered balances effective on specific dates. Resolve an
account's balance as of a date from its latest snapshot on or before that date.

This option is selected. It supports accurate current and historical totals without requiring
transaction-to-account links, transfer workflows, reconciliation, automated prices, or bank
connections. It fits the project's portfolio scale and explicit local-first trust model.

### Option 3: Transaction-derived account ledger

Add accounts, opening balances, transfers, reconciliation, and source/destination account links to
transactions, then derive balances from ledger activity.

This provides greater accounting depth but materially changes transaction editing, CSV contracts,
reports, migrations, and every entry surface. It is deferred to a separate documented milestone.
The snapshot model must not pretend to be or silently evolve into this option during implementation.

## Core Domain Language

### Account

An account is a user-defined source of asset or liability value.

- **Asset:** Something the user owns. Its resolved balance is added to total assets.
- **Liability:** Something the user owes. Its resolved balance is added to total liabilities and
  subtracted once when calculating net worth.
- **Active account:** An account that accepts new snapshots and appears in the default management
  list.
- **Archived account:** A closed account retained for historical calculations.

Liability balances are entered and stored as positive magnitudes. A liability balance of `2500.00`
means 2,500 units are owed. Users must not enter `-2500.00`, and the implementation must not use a
second sign inversion in storage or presentation.

### Balance snapshot

A balance snapshot records an account's non-negative balance on an effective ISO date. It is not a
transaction, valuation event, transfer, or audit-log row.

- Each account has at most one snapshot per effective date.
- Setting a balance for an existing account/date replaces that date's amount atomically.
- Earlier and later snapshots remain unchanged.
- Snapshots may be entered for today or a historical date.
- Future-dated snapshots are invalid.
- Money remains `Decimal` in Python and decimal text in SQLite and JSON.

### As-of balance

An account's balance as of date `D` is the amount from its latest snapshot whose effective date is
less than or equal to `D`.

- If no snapshot exists on or before `D`, the account has no value for that as-of calculation. It is
  omitted rather than treated as a known zero.
- A zero snapshot is an explicit known zero and remains part of the account's history.
- Snapshots after `D` never affect the result.
- Archived accounts contribute through their historical snapshots, including the closing zero
  snapshot, according to the same rule.

### Net worth summary

For an as-of date:

```text
total_assets = sum(resolved balances for asset accounts)
total_liabilities = sum(resolved balances for liability accounts)
total_net_worth = total_assets - total_liabilities
```

The summary also reports:

- `as_of`
- active and archived account counts
- resolved asset and liability account counts
- unresolved account count for accounts whose first snapshot is after `as_of`
- the configured ledger currency

An unresolved account is not an error, but the CLI and Web UI must disclose that the selected
historical total does not yet include that account.

### Monthly history

Net worth history contains a bounded sequence of as-of summaries:

- Default range: 12 points.
- Supported ranges in the first release: 6, 12, and 24 points.
- Maximum accepted API/CLI range: 120 points to keep the interface bounded and deterministic.
- The final point uses the requested `as_of` date, defaulting to the local current date.
- Earlier points use the final calendar day of each preceding month.
- Every point uses the same latest-snapshot-on-or-before-date rule.
- The sequence is chronological from oldest to newest.
- A point remains valid when there are no resolved accounts; its totals are zero and its unresolved
  count explains missing coverage.
- Change values compare the final point with the immediately preceding point. If no preceding point
  exists, the absolute and percentage changes are absent rather than fabricated.
- Percentage change is absent when the preceding net worth is zero.

All calculations are deterministic and live in the Python report/domain layer. The CLI, API, and
browser may format results but must not recalculate them independently.

## Validation and Lifecycle Rules

### Account creation

Creating an account requires:

- a trimmed, non-empty name
- type `asset` or `liability`
- an initial non-negative balance
- an initial snapshot date no later than today

Names are not globally unique because a user may legitimately track multiple accounts with the same
institution or label. The UI should suggest distinct names but the domain must not invent a
case-insensitive uniqueness rule.

Account creation and its initial snapshot form one service transaction. Neither row may remain if
the other write fails.

### Account editing

The first release allows editing the account name only. Changing an account from asset to liability
or vice versa would reinterpret all historical totals and is therefore not supported. A mistaken
type must be corrected by deleting a newly created account before meaningful history exists or by
archiving it and creating the correct account.

### Snapshot mutation

- Setting a snapshot validates account existence, active state, amount, and date.
- Archived accounts reject new or changed snapshots.
- Deleting a snapshot is allowed only when at least one other snapshot will remain.
- Deleting the sole initial snapshot is invalid because every account must retain a balance history.
- Correcting a date is represented as deleting the mistaken snapshot and setting the correct one in
  separate explicit operations; no hidden date move is required.

### Archiving and closing

Archiving an account requires a closing date no later than today and no earlier than the account's
latest snapshot date.

The archive operation:

1. Atomically sets or replaces a zero snapshot on the closing date.
2. Stores that date as `archived_on`.
3. Prevents future snapshot mutation.
4. Removes the account from default active-account lists.
5. Preserves all account and snapshot rows for historical reports.

The confirmation copy must state that closing records a zero balance. If the account still has a
non-zero balance, the user must explicitly confirm that consequence; archiving must never silently
carry a non-zero balance beyond the closing date.

Unarchiving is outside the first release. A closed account that becomes relevant again is represented
by a new account, keeping the historical closing boundary explicit.

### Hard deletion

Hard deletion is a correction tool, not ordinary lifecycle management.

- It is allowed only for an active account with exactly one snapshot.
- It removes the account and its initial snapshot in one service transaction.
- It is rejected while more than one snapshot exists and after archiving.
- The Web UI requires a destructive confirmation naming the account and explaining that the action
  cannot be undone.
- CLI deletion requires the account ID and an explicit confirmation option consistent with the
  project's existing destructive-command style.

## Persistence Contract

Increase the SQLite schema version from 1 to 2 through the existing ordered migration mechanism.
The migration must upgrade existing databases in place without rewriting or discarding transaction,
budget, rule, recurring-template, or settings rows.

Add:

```sql
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability')),
    archived_on TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE account_balance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    amount TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE (account_id, effective_date)
);

CREATE INDEX idx_accounts_type_active
ON accounts(type, archived_on);

CREATE INDEX idx_account_balance_snapshots_account_date
ON account_balance_snapshots(account_id, effective_date DESC);

CREATE INDEX idx_account_balance_snapshots_date
ON account_balance_snapshots(effective_date);
```

SQLite cannot enforce decimal syntax or “not in the future” reliably for this local application.
Models and services own those validations. Repositories use parameterized SQL and map decimal text
without converting through binary floating point.

The migration tests must cover:

- a new empty database
- an existing unversioned v1 database
- an existing database with `PRAGMA user_version = 1`
- repeated initialization
- preserved existing rows and settings
- schema-version rejection when the database is newer than supported

## Python Ownership and Dependency Direction

Follow the established capability boundaries:

- `models/` owns account types, account and snapshot domain values, validation helpers, and
  framework-free errors.
- `repositories/` owns account and snapshot SQL, row mapping, as-of lookup queries, and no commit or
  rollback behavior.
- `services/` owns complete create/edit/set/delete/archive transactions and account lifecycle rules.
- `reports/` owns deterministic net worth summary/history models and calculations.
- `cli/` and `web/` translate inputs and outputs and call public services/report functions.
- `charts/` remains the only location for matplotlib. A server-generated net worth PNG is not
  required in this release.

Do not introduce repository protocols, a dependency-injection container, an ORM, a new persistence
dependency, or framework types in the domain and service layers.

## CLI Contract

Add the following commands while preserving existing command behavior:

### `account-add`

Required options:

- `--name TEXT`
- `--type [asset|liability]`
- `--balance DECIMAL`
- `--date YYYY-MM-DD`, defaulting to today
- existing `--db-path`

Print the new account ID, type, initial amount, effective date, and active ledger currency.

### `account-list`

Options:

- `--as-of YYYY-MM-DD`, defaulting to today
- `--include-archived`
- existing `--db-path`

List account ID, name, type, resolved balance or `not tracked yet`, balance date, and archived
status. Default ordering is active before archived, asset before liability, then case-insensitive
name and ID.

### `account-edit`

Arguments/options:

- account ID
- `--name TEXT`
- existing `--db-path`

Reject an empty name and an archived or missing account.

### `account-balance-set`

Arguments/options:

- account ID
- amount
- `--date YYYY-MM-DD`, defaulting to today
- existing `--db-path`

Create or replace the snapshot and state clearly when an existing date was updated.

### `account-balance-list`

Arguments/options:

- account ID
- existing `--db-path`

List snapshots newest first with amount, effective date, and ledger currency.

### `account-balance-delete`

Arguments/options:

- account ID
- `--date YYYY-MM-DD`
- explicit destructive confirmation option
- existing `--db-path`

Reject deletion of the sole snapshot.

### `account-archive`

Arguments/options:

- account ID
- `--date YYYY-MM-DD`, defaulting to today
- explicit confirmation option
- existing `--db-path`

Report that a closing zero snapshot was recorded.

### `account-delete`

Arguments/options:

- account ID
- explicit confirmation option
- existing `--db-path`

Apply the hard-deletion rules defined above.

### `net-worth`

Options:

- `--as-of YYYY-MM-DD`, defaulting to today
- existing `--db-path`

Print total assets, total liabilities, total net worth, account coverage, and currency. Liabilities
appear as positive amounts in their own line; only the resulting net worth calculation subtracts
them.

### `net-worth-history`

Options:

- `--as-of YYYY-MM-DD`, defaulting to today
- `--months INTEGER`, defaulting to 12 and accepting 1 through 120
- existing `--db-path`

Print chronological as-of date, assets, liabilities, and net worth columns. Include a concise final
change summary when a comparison point exists.

Expected user-facing failures use project exceptions and normal CLI error translation. Invalid
dates, future dates, negative amounts, missing accounts, archived mutations, protected deletions,
and unsupported ranges must not produce tracebacks in ordinary use.

## FastAPI and OpenAPI Contract

Add schemas under the account/net-worth capability and expose decimal amounts as strings.
FastAPI's generated OpenAPI remains the wire-contract source.

### Account schemas

`AccountCreateRequest`

```text
name: string
type: "asset" | "liability"
initial_balance: decimal string
initial_balance_date: ISO date
```

`AccountPatchRequest`

```text
name: optional string
```

`AccountResponse`

```text
id: integer
name: string
type: "asset" | "liability"
archived_on: ISO date or null
created_at: timestamp string
as_of: ISO date
resolved_balance: decimal string or null
resolved_balance_date: ISO date or null
currency: string
```

`AccountMutationResponse` contains `notice`, `notice_code`, and the account, following the existing
mutation-response convention.

### Snapshot schemas

`BalanceSnapshotRequest`

```text
amount: decimal string
```

The effective date is the path value so replacement semantics are explicit.

`BalanceSnapshotResponse`

```text
id: integer
account_id: integer
amount: decimal string
effective_date: ISO date
created_at: timestamp string
updated_at: timestamp string
currency: string
```

`BalanceSnapshotMutationResponse` contains `notice`, `notice_code`, and the snapshot.

`AccountArchiveRequest`

```text
closing_date: ISO date
confirm_zero_balance: boolean
```

The service requires `confirm_zero_balance=true`; this makes the closing-zero consequence explicit
for CLI and HTTP callers rather than trusting a browser-only confirmation.

### Net worth schemas

`NetWorthSummaryResponse`

```text
as_of: ISO date
total_assets: decimal string
total_liabilities: decimal string
total_net_worth: decimal string
active_account_count: integer
archived_account_count: integer
resolved_asset_count: integer
resolved_liability_count: integer
unresolved_account_count: integer
currency: string
```

`NetWorthHistoryPointResponse` contains `as_of`, the three total decimal strings, resolved counts,
and unresolved count.

`NetWorthHistoryResponse` contains:

```text
as_of: ISO date
months: integer
points: chronological list of NetWorthHistoryPointResponse
change_amount: decimal string or null
change_percent: decimal string or null
currency: string
```

### Endpoints

- `GET /api/accounts?as_of=YYYY-MM-DD&include_archived=false`
- `POST /api/accounts`
- `PATCH /api/accounts/{account_id}`
- `DELETE /api/accounts/{account_id}?confirm=true`
- `POST /api/accounts/{account_id}/archive`
- `GET /api/accounts/{account_id}/balance-snapshots`
- `PUT /api/accounts/{account_id}/balance-snapshots/{effective_date}`
- `DELETE /api/accounts/{account_id}/balance-snapshots/{effective_date}?confirm=true`
- `GET /api/net-worth?as_of=YYYY-MM-DD`
- `GET /api/net-worth/history?as_of=YYYY-MM-DD&months=12`

Account and snapshot list endpoints return named list envelopes rather than bare arrays. Archive
requests use `AccountArchiveRequest`. Delete endpoints reject requests unless `confirm=true`; service
eligibility rules still apply. Do not depend on a browser-only confirmation for service safety.

Validation failures use the existing structured API error envelope and field mapping. Financial
responses retain `Cache-Control: no-store` and the existing security middleware.

After changing schemas, run `npm run generate:api` and use the generated types through
`frontend/src/types.ts`. Do not hand-edit `frontend/src/generated/api.ts`. Only
`frontend/src/api/client.ts` may call `fetch`.

## Dashboard Aggregate Contract

Extend `DashboardResponse` with:

```text
net_worth: NetWorthSummaryResponse
```

The dashboard net worth date is today, independent of the selected cashflow month. This distinction
must be visible in copy such as “Net worth as of July 16, 2026.” Changing the Overview month must
not make today's net worth appear to be a monthly cashflow metric.

The Overview summary:

- appears after the primary monthly cashflow story
- shows current net worth, assets, and liabilities without repeating the full account list
- links to `/net-worth`
- presents a first-use action when no accounts exist
- discloses unresolved coverage if applicable
- does not add account mutation forms to Overview

## Web Information Architecture

Add a fifth top-level destination:

| Destination | Route           | Purpose                                                                     | Primary action    |
| ----------- | --------------- | --------------------------------------------------------------------------- | ----------------- |
| Overview    | `/`             | Monthly cashflow, attention, recent activity, and compact current net worth | Add transaction   |
| Net worth   | `/net-worth`    | Current/historical wealth position and account balances                     | Add account       |
| Activity    | `/transactions` | Transaction search, CRUD, import, and export                                | Add transaction   |
| Plan        | `/budgets`      | Planned versus actual spending                                              | Set budget        |
| Automations | `/rules`        | Categories, recurring entries, and preferences                              | Context-dependent |

Place Net worth after Overview in the stable route order. Load the Net Worth feature lazily.
Navigation, browser history, deep links, modified clicks, route titles, not-found behavior, route
focus, English, and Turkish labels must all include the new destination.

The compact bottom navigation may use the visible short label **Worth** where required for reflow,
but its accessible name and page heading remain **Net worth**. Five destinations must retain the
existing minimum touch targets and must not horizontally scroll, clip labels at 200% text size, or
cover the last account row.

## Net Worth Route Experience

The route answers three questions in this order:

1. **Current position:** What is total net worth as of the selected date?
2. **Composition:** Which assets and liabilities make up that amount?
3. **Change:** How has the total moved over the selected history range?

### Page context and controls

- Default `as_of` is today and is omitted from the URL.
- A historical selection is deep-linked as `?as_of=YYYY-MM-DD`.
- History range is deep-linked as `months=6`, `months=12`, or `months=24`, with 12 as the default.
- Use a visible native date input with `max` set to today. It requires a persistent label and
  localized explanatory text; a placeholder is not a label.
- Invalid URL values fall back to safe defaults and do not crash the route.
- Date or range changes keep the last successful data visible, expose a restrained pending state,
  cancel obsolete requests, and commit only the newest response.

### Primary summary

Present total assets, total liabilities, and net worth as one semantic `<dl>` composition.

- Net worth is the dominant value.
- Assets and liabilities explain the calculation directly.
- Negative net worth uses a sign, label, and textual explanation in addition to color.
- Zero net worth has neutral language.
- Values use tabular numerals and the existing locale-aware currency formatter.
- The selected as-of date and data-coverage status are adjacent to the summary.
- Do not create three unrelated KPI cards or shame-oriented copy.

### Composition

Show active accounts grouped under semantic Asset and Liability headings.

Each row exposes:

- name
- type
- resolved amount
- effective date of the resolved snapshot
- a clear unresolved state when no snapshot exists by the selected as-of date
- actions appropriate to the account state

The visual composition may use responsive lists on compact layouts and a semantic table on wider
layouts. If a table is used, include a `<caption>`, column headers, and row headers. Do not use a
table solely for page layout.

Archived accounts are hidden by default behind a labeled control. When shown, they remain visually
and textually marked as archived without relying on reduced opacity alone.

### History

Provide an inline SVG net worth history chart without adding a chart dependency.

- Wrap it in `<figure>` with a visible heading or caption and a concise textual trend summary.
- Plot one net worth series. Asset and liability totals remain available in the data table rather
  than adding three competing chart lines in the first release.
- Handle positive, zero, and negative domains, including a visible zero reference when the domain
  crosses zero.
- Give pointer, keyboard, and touch users equivalent point inspection.
- Any interactive SVG point is a real focus target with an accessible name containing date and
  value.
- Provide a semantic table alternative containing date, assets, liabilities, and net worth for every
  point.
- Tooltip content is supplementary; no value may exist only on hover.
- Color is not the sole indicator of positive/negative direction.
- Extreme and identical values must not create invalid geometry, clipped labels, or `NaN` output.

### First-use and empty states

If no accounts exist:

- explain the difference between monthly cashflow and net worth
- state that balances are entered manually and remain local
- provide one Add account action
- do not render an empty chart frame or zero total that implies tracked coverage

If accounts exist but none resolve for a historical as-of date:

- state that tracked accounts begin after the selected date
- preserve the date control and account context
- avoid presenting zero as a known complete total

If only assets or only liabilities exist, present the valid partial composition without suggesting
the missing side is an error.

## Account Workflows

Use the project's native `<dialog>` foundation for modal forms. Do not add a custom focus trap or
modal library.

### Add account

The form contains:

- account name
- asset/liability choice using a native radio group or select with an explicit label
- initial balance
- effective date defaulting to today
- concise explanation that liability amounts are entered as positive amounts owed

On success, close the dialog, restore focus predictably, announce the result through the shared
polite status mechanism, refresh summary/history/accounts together, and avoid optimistic totals.

### Update balance

Open from an account row. Show the account name and type as context. The date defaults to today and
the amount field is not silently prefilled from a historical snapshot as though the user were
editing that snapshot. If the chosen date already exists, disclose that saving will replace it.

### View and correct history

Expose a progressively disclosed snapshot history ordered newest first. Users can:

- inspect amount and effective date
- replace an amount by selecting that dated row
- delete a non-sole snapshot through explicit confirmation

The workflow must distinguish “update this date” from “record today's balance.”

### Edit name

Editing a name does not alter snapshots or reports. Account type is visible but not editable.

### Archive

The archive dialog names the account, explains the final zero snapshot, requires a closing date, and
requires explicit confirmation. A non-zero latest balance receives stronger explanatory copy but no
shame-oriented warning.

### Delete

The delete action appears only when the account is eligible for hard deletion. The confirmation
names the account and initial snapshot and explains that deletion is permanent. Service validation
still enforces eligibility if the UI is stale.

## Frontend State and Data Flow

Create a self-contained feature under `frontend/src/features/net-worth/`. It may import `api/` and
`shared/` but no other feature.

Use the existing custom resource and mutation patterns:

- abort requests on parameter changes and unmount
- ignore stale responses
- retain last successful data during refresh
- prevent duplicate submissions
- avoid automatic retries and background revalidation
- refresh the summary, account list, history, and dashboard-visible data after mutations through
  explicit invalidation owned by app/feature composition
- normalize field and global errors through existing API error utilities

Do not add a server-state library, global account cache, optimistic accounting update, or a second
`fetch` call site.

## Responsive and Modern Web Requirements

The route must be designed as a component-responsive workspace rather than a compressed desktop
table.

- Use the existing page/container architecture and container queries for summary, account
  composition, and chart layout.
- Use constrained `clamp()` values with relative units for type and spacing; do not make text scale
  solely from viewport width.
- Keep body and input text at least `1rem`.
- Support narrow phones, landscape phones, tablet/narrow desktop, and wide desktop.
- Support 200% text sizing and 400% browser zoom/reflow without two-dimensional page scrolling.
- Keep touch targets at least as large as the existing project token.
- Logical reading and tab order must match; CSS reordering must not create a different keyboard
  sequence.
- Use native HTML before ARIA. Add ARIA only when the behavior requires it.
- Core navigation, reading, forms, account mutation, and chart-table access must work without View
  Transitions or optional motion.
- Container queries are permitted under the Baseline 2026 policy. Do not add a polyfill.

## Accessibility Quality Bar

- Use sequential headings and existing page landmarks.
- Every form control has a persistent visible label and associated hint/error text.
- Dialogs use native modal behavior, Escape handling, correct initial focus, and focus restoration.
- Mutations announce success through the shared polite region; blocking errors use the existing
  visible error treatment without noisy loading announcements.
- Keyboard users can reach every action, inspect every chart point, open the data table, and dismiss
  transient content without a trap.
- Pointer, keyboard, and touch users receive equivalent financial information.
- Positive, negative, archived, unresolved, and destructive states use text/sign/icon/structure in
  addition to color.
- Text meets 4.5:1 contrast; focus, control boundaries, and chart indicators meet applicable 3:1
  non-text contrast.
- Forced-colors mode preserves boundaries, focus, chart series, selected points, and zero reference.
- Light and dark themes use semantic tokens and retain chart and status contrast.
- English and Turkish copy, dates, amounts, account names, and long values reflow without clipping.
- Reduced motion removes rolling, directional, or scaling effects while preserving state clarity.
- The chart's semantic table is complete and usable independently of the SVG.

Automated accessibility scans are necessary but not sufficient. Manually verify keyboard-only use,
VoiceOver with Safari, and at least one additional screen-reader/browser pairing.

## Motion Requirements

Motion is optional polish and must explain state.

- Reuse existing motion tokens and progressive View Transition coordination where appropriate.
- Do not animate the first render as a staged dashboard entrance.
- Balance changes may use the existing rolling-number behavior only if one static accessible value
  remains exposed.
- History-point changes may interpolate transform/opacity without blocking data commits.
- Dialog entry/exit follows the existing native top-layer treatment.
- No ambient animation, parallax, scroll reveal, spring physics, confetti, or auto-running carousel.
- `prefers-reduced-motion: reduce` removes spatial travel, rolling, scaling, and chart interpolation.
- Motion must not delay focus, form submission, navigation, or rapid repeated input.

## Performance and Bundle Requirements

- Do not add a chart, form, date, animation, or state-management dependency.
- Lazy-load the Net Worth route so it does not increase the initial route's JavaScript work beyond
  normal navigation metadata and dashboard summary rendering.
- Stay within the checked bundle budgets: initial CSS 12 KiB gzip, each lazy CSS chunk 7 KiB gzip,
  cumulative lazy CSS for every route 8 KiB gzip, and aggregate CSS 30 KiB gzip.
- Do not raise a bundle limit to make the feature pass without measured evidence and a documented
  architecture decision.
- Keep calculations server-side and queries bounded. Avoid one SQL query per account per history
  point; repository/report input should load the needed account/snapshot data in a bounded set and
  calculate deterministically in memory.
- Reserve stable summary and chart geometry to prevent avoidable layout shift.
- Keep route controls interactive while retained data refreshes.
- Measure the production build and existing Web Vitals workflow after implementation.

## Localization and Content

Add complete English and Turkish translations for:

- navigation and page titles
- asset/liability terminology
- current, historical, zero, negative, unresolved, archived, and first-use states
- account and snapshot forms
- validation and confirmation text
- chart labels, summaries, tooltips, and table captions
- mutation notices and API error mappings

Continue using the configured ledger currency and existing locale-aware formatting. Account names
are user content and are never translated. Keep language neutral and factual; the feature reports
balances and changes but does not characterize the user's financial health or provide advice.

## Delivery Plan

### Phase 1: Domain, persistence, reports, and CLI

- Add the version 2 migration and upgrade coverage.
- Add account/snapshot models, repositories, services, lifecycle validation, and deterministic net
  worth report models/calculations.
- Add all CLI commands and user-facing error behavior.
- Add focused database, domain, repository, service, report, and CLI tests.

**Exit gate:** Fresh and existing databases upgrade safely; CLI users can complete the full account,
snapshot, archive, delete, summary, and history workflows with decimal-safe results.

### Phase 2: FastAPI, OpenAPI, and dashboard aggregation

- Add schemas, routers, dependency construction, response mapping, and structured errors.
- Add account, snapshot, net worth summary, and history endpoints.
- Extend the dashboard response with today's compact net worth summary.
- Regenerate checked-in TypeScript API types and add adapter-contract tests.

**Exit gate:** HTTP behavior matches the domain and CLI, generated contracts have no drift, financial
responses remain `no-store`, and existing API operations remain compatible.

### Phase 3: React route, workflows, chart, and accessibility

- Add lazy route composition, navigation, titles, deep links, route focus, and localization.
- Add summary, composition, history chart/table, first-use, loading, retained-data, partial,
  negative, archived, validation, and error states.
- Add account, balance, history-correction, archive, and eligible-delete dialogs.
- Add unit, integration, accessibility, responsive, and Playwright coverage.
- Confirm bundle, CSS architecture, reduced-motion, forced-colors, zoom/reflow, and input parity.

**Exit gate:** The route works across required viewports, inputs, themes, locales, and accessibility
settings without duplicating financial rules or adding dependencies.

### Phase 4: Demo, documentation, packaged assets, and release evidence

- Extend generated demo data with clearly fictional asset and liability snapshots spanning enough
  months to demonstrate positive or negative changes without implying investment advice.
- Update `README.md`, `docs/USAGE.md`, `docs/PROJECT_PLAN.md`, `docs/ARCHITECTURE.md`, `ROADMAP.md`,
  and release checklist material.
- Refresh static showcase copy, reviewer screenshots, and packaged SPA assets.
- Record migration, test, accessibility, performance, bundle, package, and full-stack evidence in a
  focused release document.
- Run the complete repository and package verification set.

**Exit gate:** Documentation, demo data, screenshots, static showcase, generated contracts, packaged
assets, and release evidence all describe the same shipped feature.

## Test Matrix

### Database and migration

- Fresh schema contains both new tables, constraints, indexes, default settings, and version 2.
- Unversioned and version 1 databases upgrade without data loss.
- Repeated initialization is idempotent.
- Foreign-key cascade runs only through eligible hard deletion.
- A newer unsupported schema version is rejected.

### Domain and reports

- Assets minus liabilities produces positive, zero, and negative totals.
- Liability magnitudes are subtracted exactly once.
- Decimal precision is preserved for fractional and large values.
- Same-day snapshot replacement affects only that date and later as-of calculations.
- Date boundaries select the latest snapshot on or before the date.
- Future dates and negative amounts fail.
- Accounts with no earlier snapshot are unresolved, not known zero.
- Explicit zero snapshots resolve as zero.
- Archived accounts contribute before closing and zero from closing onward.
- Monthly history uses month ends and the requested final date.
- Percentage change is absent for a zero prior total.
- One-point history has no fabricated change.

### Repository and services

- Create account plus initial snapshot commits or rolls back together.
- Snapshot upsert reports create versus replacement correctly.
- Archived accounts reject mutation.
- Archive plus closing zero commits or rolls back together.
- Sole-snapshot deletion, ineligible account deletion, invalid archive date, and missing account fail
  without partial writes.
- Ordering and include-archived filtering are deterministic.

### CLI and HTTP

- Every command and endpoint covers success, invalid input, missing account, archived state,
  confirmation requirements, and protected deletion.
- Decimal amounts are text in SQLite/JSON and correctly formatted at the CLI boundary.
- API field errors map to the relevant form field.
- As-of and range defaults match across CLI and HTTP.
- Security headers, `no-store`, app fallback, and existing endpoints remain unchanged.
- OpenAPI generation is reproducible and checked-in types remain current.

### React and chart

- First-use, populated, only-assets, only-liabilities, zero, negative, unresolved historical,
  archived, loading, retained-data, validation-error, mutation-error, fetch-error, and retry states.
- Request cancellation, stale-response guards, duplicate-submit prevention, and explicit refresh.
- Dialog initial focus, Escape, submit, cancellation, error focus, and trigger focus restoration.
- Chart geometry for all-positive, all-negative, crossing-zero, identical, extreme, one-point, and
  empty data.
- Pointer, keyboard, and touch point inspection expose the same value.
- Chart table values exactly match the visual data.
- English/Turkish and active currency formatting.

### Playwright and accessibility

- Wide desktop, tablet/narrow desktop, compact phone, and landscape phone.
- Keyboard-only navigation and all account workflows.
- Coarse touch behavior and minimum target sizing.
- Browser history, deep links, route focus, not-found recovery, and five-item navigation.
- Light, dark, system, forced colors, default motion, and reduced motion.
- 200% text size and 400% zoom/reflow.
- Automated axe scans on the route and every dialog state in both themes.
- Full-stack account creation, snapshot update, historical report, archive, and persisted reload
  against FastAPI and SQLite.

## Verification Commands

Run focused checks while implementing, then all applicable repository checks:

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
npm run test:e2e
npm run test:e2e:fullstack
.venv/bin/python -m build
```

Use `docs/RELEASE_CHECKLIST.md` for demo, audit, package, screenshot, showcase, and generated-asset
verification. If a command cannot run, record the exact command and reason.

## Definition of Done

The total net worth feature is complete only when:

- Total assets, liabilities, and net worth follow the documented as-of rules in every interface.
- Monthly cashflow is clearly distinguished from net worth.
- Existing databases upgrade to schema version 2 without losing data.
- Account creation always includes an initial snapshot.
- Snapshot correction, archive, and hard-deletion safeguards preserve historical integrity.
- CLI and Web UI provide equivalent core workflows through the same services and reports.
- FastAPI/OpenAPI decimal and error contracts are generated, tested, and current.
- Overview contains a concise current summary and `/net-worth` contains complete management and
  history.
- The history SVG and semantic table expose equivalent information.
- Core workflows pass keyboard, touch, screen-reader, localization, theme, forced-colors,
  reduced-motion, and zoom/reflow verification.
- Existing bundle budgets pass without a new production dependency.
- Full-stack E2E proves data persists through SQLite and reload.
- README, usage, architecture, roadmap, demo, screenshots, static showcase, packaged SPA assets, and
  release evidence match the shipped behavior.
- The final diff contains no unrelated changes.

## Non-Goals

This goal does not authorize:

- Linking existing or future transactions to accounts.
- Transfers, reconciliation, opening-balance journals, or double-entry bookkeeping.
- Mixed-currency accounts or per-snapshot currency fields.
- Exchange-rate lookup or automated conversion.
- Brokerage connections, bank imports, open-banking integrations, or credential storage.
- Automated securities, property, vehicle, cryptocurrency, or commodity pricing.
- Lot tracking, cost basis, gains, returns, dividends, interest accrual, amortization, or payoff
  schedules.
- Forecasting, retirement projections, financial-health scores, recommendations, or advice.
- Shared accounts, authentication, cloud sync, remote databases, background workers, telemetry, or
  notifications.
- A charting, form, date, state-management, ORM, or animation dependency.
- A server-generated net worth PNG or new account/snapshot CSV format in the first release.
- Unarchiving or merging accounts.
- Redesigning unrelated routes beyond the navigation addition, cashflow terminology correction, and
  compact Overview summary required by this feature.

## Explicit Defaults

These decisions are fixed for the first release:

1. Dated manual balance snapshots are the source of net worth.
2. Every account uses the existing configured ledger currency.
3. Liability balances are stored as positive amounts owed.
4. Account type cannot change after creation.
5. Account creation requires an initial snapshot.
6. Snapshot dates may be historical or today but never future.
7. The latest snapshot on or before an as-of date determines the balance.
8. Closing records a final zero snapshot and archives the account.
9. Hard deletion is limited to active accounts with exactly one snapshot.
10. History defaults to 12 points, supports 6/12/24 in the Web UI, and accepts at most 120 through
    CLI/API.
11. The final history point uses the requested as-of date; preceding points use month ends.
12. `/net-worth` is a lazy-loaded top-level destination after Overview.
13. Overview shows today's compact net worth summary regardless of its selected cashflow month.
14. Existing transactions and budgets are not retroactively assigned to accounts.
15. No production dependency or bundle-budget increase is expected.
