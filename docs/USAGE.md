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
finance-tracker list --month 6 --year 2026 --db-path demo.sqlite3
finance-tracker budget-status --month 6 --year 2026 --db-path demo.sqlite3
finance-tracker report --month 6 --year 2026 --chart reports/june-2026.png --db-path demo.sqlite3
finance-tracker trends --months 3 --end-month 6 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

## Run the Local Web UI

Start the browser dashboard:

```bash
finance-tracker web
```

Open `http://127.0.0.1:8000`.

Use a custom database path:

```bash
finance-tracker web --host 127.0.0.1 --port 8000 --db-path demo.sqlite3
```

The Web UI supports:

- A Ledger Workbench dashboard with a six-month statement tape, KPI cards, trend/category charts, recent transactions, and budget pressure.
- Route-aware browser navigation for `/`, `/transactions`, and `/budgets`.
- Compact period controls for changing monthly scope without keeping month/year fields open all the time.
- Transaction add, edit, delete, and filters through native dialog workflows.
- Budget set/update, delete, filters, and monthly status comparison with pressure shown first.
- A color theme action that follows the operating system by default and can pin a local light or dark preference.

The Python server exposes JSON under `/api` and serves the compiled React + Vite app from the same local origin. Money values in API responses are decimal strings, preserving the SQLite/`Decimal` behavior used by the CLI.

For frontend development, run the API and Vite dev server in separate terminals:

```bash
finance-tracker web --db-path demo.sqlite3
npm run dev
```

Browser support policy: the Web UI targets modern Baseline-capable browsers as of June 2026. Newly available browser features are used only as progressive enhancements, so core navigation and CRUD workflows remain usable without large polyfills. The UI uses color-scheme-aware dark mode with a persistent local override, native dialogs and popovers, SVG charts, container queries, mobile-safe viewport units, same-document view transitions, and reduced-motion-aware animation.

The Web UI is a local Python app. GitHub Pages cannot run the live app because Pages does not run Python or SQLite; use [showcase/index.html](showcase/index.html) as a static portfolio preview and run `finance-tracker web` for live CRUD.

## Add Transactions

```bash
finance-tracker add income 2500 --category Salary --description "June salary" --date 2026-06-01
finance-tracker add expense 386.40 --category Food --description "Groceries and farmers market" --date 2026-06-10
```

## Edit Transactions

Update only the fields that need to change:

```bash
finance-tracker edit 2 --amount 52.25 --category Household
finance-tracker edit 2 --type income --description "Reclassified refund" --date 2026-06-13
```

## List Transactions

```bash
finance-tracker list
finance-tracker list --month 6 --year 2026
finance-tracker list --type expense --category Food
```

## Monthly Summary

```bash
finance-tracker summary --month 6 --year 2026
```

## Monthly Report with Chart

```bash
finance-tracker report --month 6 --year 2026 --chart reports/june-2026.png
```

## Multi-Month Trends

Print a six-month trend report ending in June 2026:

```bash
finance-tracker trends --end-month 6 --end-year 2026
```

Choose a custom period and save a PNG chart:

```bash
finance-tracker trends --months 3 --end-month 6 --end-year 2026 --chart reports/trends.png
```

Trend reports include monthly income, expenses, net savings, savings rate, transaction counts, and top expense categories across the selected period.

## Budgets

Set or update a monthly category budget:

```bash
finance-tracker budget-set Food 500 --month 6 --year 2026
```

List budgets:

```bash
finance-tracker budget-list --month 6 --year 2026
```

Compare budgets to actual expenses:

```bash
finance-tracker budget-status --month 6 --year 2026
```

Example status output:

```text
Budget status for 2026-06

Category       Budget     Actual     Remaining  Used    Status
-------------  ---------  ---------  ---------  ------  -----------
Dining         $190.00    $171.00    $19.00     90.0%   near limit
Food           $500.00    $386.40    $113.60    77.3%   ok
Rent           $1,600.00  $1,500.00  $100.00    93.8%   near limit
Subscriptions  $50.00     $44.99     $5.01      90.0%   near limit
Transport      $120.00    $96.80     $23.20     80.7%   ok
Travel         $150.00    $185.00    $-35.00    123.3%  over budget
Utilities      $225.00    $192.35    $32.65     85.5%   ok
```

Delete a budget:

```bash
finance-tracker budget-delete 1
```

## Import CSV

```bash
finance-tracker import-csv examples/sample_transactions.csv
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
finance-tracker export-csv exports/june.csv --month 6 --year 2026
finance-tracker export-budgets-csv exports/budgets.csv
finance-tracker export-budgets-csv exports/june-budgets.csv --month 6 --year 2026
```

## Quality Checks

After activating `.venv`, run:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
npm test
npm run build
```

The GitHub Actions workflow runs these checks on Python 3.14.
