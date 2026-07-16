# Detailed Reviewer Demo

The example data describes one fictional household ledger from August 2025 through July 2026.
It is synthetic, deterministic, and safe to rebuild.

Build a fresh demo database:

```bash
.venv/bin/python examples/build_demo.py --force
finance-tracker web --db-path demo.sqlite3
```

Or rebuild it and start the reload-enabled API plus Vite development server together:

```bash
npm run dev:demo
```

The builder deliberately uses the project's public services and CSV adapters. It creates:

- 137 transactions across a complete trailing year, including salary, freelance work, a bonus,
  refunds, fixed costs, discretionary spending, health, learning, giving, gifts, and travel.
- 120 monthly budgets with July examples of on-track, near-limit, and over-budget categories.
- Five category aliases, with source rows such as `groceries`, `metro`, and `streaming` normalized
  during import.
- Four active recurring templates. The first July application creates the missing recurring
  entries; the second application proves duplicate-safe behavior.
- Six active asset/liability accounts and one archived account, backed by 71 dated balance
  snapshots for a meaningful 12-month net-worth history.
- A USD ledger setting suitable for exercising English/Turkish locale formatting independently
  from the stored currency.

Useful review points after building:

```bash
finance-tracker report --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker trends --months 12 --end-month 7 --end-year 2026 --db-path demo.sqlite3
finance-tracker budget-status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker category-rule-list --db-path demo.sqlite3
finance-tracker recurring-list --db-path demo.sqlite3
finance-tracker account-list --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker net-worth-history --months 12 --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --preview --db-path demo.sqlite3
```

The CSV preview reports the source transactions as duplicates because they are already present,
while still showing category normalization. Use a disposable copy of the database when testing
destructive edit, delete, archive, and import-with-duplicates workflows.
