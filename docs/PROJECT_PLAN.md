# Project Plan

## Product scope

Personal Finance Tracker remains a portfolio-scale, single-user, local-first application. It
demonstrates a layered Python domain, SQLite persistence, Typer and Textual terminal adapters,
FastAPI/OpenAPI, React, CSV portability, deterministic reports/charts, recovery workflows, tests,
and reviewable documentation.

Authentication, cloud/bank sync, service workers, background daemons, multiple currencies,
automated prices, and full double-entry counter-accounts remain out of scope.

## Completed milestones

### Foundation

- Decimal-safe income/expense models, budgets, category aliases, recurring templates, reports,
  charts, CSV, SQLite, CLI, and tests.
- Layered services/repositories and explicit transaction ownership.
- Complete-ledger backup, verification, and atomic restore.

### Web delivery

- FastAPI JSON/OpenAPI adapter and packaged React + Vite SPA.
- Overview, cashflow trends, budget workflows, Manage sections, accessibility, responsive layouts,
  localization, browser tests, and generated contract checks.
- Inline scrollback-friendly CLI home and full-screen Textual workspace.

### Unified Account Activity Ledger — schema v3

The original transaction-plus-snapshot design is superseded.

- One activity model for `opening`, `income`, `expense`, `transfer`, and `adjustment`.
- Account postings with delta or set-balance semantics and deterministic effective-date/ID order.
- Required account assignment for every new financial activity.
- Asset/liability posting rules with zero-impact transfers across every type pair.
- Account subtypes, case-insensitive unique names, immutable type, compatible subtype editing, and
  negative-balance attention states.
- Atomic account/opening creation, calculated zero-balance archival guard, and opening-only deletion
  guard.
- Paginated discriminated `/api/activities` CRUD and account-aware CSV preview/import/export.
- Recurring income, expense, and transfer templates with account references.
- Canonical `activity` CLI commands and `account adjust`; Activity and Update balance terminal
  workflows.
- Canonical `/activity` React experience with `/transactions` query compatibility, filters,
  semantic account effects, projections, account context, and accessible forms.
- Account-derived net worth, history, composition, warning counts, and attribution across cashflow,
  adjustments, and zero-reconciling transfers.
- Rebuilt deterministic demo with accounts first, explicit transfers, and dated observed-balance
  adjustments.
- Schema v1/v2 rejection without mutation or silent data loss.

## Current release criteria

This milestone is complete when:

1. Every domain posting combination, ordering/edit/delete case, lifecycle guard, recurring shape,
   CSV rule, report exclusion, and attribution path has focused regression coverage.
2. CLI, TUI, HTTP/OpenAPI, and React contracts expose Activity terminology and account context.
3. Generated OpenAPI types and packaged SPA assets are current.
4. Demo totals and long-range history are deterministic.
5. README, Usage, Architecture, release checklist, and superseded design documents agree.
6. The full root `AGENTS.md` verification suite, browser E2E, and full-stack E2E pass.

## Future ideas requiring explicit scope decisions

- Optional migration tooling that exports old v1/v2 data for a user-guided rebuild. This must never
  guess account assignment or mutate the source ledger.
- Richer account activity reconciliation and valuation explanations.
- Additional report slices that still preserve transfer/adjustment exclusion from spending.
- Removing dormant source-level compatibility helpers once all downstream callers have adopted the
  v3 public surface.

These are not authorization to add cloud services, bank integration, authentication, a server-state
library, or a full accounting system.
