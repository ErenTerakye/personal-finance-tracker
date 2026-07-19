# Detailed Reviewer Demo

The example data describes one fictional household ledger with ten years of net-worth history from
August 2016 through July 2026 and detailed cashflow from August 2025 onward. It is synthetic,
deterministic, and safe to rebuild.

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

- 281 transactions across a complete trailing year. Each month contains 22–25 merchant-level
  entries across 16–20 active days, including realistic same-day clusters, salary, freelance work,
  a bonus, refunds, fixed costs, everyday purchases, health, learning, giving, gifts, and travel.
- 120 monthly budgets with July examples of on-track, near-limit, and over-budget categories.
- Five category aliases, with source rows such as `groceries`, `metro`, and `streaming` normalized
  during import.
- Four active recurring templates. The first July application creates the missing recurring
  entries; the second application proves duplicate-safe behavior.
- Six active asset/liability accounts and one archived account, backed by 827 dated balance
  snapshots for a fully populated 120-month net-worth history. The story starts with negative net
  worth, follows uneven loan repayment and saving, includes realistic month-to-month cash and
  investment volatility around recognizable 2020 and 2022 market drawdowns, and ends with a
  checking-account transition and positive net worth.
- A USD ledger setting suitable for exercising English/Turkish locale formatting independently
  from the stored currency.

The hosted Sites build reads these same transaction and budget CSV files at build time, so the
portfolio deployment and the local SQLite demo present the same cashflow story instead of separate
hand-maintained samples.

Useful review points after building:

```bash
finance-tracker report --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker trends --months 12 --end-month 7 --end-year 2026 --db-path demo.sqlite3
finance-tracker budget-status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker category-rule-list --db-path demo.sqlite3
finance-tracker recurring-list --db-path demo.sqlite3
finance-tracker account-list --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker net-worth-history --months 120 --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker import-csv examples/sample_transactions.csv --preview --db-path demo.sqlite3
```

The CSV preview reports the source transactions as duplicates because they are already present,
while still showing category normalization. Use a disposable copy of the database when testing
destructive edit, delete, archive, and import-with-duplicates workflows.
