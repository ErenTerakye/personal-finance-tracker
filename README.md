# Personal Finance Tracker

A Python CLI application for tracking income and expenses using SQLite, CSV processing, OOP, and data visualization.

## Highlights

- Add, edit, list, delete, import, and export financial transactions.
- Set monthly category budgets and compare them to actual expenses.
- Import and export transactions and budgets with CSV files.
- Store records locally in SQLite.
- Generate monthly and multi-month income, expense, net savings, and category reports.
- Save optional PNG charts for monthly reports and trend reports.
- Use a clean `src/` package layout with Typer, pytest, and Ruff.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
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
finance-tracker export-csv exports/transactions.csv --db-path demo.sqlite3
finance-tracker export-budgets-csv exports/budgets.csv --db-path demo.sqlite3
```

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
```

## Development

After activating the virtual environment, run:

```bash
python -m pytest
python -m ruff check .
```

GitHub Actions runs the same checks on Python 3.14.

See [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md), [docs/USAGE.md](docs/USAGE.md), and [AGENTS.md](AGENTS.md) for deeper project notes.
