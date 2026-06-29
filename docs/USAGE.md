# Usage Guide

## Install for Development

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
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

## Add Transactions

```bash
finance-tracker add income 2500 --category Salary --description "June salary" --date 2026-06-01
finance-tracker add expense 45.90 --category Food --description "Groceries" --date 2026-06-12
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

## Import CSV

```bash
finance-tracker import-csv examples/sample_transactions.csv
```

Expected CSV columns:

```csv
type,amount,category,description,date
```

## Export CSV

```bash
finance-tracker export-csv exports/transactions.csv
finance-tracker export-csv exports/june.csv --month 6 --year 2026
```

## Quality Checks

```bash
python -m pytest
python -m ruff check .
```
