# Total Net Worth Release Evidence

## Shipped capability

Schema version 2 adds asset/liability accounts and dated balance snapshots without linking or
reinterpreting existing transactions. The latest snapshot on or before an as-of date drives the
same decimal-safe total assets, total liabilities, and total net worth rules in the CLI, FastAPI,
Overview aggregate, and dedicated React route.

The release includes account creation, name editing, snapshot replacement/correction, protected
snapshot deletion, closing-zero archive behavior, eligible hard deletion, 1–120 point report
history, 6/12/24 point browser ranges, English/Turkish copy, and an accessible SVG history chart
with a complete semantic table.

## Compatibility and boundaries

- Existing v1 and unversioned ledgers migrate in place to version 2.
- Transactions, budgets, category rules, recurring templates, settings, and CSV contracts remain
  unchanged.
- Money remains `Decimal` in Python and decimal text in SQLite/JSON.
- No production dependency, authentication, bank sync, transfer model, or transaction-to-account
  link was added.
- The Net worth route is lazy-loaded and all browser transport remains in `api/client.ts`.

## Verification

Completed on 2026-07-16:

- `.venv/bin/python -m pytest` — 105 passed.
- `.venv/bin/python -m ruff check .` — passed.
- `.venv/bin/python -m mypy` — passed across 80 source files.
- `npm test` — 132 passed across 21 test files.
- `npm run lint` — ESLint, Stylelint, and the eight-layer CSS architecture check passed.
- `npm run format:check` — passed.
- `npm run test:e2e` — 243 passed across Chromium, Firefox, and WebKit.
- `npm run build` — TypeScript and the production Vite build passed.
- `npm run check:bundle` — 81.84 KiB initial JavaScript, 15.69 KiB initial CSS, and
  24.93 KiB total CSS; every configured budget passed.
- `npm run test:e2e:fullstack` — 3 passed against the packaged SPA, real FastAPI routes, SQLite,
  reload persistence, and the client-side not-found route.
- `.venv/bin/python -m build` — source distribution and wheel built successfully.
- `npm run generate:api` was run twice. Both runs produced SHA-256
  `475f73326de504c72173a47f5f0c0c8f650d799308f59810ef666d1d1a82ad30` for
  `frontend/src/generated/api.ts` and
  `fda8f3060bef33ba0590d8d4d38f6b6b6fb33db73e51f3f79a43a6e62f730ef0` for
  `build/openapi.json`.
- `git diff --check` — passed.

Manual assistive-technology checks remain a release-operator responsibility under
`docs/RELEASE_CHECKLIST.md`.
