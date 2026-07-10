# Release Checklist

Use this checklist for the v1.0 portfolio release and later reviewer-demo refreshes.

## v1.0.0

- [ ] Create a fresh environment and install the app:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm ci
npm run build
```

- [ ] Rebuild the generated demo database from source CSV files:

```bash
finance-tracker init --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --db-path demo.sqlite3
finance-tracker import-budgets-csv examples/sample_budgets.csv --db-path demo.sqlite3
finance-tracker category-rule-set groceries Food --db-path demo.sqlite3
finance-tracker recurring-add expense 1600 --category Rent --description "Monthly rent" --day 1 --db-path demo.sqlite3
finance-tracker recurring-apply --month 7 --year 2026 --db-path demo.sqlite3
```

- [ ] Regenerate demo charts and exports:

```bash
mkdir -p reports exports
finance-tracker report --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker trends --months 6 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --preview --db-path demo.sqlite3
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

- [ ] Refresh reviewer screenshots in `docs/assets/screenshots/` from the generated demo:

```bash
finance-tracker web --db-path demo.sqlite3
```

- [ ] Refresh packaged SPA assets:

```bash
npm run build
```

- [ ] Build the Python package:

```bash
.venv/bin/python -m build
```

- [ ] Run the full documented check set:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
npm test
npm run build
npm run test:e2e
.venv/bin/python -m build
```

- [ ] Confirm README badges, docs, static showcase, screenshots, packaged SPA assets, and `ROADMAP.md` describe the same release state.

- [ ] Tag the release only after checks, docs, demo flow, and screenshots are all in sync.
