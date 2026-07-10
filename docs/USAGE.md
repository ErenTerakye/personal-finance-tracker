# Usage Guide

## Install for Development

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm install
npm run build
```

## Initialize the Database

```bash
finance-tracker init
```

By default this creates `data/finance_tracker.sqlite3`.

The default database is local runtime state and is ignored by git. Use `--db-path demo.sqlite3` for the reproducible reviewer demo built from the included synthetic sample CSVs. The `demo.sqlite3` file itself is generated local state, not source data, and can be rebuilt from the CSV files.

Use a custom path:

```bash
finance-tracker init --db-path demo.sqlite3
```

## Reviewer Demo

This sequence imports the included examples, prints budget and report output, creates charts, and exports CSV files:

```bash
finance-tracker init --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --db-path demo.sqlite3
finance-tracker import-budgets-csv examples/sample_budgets.csv --db-path demo.sqlite3
finance-tracker category-rule-set groceries Food --db-path demo.sqlite3
finance-tracker recurring-add expense 1600 --category Rent --description "Monthly rent" --day 1 --db-path demo.sqlite3
finance-tracker recurring-apply --month 7 --year 2026 --db-path demo.sqlite3
mkdir -p reports exports
finance-tracker list --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker budget-status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker report --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker trends --months 6 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

## Run the Local Web UI

Start the browser dashboard:

```bash
finance-tracker web
```

Open `http://127.0.0.1:8000`. Without `--db-path`, this uses `./data/finance_tracker.sqlite3`, which is your local working database and may not match the reviewer demo.

For the reviewer demo, use the generated sample database:

```bash
finance-tracker web --host 127.0.0.1 --port 8000 --db-path demo.sqlite3
```

The Web UI supports:

- A Personal Finance Tracker dashboard with a six-month cashflow trend, KPI cards, YTD/month-over-month context, trend/category charts, recent transactions, and budget pressure.
- Route-aware browser navigation for `/`, `/transactions`, `/budgets`, and `/rules`.
- Compact period controls for changing monthly scope without keeping month/year fields open all the time.
- Transaction add, edit, delete, and filters through native dialog workflows.
- Budget set/update, delete, filters, and monthly status comparison with pressure shown first.
- Transaction and budget CSV import/export from the browser, using the same columns and validation rules as the CLI.
- Transaction CSV preview before import, including invalid rows, duplicates, and category alias changes.
- Category alias and recurring monthly transaction template management from the Rules view.
- Dashboard downloads for monthly text reports, monthly PNG charts, six-month trend text reports, and six-month trend PNG charts.
- A color theme action that follows the operating system by default and can pin a local light or dark preference.
- An English/Turkish language action stored in local browser storage, with locale-aware date, number, and currency formatting based on the active ledger currency.

The Python server exposes JSON under `/api` and serves the compiled React + Vite app from the same local origin. Money values in API responses are decimal strings, preserving the SQLite/`Decimal` behavior used by the CLI.

For frontend development, run the API and Vite dev server in separate terminals:

```bash
finance-tracker web --db-path demo.sqlite3
npm run dev
```

Browser support policy: the Web UI targets Baseline 2026-capable browsers. Newly available browser features are used only as progressive enhancements, so core navigation and CRUD workflows remain usable without large polyfills. The UI uses color-scheme-aware dark mode with a persistent local override, native dialogs and popovers, SVG charts, container queries, mobile-safe viewport units, same-document view transitions, and reduced-motion-aware animation.

The Web UI is a local Python app. GitHub Pages cannot run the live app because Pages does not run Python or SQLite; use [showcase/index.html](showcase/index.html) as a static portfolio preview and run `finance-tracker web` for live CRUD.

## Reviewer Screenshots

Tracked screenshots live in [assets/screenshots](assets/screenshots) and are captured from the generated July 2026 demo database after importing the sample CSVs and applying the documented category rule and recurring template:

- `dashboard-desktop.png` from `/`
- `transactions-mobile.png` from `/transactions`
- `budgets-desktop.png` from `/budgets`

Refresh them after rebuilding `demo.sqlite3` and starting the app with:

```bash
finance-tracker web --db-path demo.sqlite3
```

## Add Transactions

```bash
finance-tracker add income 2500 --category Salary --description "July salary" --date 2026-07-01
finance-tracker add expense 428.75 --category Food --description "Groceries and summer market" --date 2026-07-09
```

## Edit Transactions

Update only the fields that need to change:

```bash
finance-tracker edit 2 --amount 52.25 --category Household
finance-tracker edit 2 --type income --description "Reclassified refund" --date 2026-07-13
```

## List Transactions

```bash
finance-tracker list
finance-tracker list --month 7 --year 2026
finance-tracker list --type expense --category Food
```

## Category Rules

Category rules normalize aliases to a canonical category before transactions,
budgets, reports, and imports store records:

