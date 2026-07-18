# Release Checklist

Use this checklist for the v1.1 hardened portfolio release and later reviewer-demo refreshes.

## v1.1.0

- [ ] Create a fresh environment and install the app:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm ci
npm run build
```

- [ ] Rebuild the detailed generated demo database from its inspectable source data:

```bash
.venv/bin/python examples/build_demo.py --force
finance-tracker budget-status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker category-rule-list --db-path demo.sqlite3
finance-tracker recurring-list --db-path demo.sqlite3
finance-tracker net-worth-history --months 12 --as-of 2026-07-16 --db-path demo.sqlite3
```

- [ ] Regenerate demo charts and exports:

```bash
mkdir -p reports exports
finance-tracker report --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker trends --months 12 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --preview --db-path demo.sqlite3
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

- [ ] Refresh reviewer screenshots in `docs/assets/screenshots/` from the generated demo:

```bash
finance-tracker web --db-path demo.sqlite3
```

- [ ] Regenerate and verify OpenAPI types plus packaged SPA assets:

```bash
npm run check:generated
```

The generator automatically uses the repository `.venv` when present. For another prepared Python
environment, set `FINANCE_TRACKER_PYTHON=/path/to/python`.

- [ ] Build the Python package:

```bash
.venv/bin/python -m build
```

- [ ] Run the full documented check set:

```bash
.venv/bin/python -m pytest --cov=finance_tracker --cov-report=term-missing --cov-fail-under=90
.venv/bin/python -m ruff check .
.venv/bin/python -m mypy
npm run test:coverage
npm run lint
npm run format:check
npm run check:generated
npm run check:css
npm run check:bundle
npm run test:e2e
npm run test:e2e:fullstack
npm audit --audit-level=high
.venv/bin/python -m pip_audit
.venv/bin/python -m build
```

The bundle check must enforce the Architecture contract, including the 32 KiB gzip total CSS
ceiling. Record any intentional ceiling change and its measured baseline in `docs/ARCHITECTURE.md`
before release.

- [ ] Create and verify a disposable complete-ledger backup, then test a confirmed restore into a
      separate temporary `--db-path`.

- [ ] Confirm README badges, docs, static showcase, screenshots, packaged SPA assets, and `ROADMAP.md` describe the same release state.

- [ ] Confirm the architecture cleanup evidence is current: Python import/adapter manifests pass
      under pytest, ESLint feature/API/shared boundaries pass, the CSS layer checker passes, and no
      legacy monolith or expired compatibility façade remains. Record the final results in
      `docs/ARCHITECTURE_CLEANUP_EVIDENCE.md`.

- [ ] Tag the release only after checks, docs, demo flow, and screenshots are all in sync.
