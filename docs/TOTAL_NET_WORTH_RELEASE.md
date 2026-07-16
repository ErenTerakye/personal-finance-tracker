# Total Net Worth Release Evidence

## Shipped capability

Schema version 2 adds asset/liability accounts and dated balance snapshots without linking or
reinterpreting existing transactions. The latest snapshot on or before an as-of date drives the
same decimal-safe total assets, total liabilities, and total net worth rules in the CLI, FastAPI,
Cash flow cross-link and primary React home.

The release includes account creation, name editing, snapshot replacement/correction, protected
snapshot deletion, closing-zero archive behavior, eligible hard deletion, 1–120 point report
history, 6/12/24/60/120 month browser ranges, English/Turkish copy, and an accessible SVG history
chart with a complete semantic table.

## Compatibility and boundaries

- Existing v1 and unversioned ledgers migrate in place to version 2.
- Transactions, budgets, category rules, recurring templates, settings, and CSV contracts remain
  unchanged.
- Money remains `Decimal` in Python and decimal text in SQLite/JSON.
- No production dependency, authentication, bank sync, transfer model, or transaction-to-account
  link was added.
- The Net worth route is lazy-loaded and all browser transport remains in `api/client.ts`.
- Net worth is now the canonical `/` home; monthly cash flow moved to `/cash-flow`, and
  `/net-worth` redirects without losing query parameters.
- The home combines position and history, explains account-level movement and composition, reports
  balance coverage, and supports atomic multi-account balance check-ins.

## Verification

Completed on 2026-07-16:

- `.venv/bin/python -m pytest` — 107 passed.
- `.venv/bin/python -m ruff check .` — passed.
- `.venv/bin/python -m mypy` — passed across 80 source files.
- `npm test` — 134 passed across 21 test files.
- `npm run lint` — ESLint, Stylelint, and the eight-layer CSS architecture check passed.
- `npm run format:check` — passed.
- `npm run test:e2e` — 243 passed across Chromium, Firefox, and WebKit.
- `npm run build` — TypeScript and the production Vite build passed.
- `npm run check:bundle` — 82.88 KiB initial JavaScript, 7.19 KiB initial CSS, and 27.02 KiB total
  CSS; every configured budget passed.
- `npm run test:e2e:fullstack` — 3 passed against the packaged SPA, real FastAPI routes, SQLite,
  redirect persistence, reload persistence, and the client-side not-found route.
- `npm run measure:vitals -- http://127.0.0.1:8011/ wealth-first` — median lab LCP 372 ms, INP
  32 ms, and CLS 0.
- `.venv/bin/python -m build` — source distribution and wheel built successfully.
- `npm run generate:api` was run twice. Both runs produced SHA-256
  `7eeca538d00d8026c46571729c415fe8d9dbf2ca89319f1eed90276dc4f21567` for
  `frontend/src/generated/api.ts` and
  `51d2130a2e695e41cec02b614800fbfd51d6f2d7dbe4dfb8ec71ef7a207ce380` for
  `build/openapi.json`.
- `git diff --check` — passed.

Manual assistive-technology checks remain a release-operator responsibility under
`docs/RELEASE_CHECKLIST.md`.
