# Web UI Cohesion and Flow Release Record

## Shipped information architecture

The browser now exposes four stable primary destinations at every viewport:

- Overview (`/`)
- Transactions (`/transactions`)
- Budgets (`/budgets`)
- Accounts (`/accounts`)

Manage remains one visible action away and contains focused routes for Automations, Categories,
Data, and Preferences. Compatibility redirects preserve relevant context from `/cash-flow`,
`/net-worth`, and `/rules`.

## Product flow

Overview combines cashflow orientation, a concise current net-worth summary, budget attention, and
recent transactions. Detailed account work remains in Accounts. Summary links retain period,
category, search, or as-of context when entering Transactions, Budgets, or Accounts.

Add transaction is the stable global command. Each primary destination also has one dominant local
action: Add transaction, Set budget, or Update balances. Data import/export is progressively
disclosed in Transactions and Budgets and consolidated under Manage → Data.

Recurring templates now live under Manage → Automations with a deliberate preview, duplicate
explanation, apply result, and direct link to the resulting Transactions. Category aliases,
currency, language, and theme each have a focused management home.

## Shared interaction grammar

All canonical routes use shared route headers, semantic navigation links, route-heading focus,
native dialogs with focus restoration, consistent action hierarchy, visible focus states, and
English/Turkish destination concepts. Compact layouts retain four readable bottom-navigation
labels, a visibly labeled Manage action, and a 2×2 Manage section grid.

The implementation preserves feature boundaries: app composition owns routing and cross-route
handoff, feature modules own workflows, shared modules own reusable UI, and browser transport
remains isolated in `api/client.ts`.

## Verification

Verified on July 16, 2026:

- Python: 107 pytest tests, Ruff, and mypy passed.
- Frontend: 132 Vitest tests, ESLint, Stylelint, CSS architecture, and formatting passed.
- Generated OpenAPI TypeScript was regenerated with the project virtual environment and remained
  unchanged.
- Production build and compressed bundle budgets passed.
- Playwright: 279 Chromium, Firefox, and WebKit responsive/accessibility tests passed.
- Packaged FastAPI + SQLite Playwright suite: 3 tests passed.
- Automated accessibility scans cover all four canonical routes and all four Manage sections at
  mobile, tablet, and desktop widths with no serious or critical violations.
- Reviewer screenshots and the static showcase were refreshed to match the shipped navigation and
  route vocabulary.
