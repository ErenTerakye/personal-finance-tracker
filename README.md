# Personal Finance Tracker

A Python CLI application for tracking income and expenses using SQLite, CSV processing, OOP, and data visualization.

## Highlights

- Add, edit, list, delete, import, and export financial transactions.
- Set monthly category budgets and compare them to actual expenses.
- Import and export transactions and budgets with CSV files.
- Store records locally in SQLite.
- Generate monthly and multi-month income, expense, net savings, and category reports.
- Save optional PNG charts for monthly reports and trend reports.
- Run a polished local FastAPI Web UI for dashboard, transaction, and budget workflows.
- Use a clean `src/` package layout with Typer, pytest, and Ruff.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
```

## Quick Start

```bash
finance-tracker init
finance-tracker import-csv examples/sample_transactions.csv
finance-tracker import-budgets-csv examples/sample_budgets.csv
finance-tracker list
finance-tracker summary --month 6 --year 2026
finance-tracker report --month 6 --year 2026 --chart reports/june-2026.png
finance-tracker trends --months 6 --end-month 6 --end-year 2026 --chart reports/trends.png
finance-tracker web
```

Open the Web UI at `http://127.0.0.1:8000`. It uses the same default SQLite database as the CLI. To run it against a demo database:

```bash
finance-tracker web --db-path demo.sqlite3
```

## Demo Flow

Run a fresh local demo without touching the default database:

```bash
finance-tracker init --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --db-path demo.sqlite3
finance-tracker import-budgets-csv examples/sample_budgets.csv --db-path demo.sqlite3
finance-tracker budget-status --month 6 --year 2026 --db-path demo.sqlite3
finance-tracker report --month 6 --year 2026 --chart reports/june-2026.png --db-path demo.sqlite3
finance-tracker trends --months 3 --end-month 6 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

## Web UI

The local Web UI provides a browser dashboard with monthly totals, browser-rendered charts, recent transactions, budget status, transaction CRUD, and budget CRUD. It remains local-first: the Python server reads and writes your SQLite database on your machine.

GitHub Pages can host static files only, so it cannot run the live Python/SQLite app. A static showcase is available in [docs/showcase/index.html](docs/showcase/index.html) for portfolio hosting, while real CRUD requires `finance-tracker web`.

## Common Commands

```bash
finance-tracker add income 2500 --category Salary --description "June salary" --date 2026-06-01
finance-tracker add expense 45.90 --category Food --description "Groceries" --date 2026-06-12
finance-tracker edit 2 --amount 52.25 --category Household
finance-tracker budget-set Food 400 --month 6 --year 2026
finance-tracker budget-status --month 6 --year 2026
finance-tracker trends --months 6 --end-month 6 --end-year 2026
finance-tracker list --month 6 --year 2026
finance-tracker export-csv exports/transactions.csv
finance-tracker export-budgets-csv exports/budgets.csv
finance-tracker delete 1
```

The default database path is `./data/finance_tracker.sqlite3`. Override it with `--db-path` or the `FINANCE_TRACKER_DB` environment variable.

## CSV Formats

Transaction import and export use:

```csv
type,amount,category,description,date
income,3200.00,Salary,June salary,2026-06-01
expense,45.90,Food,Groceries,2026-06-12
```

Budget import and export use:

```csv
category,amount,month,year
Food,400.00,6,2026
Rent,1200.00,6,2026
```

## Project Structure

```text
src/finance_tracker/
  cli.py            # Typer commands
  models.py         # Domain objects and validation
  services.py       # Use-case coordination
  database.py       # SQLite setup
  repositories.py   # SQL queries
  csv_io.py         # CSV import/export
  reports.py        # Monthly report calculations
  charts.py         # PNG chart generation
  web/              # Local FastAPI Web UI
```

## Development

After activating the virtual environment, run:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
```

GitHub Actions runs the same checks on Python 3.14.

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md), [docs/USAGE.md](docs/USAGE.md), and [AGENTS.md](AGENTS.md) for deeper project notes.
