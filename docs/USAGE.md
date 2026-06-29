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
finance-tracker budget-set Food 400 --month 6 --year 2026
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

Category  Budget      Actual      Remaining   Used    Status
--------  ----------  ----------  ----------  ------  -----------
Food      $400.00     $325.50     $74.50      81.4%   ok
Dining    $150.00     $150.00     $0.00       100.0%  near limit
Travel    $50.00      $75.00      $-25.00     150.0%  over budget
```

Delete a budget:

```bash
finance-tracker budget-delete 1
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