```bash
finance-tracker category-rule-set groceries Food
finance-tracker category-rule-set grocery Food
finance-tracker category-rule-list
finance-tracker category-rule-delete 1
```

After setting `groceries -> Food`, adding or importing a transaction with
category `groceries` stores it as `Food`.

## Recurring Templates

Recurring templates are monthly templates. They never write automatically; apply
them explicitly for a month:

```bash
finance-tracker recurring-add expense 1600 --category Rent --description "Monthly rent" --day 1
finance-tracker recurring-add income 4200 --category Salary --description "Monthly salary" --day 1
finance-tracker recurring-list
finance-tracker recurring-apply --month 7 --year 2026
finance-tracker recurring-delete 1
```

If a template day is past the end of a month, the generated transaction uses the
last day of that month. Applying templates skips duplicate transactions by
default.

## Monthly Summary

```bash
finance-tracker summary --month 7 --year 2026
```

## Monthly Report with Chart

```bash
finance-tracker report --month 7 --year 2026 --chart reports/july-2026.png
```

## Multi-Month Trends

Print a six-month trend report ending in July 2026:

```bash
finance-tracker trends --end-month 7 --end-year 2026
```

Choose a custom period and save a PNG chart:

```bash
finance-tracker trends --months 3 --end-month 7 --end-year 2026 --chart reports/trends.png
```

Monthly reports include YTD totals and month-over-month deltas when enough
ledger context is available. Trend reports include monthly income, expenses, net
savings, month-over-month net changes, savings rate, transaction counts, and top
expense categories across the selected period.

## Budgets

Set or update a monthly category budget:

```bash
finance-tracker budget-set Food 480 --month 7 --year 2026
```

List budgets:

```bash
finance-tracker budget-list --month 7 --year 2026
```

Compare budgets to actual expenses:

```bash
finance-tracker budget-status --month 7 --year 2026
```

Example status output:

```text
Budget status for 2026-07

Category       Budget     Actual     Remaining  Used    Status
-------------  ---------  ---------  ---------  ------  -----------
Dining         $170.00    $164.30    $5.70      96.6%   near limit
Food           $480.00    $428.75    $51.25     89.3%   ok
Health         $100.00    $92.00     $8.00      92.0%   near limit
Household      $180.00    $186.40    $-6.40     103.6%  over budget
Rent           $1,600.00  $1,500.00  $100.00    93.8%   near limit
Subscriptions  $50.00     $44.99     $5.01      90.0%   near limit
Transport      $120.00    $104.60    $15.40     87.2%   ok
Travel         $550.00    $640.00    $-90.00    116.4%  over budget
Utilities      $225.00    $205.20    $19.80     91.2%   near limit
```

Delete a budget:

```bash
finance-tracker budget-delete 1
```

## Import CSV

```bash
finance-tracker import-csv examples/sample_transactions.csv
finance-tracker import-csv examples/sample_transactions.csv --preview
finance-tracker import-csv examples/sample_transactions.csv --allow-duplicates
```

Expected transaction CSV columns:

```csv
type,amount,category,description,date
```

Import budgets from CSV:

```bash
finance-tracker import-budgets-csv examples/sample_budgets.csv
```

Expected budget CSV columns:

```csv
category,amount,month,year
```

## Export CSV

```bash
finance-tracker export-csv exports/transactions.csv
finance-tracker export-csv exports/july.csv --month 7 --year 2026
finance-tracker export-budgets-csv exports/budgets.csv
finance-tracker export-budgets-csv exports/july-budgets.csv --month 7 --year 2026
```

## Browser CSV and Artifact Downloads

In the local Web UI:

- Use `Transactions -> Import CSV` to add transaction rows from a CSV file with `type,amount,category,description,date`.
- Use `Transactions -> Export CSV` to download the currently filtered transaction view.
- Use `Budgets -> Import CSV` to set or update monthly budgets from `category,amount,month,year`.
- Use `Budgets -> Export CSV` to download the currently filtered budget view.
- Use the dashboard download actions to save the selected month report/chart and the six-month trend report/chart.

Transaction CSV imports skip duplicates by default. Duplicate identity is the
same type, amount, canonical category, trimmed description, and date, checked
against existing transactions and earlier accepted rows in the same CSV. Use
`--preview` in the CLI, or the browser preview step, to inspect rows before
writing. Use `--allow-duplicates` only when repeated identical rows are
intentional.

Budget CSV imports still write immediately to the selected local SQLite
database. Invalid rows are skipped and shown in the import result; missing
required columns stop the import.

## Quality Checks

After activating `.venv`, run:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
npm test
npm run build
npm run test:e2e
.venv/bin/python -m build
```

The Playwright suite includes responsive checks and automated accessibility scans for the primary Web UI routes.

For the first Playwright run on a new machine, install Chromium with `npx playwright install --with-deps chromium`.

The GitHub Actions workflow runs the Python checks on Python 3.14 and the frontend checks on Node 24.
