# Architecture Cleanup Evidence

## Outcome

The whole-repository cleanup defined by
[`ARCHITECTURE_CLEANUP_SPEC.md`](ARCHITECTURE_CLEANUP_SPEC.md) completed on 2026-07-10. The deployed
topology remains one local Python process, one packaged React SPA, and one SQLite ledger. The 26 CLI
commands, 28 HTTP operations, OpenAPI schema names, SQLite v1 layout, CSV formats, browser routes,
security headers, and package entrypoints remain compatible.

## Phase gates

| Phase | Evidence |
| --- | --- |
| 0 — Characterize | CLI/HTTP/schema/security manifests, exact schema/index/CSV/report/export tests, package export manifests, and before/after bundle/lab measurements are checked in or recorded below. |
| 1 — Enforce | AST Python dependency tests, ESLint API/shared/feature restrictions, Stylelint, and the Node CSS architecture checker pass without temporary allowlists. |
| 2 — Adapters | FastAPI is composition plus dependencies/errors/middleware/responses/static/schemas/routers; Typer is composition plus capability command modules. All frozen commands and operations are characterized. |
| 3 — Core Python | Models, repositories, services, CSV, reports, and charts are capability packages. Repository rollback/commit prohibition, atomic rollback, deterministic formatting, and all 58 stable exports are tested. |
| 4 — Frontend | App/API/features/shared ownership, resource/mutation hooks, locale dictionaries, chart modules, UI primitives, and eight CSS layers pass unit, accessibility, responsive, and three-browser checks. |
| 5 — Release | Generated API types have zero drift, the packaged SPA is rebuilt, bundle budgets and dependency audits pass, the wheel/sdist and fresh install work, docs agree, and live browser/computer-use paths pass. |

## Final verification record

| Area | Command or method | Result |
| --- | --- | --- |
| Python behavior/contracts | `.venv/bin/python -m pytest` | 93 passed |
| Python style/types | Ruff and mypy | Clean; 72 source files typed |
| Frontend unit/integration | `npm test` | 12 files, 34 tests passed |
| Frontend boundaries/style | `npm run lint`, `npm run format:check`, `npm run check:css` | Clean; eight ordered layers verified |
| Generated API | `npm run generate:api`, then generated-file diff | Zero drift; deterministic formatting is part of generation |
| Production build | `npm run build`, `npm run check:bundle` | Initial JS 83.39 KiB gzip; CSS 9.17 KiB gzip |
| Browser matrix | Playwright Chromium, Firefox, and WebKit projects | 57 each; 171 passed total |
| Accessibility/preferences | Axe, keyboard, dialog focus, forced colors, 200% text reflow, reduced motion | Passed in all three engines |
| Packaged full stack | `npm run test:e2e:fullstack` | 2 passed against real FastAPI + SQLite |
| Dependencies | `npm audit --audit-level=high`, `.venv/bin/pip-audit` | No known vulnerabilities |
| Python package | `.venv/bin/python -m build` | sdist and universal wheel built with all packages and SPA assets |
| Fresh install | Temporary Python 3.14 environment, wheel with `web` extra | CLI help/init/add/list and FastAPI factory smoke passed |
| Live browser | In-app browser against an isolated reviewer ledger | Real transaction create/filter and budget create passed; locale/title/lang persistence verified |
| Computer Use | Chrome clicks and keyboard | URL navigation, tab order, Enter route activation, click-open dialog, Escape close, and focus restoration passed |

## Performance comparison

`scripts/measure_web_vitals.mjs` ran three Chromium lab samples against the archived pre-cleanup
frontend and the final frontend, both using the same local API and demo ledger.

| Median metric | Pre-cleanup | Final | Good threshold |
| --- | ---: | ---: | ---: |
| LCP | 180 ms | 200 ms | 2,500 ms |
| INP-style event duration | 72 ms | 64 ms | 200 ms |
| CLS | 0 | 0 | 0.1 |

The 20 ms LCP difference is within run-to-run lab variance; interaction latency and layout stability
are unchanged, and every final value remains far inside the target threshold. Production bundle
budgets also remain below 100 KiB initial JavaScript and 15 KiB initial CSS.

## Review and compatibility notes

Independent core and adapter reviews found and closed missing regression evidence for migrations,
atomic rollback, exact formats/exports, CLI behavior, relative-import enforcement, router coupling,
and report-calculation ownership. A separate frontend review and the final live workflow challenged
the feature split, async lifecycle, CSS cascade, accessibility, browser behavior, and packaged assets.
It found and closed focus theft during locale changes, unassociated field hints, misplaced artifact
URLs, synchronous loader error handling, incomplete chart keyboard semantics, and insufficient
built-CSS layer enforcement.

Live testing found that Turkish content and the document title changed while the root `lang`
attribute stayed English. The cleanup now synchronizes `<html lang>` with the saved locale and has a
failing-then-fixed app regression assertion. This is an accessibility metadata correction only: it
does not change routes, financial behavior, API/CLI contracts, stored data, visible workflows, or
format payloads.

The visual design and information architecture did not change, so the existing reviewer screenshots
and static showcase remain representative. The final packaged SPA assets were rebuilt from the
verified source tree and visually inspected in both the in-app browser and Chrome.
