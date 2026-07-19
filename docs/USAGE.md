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
finance-tracker data init
```

By default this creates `data/finance_tracker.sqlite3`.

The default database is local runtime state and is ignored by git. Use `--db-path demo.sqlite3` for
the reproducible reviewer demo built from the included synthetic source data. The `demo.sqlite3`
file itself is generated local state and can be rebuilt at any time.

Use a custom path:

```bash
finance-tracker data init --db-path demo.sqlite3
```

## Inline Terminal Home

Run the command without a subcommand:

```bash
finance-tracker --db-path demo.sqlite3
```

This prints the current month's cash flow, net worth, budget attention, and recent activity directly
in terminal scrollback. Interactive terminals also get a focused action menu for adding a
transaction, reviewing the month, checking budgets, recording account balances, or opening the
full-screen workspace. Navigate with the arrow keys and Enter, use `1`–`5` for direct selection, or
press `Q` to quit. Each action completes and returns to the shell. When input or output is not a TTY,
the command prints the snapshot and command hints without prompting. Use `--output json` for a
machine-readable snapshot.

## Full-Screen Terminal Workspace

Launch the persistent workspace explicitly:

```bash
finance-tracker --db-path demo.sqlite3 tui
```

The workspace provides Overview, Transactions, Budgets, Accounts, and Manage destinations. It
supports transaction and budget CRUD, CSV preview/import/export, account lifecycle and atomic
balance check-ins, recurring templates, category aliases, currency, and complete-ledger recovery.
Use `1`–`5` to navigate, `Ctrl+P` for the command palette, `/` to search, `A` to add a transaction,
`R` to refresh, and `?` for keyboard help. Mouse input is optional.

The TUI requires an interactive terminal. Pipes, `TERM=dumb`, screen-reader workflows, and
automation should use the grouped commands instead. Global options precede the command when used:

```bash
finance-tracker --db-path demo.sqlite3 overview --month 7 --year 2026
finance-tracker --db-path demo.sqlite3 --output json transaction list
finance-tracker --db-path demo.sqlite3 --no-color budget status --month 7 --year 2026
finance-tracker --db-path demo.sqlite3 --yes data restore backups/demo.sqlite3
```

JSON success responses use `{"ok":true,"data":...}`. Expected failures use
`{"ok":false,"error":{"code":"…","message":"…"}}` on stderr. Exit codes are 0 for success,
1 for domain/runtime failures, and 2 for invalid invocation or an unavailable TTY requested by
`tui`.

## Reviewer Demo

This sequence builds the included example scenario, prints budget and report output, creates
charts, and exports CSV files:

```bash
.venv/bin/python examples/build_demo.py --force
mkdir -p reports exports
finance-tracker transaction list --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker budget status --month 7 --year 2026 --db-path demo.sqlite3
finance-tracker report monthly --month 7 --year 2026 --chart reports/july-2026.png --db-path demo.sqlite3
finance-tracker report trends --months 12 --end-month 7 --end-year 2026 --chart reports/trends.png --db-path demo.sqlite3
finance-tracker report net-worth-history --months 120 --as-of 2026-07-16 --db-path demo.sqlite3
finance-tracker web --db-path demo.sqlite3
finance-tracker transaction export exports/transactions.csv --db-path demo.sqlite3
finance-tracker budget export exports/budgets.csv --db-path demo.sqlite3
```

The builder seeds a complete trailing year with 281 merchant-level transactions, realistic
same-day activity, mixed budget states, category aliases, recurring templates with duplicate-safe
application, and a fully populated 120-month asset/liability history. See
[../examples/README.md](../examples/README.md) for the detailed scenario.

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

The server rejects non-loopback hosts by default because the ledger has no authentication. For an
intentional trusted-network demo, the explicit escape hatch is:

```bash
finance-tracker web --host 0.0.0.0 --allow-remote-unauthenticated --db-path demo.sqlite3
```

The command prints the bind address and database path. Anyone who can reach that address can read
and mutate the ledger, so do not use this option for a real ledger or an untrusted network.

The Web UI uses four primary destinations—Overview, Transactions, Budgets, and Accounts—with a
secondary Manage area:

- A unified Overview at `/` with a six-month cashflow trend, net-worth summary, recent
  transactions, and budget attention that links to detailed destinations with period/category
  context.
- Canonical browser routes `/`, `/transactions`, `/budgets`, and `/accounts`, plus
  `/manage/automations`, `/manage/categories`, `/manage/data`, and `/manage/preferences`.
- Compatibility redirects from `/cash-flow` to `/`, `/net-worth` to `/accounts`, and `/rules` to
  `/manage/automations`, preserving relevant query parameters.
- Idle and interaction-intent preparation for fast first opens, with visited filters and view state
  restored when returning to a destination; slow routes use an accessible stable loading shell.
- An Accounts workspace for current and historical position, account movement, composition,
  coverage, atomic multi-account balance updates, correction safeguards, and an accessible chart
  with a complete data table.
- Compact period controls for changing monthly scope without keeping month/year fields open all the time.
- A Transactions workspace with an inflow/outflow/net summary, immediate search, period and category filters, newest/oldest sorting, a date-grouped ledger timeline, and transaction add, edit, and delete workflows.
- A Budgets workspace with a monthly health pulse, planned/spent/uncovered metrics, live category search, priority/spend/category sorting, pressure-ranked guardrail cards, and focused budget editing and deletion.
- Transaction and budget CSV import/export from the browser, using the same columns and validation rules as the CLI.
- Transaction CSV preview before import, including invalid rows, duplicates, and category alias changes.
- Focused Manage sections for recurring monthly transaction templates, category aliases, local
  data import/export, and ledger/display preferences. Recurring application includes a review step,
  duplicate handling, and a direct link to created Transactions.
- Overview downloads for monthly text reports, monthly PNG charts, six-month trend text reports,
  and six-month trend PNG charts.
- A stable global Add transaction action on every route, plus one dominant task action per primary
  destination.
- Light/Dark and English/Turkish preferences stored locally, with synchronized access from the
  desktop rail, the compact-header preferences panel, and Manage → Preferences. With no stored
  theme, the interface initially follows the operating-system color scheme.

The Python server exposes JSON under `/api` and serves the compiled React + Vite app from the same local origin. Money values in API responses are decimal strings, preserving the SQLite/`Decimal` behavior used by the CLI. Individual amounts and balances may be at most `90071992547409.91`; the Web UI formats that boundary and derives displayed totals without losing cents.

For frontend development with a fresh copy of the detailed demo:

```bash
npm run dev:demo
```

This command checks that ports 8000 and 5173 are free, rebuilds `demo.sqlite3`, starts the
reload-enabled API and Vite, and cleans up the API process when Vite exits.

To preserve changes made to the current database, run the API and Vite dev server in separate
terminals:

```bash
finance-tracker web --db-path demo.sqlite3
npm run dev
```

Open `http://127.0.0.1:5173` for the development UI. Vite forwards same-origin `/api` requests to `http://127.0.0.1:8000`, so both processes are required. The packaged application at port 8000 uses the built SPA instead.

The API paginates browser list endpoints with `limit` (1–250) and `offset`, returning `page.limit`, `page.offset`, and `page.total`. CSV exports intentionally remain complete and filtered rather than paginated. CSV uploads must be an accepted CSV media type, UTF-8 encoded, and no larger than 5 MiB.

Browser support policy: the Web UI targets Baseline 2026-capable browsers. Newly available browser features are used only as progressive enhancements, so core navigation and CRUD workflows remain usable without large polyfills. The UI uses color-scheme-aware dark mode with a persistent local override, native dialogs and popovers, SVG charts, container queries, mobile-safe viewport units, same-document view transitions, and reduced-motion-aware animation.

The Web UI is a local Python app. GitHub Pages cannot run the live app because Pages does not run Python or SQLite; use [showcase/index.html](showcase/index.html) as a static portfolio preview and run `finance-tracker web` for live CRUD.

## Reviewer Screenshots

Tracked screenshots live in [assets/screenshots](assets/screenshots) and should be refreshed from
the generated July 2026 demo database after running `examples/build_demo.py`:

- `dashboard-desktop.png` from `/` (Overview)
- `transactions-mobile.png` from `/transactions`
- `budgets-desktop.png` from `/budgets`

Refresh them after rebuilding `demo.sqlite3` and starting the app with:

```bash
finance-tracker web --db-path demo.sqlite3
```

## Accounts and Total Net Worth

Create asset and liability accounts with an initial dated balance:

```bash
finance-tracker account add --name "Everyday savings" --type asset --balance 12400 --date 2026-01-31
finance-tracker account add --name "Education loan" --type liability --balance 9200 --date 2026-01-31
finance-tracker account balance set 1 13850 --date 2026-07-16
finance-tracker account balance check-in --date 2026-07-16 --balance 1=13850 --balance 2=8750
finance-tracker account balance list 1
finance-tracker account list --as-of 2026-07-16
finance-tracker report net-worth --as-of 2026-07-16
finance-tracker report net-worth-history --months 120 --as-of 2026-07-16
```

Liability balances are positive amounts owed. Snapshot deletion and account archiving require
`--confirm`; archiving records a closing zero balance while preserving earlier history.

```bash
finance-tracker account edit 1 --name "Emergency savings"
finance-tracker account balance delete 1 --date 2026-06-30 --confirm
finance-tracker account archive 2 --date 2026-07-16 --confirm
finance-tracker account delete 3 --confirm
```

## Add Transactions

```bash
finance-tracker transaction add income 2500 --category Salary --description "July salary" --date 2026-07-01
finance-tracker transaction add expense 428.75 --category Food --description "Groceries and summer market" --date 2026-07-09
```

## Edit Transactions

Update only the fields that need to change:

```bash
finance-tracker transaction edit 2 --amount 52.25 --category Household
finance-tracker transaction edit 2 --type income --description "Reclassified refund" --date 2026-07-13
```

## List Transactions

```bash
finance-tracker transaction list
finance-tracker transaction list --month 7 --year 2026
finance-tracker transaction list --type expense --category Food
```

## Category Rules

Category rules normalize aliases to a canonical category before transactions,
budgets, reports, and imports store records:

```bash
finance-tracker category set groceries Food
finance-tracker category set grocery Food
finance-tracker category list
finance-tracker category delete 1
```

After setting `groceries -> Food`, adding or importing a transaction with
category `groceries` stores it as `Food`.

## Recurring Templates

Recurring templates are monthly templates. They never write automatically; apply
them explicitly for a month:

```bash
finance-tracker recurring add expense 1600 --category Rent --description "Monthly rent" --day 1
finance-tracker recurring add income 4200 --category Salary --description "Monthly salary" --day 1
finance-tracker recurring list
finance-tracker recurring apply --month 7 --year 2026
finance-tracker recurring delete 1
```

If a template day is past the end of a month, the generated transaction uses the
last day of that month. Applying templates skips duplicate transactions by
default.

## Monthly Summary

```bash
finance-tracker overview --month 7 --year 2026
```

## Monthly Report with Chart

```bash
finance-tracker report monthly --month 7 --year 2026 --chart reports/july-2026.png
```

## Multi-Month Trends

Print a six-month trend report ending in July 2026:

```bash
finance-tracker report trends --end-month 7 --end-year 2026
```

Choose a custom period and save a PNG chart:

```bash
finance-tracker report trends --months 3 --end-month 7 --end-year 2026 --chart reports/trends.png
```

Monthly reports include YTD totals and month-over-month deltas when enough
ledger context is available. Trend reports include monthly income, expenses, net
savings, month-over-month net changes, savings rate, transaction counts, and top
expense categories across the selected period.

## Budgets

Set or update a monthly category budget:

```bash
finance-tracker budget set Food 480 --month 7 --year 2026
```

List budgets:

```bash
finance-tracker budget list --month 7 --year 2026
```

Compare budgets to actual expenses:

```bash
finance-tracker budget status --month 7 --year 2026
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
finance-tracker budget delete 1
```

## Complete-Ledger Backup and Restore

CSV remains the portable format for transactions and budgets. To protect every ledger record—
including accounts and balance history, rules, recurring templates, and settings—use a SQLite
backup:

```bash
finance-tracker data backup backups/finance-2026-07-18.sqlite3
finance-tracker data verify backups/finance-2026-07-18.sqlite3
```

The backup uses SQLite's online backup API, so committed WAL data is captured consistently. Store
backups on a different disk or another location you control. Existing files require `--overwrite`.

Restore atomically replaces the selected active ledger only after integrity and supported-schema
checks, and requires explicit confirmation:

```bash
finance-tracker data restore backups/finance-2026-07-18.sqlite3 --confirm
finance-tracker data restore backups/demo.sqlite3 --confirm --db-path demo.sqlite3
```

Run `ledger-verify` periodically and before restoring. Keep the original backup until the restored
ledger has been opened and checked.

Verification checks the declared application schema, required indexes, SQLite integrity, and
foreign-key consistency. Restore prepares a copy beside the active ledger, migrates and re-verifies
that copy, and only then atomically replaces the active file. A rejected backup never replaces the
active ledger.

## Import CSV

```bash
finance-tracker transaction import examples/sample_transactions.csv
finance-tracker transaction import examples/sample_transactions.csv --preview
finance-tracker transaction import examples/sample_transactions.csv --allow-duplicates
```

Expected transaction CSV columns:

```csv
type,amount,category,description,date
```

Import budgets from CSV:

```bash
finance-tracker budget import examples/sample_budgets.csv
```

Expected budget CSV columns:

```csv
category,amount,month,year
```

## Export CSV

```bash
finance-tracker transaction export exports/transactions.csv
finance-tracker transaction export exports/july.csv --month 7 --year 2026
finance-tracker budget export exports/budgets.csv
finance-tracker budget export exports/july-budgets.csv --month 7 --year 2026
```

## Browser CSV and Artifact Downloads

In the local Web UI:

- Use `Transactions → Data options → Import CSV` to add transaction rows from a CSV file with
  `type,amount,category,description,date`.
- Use `Transactions → Data options → Export CSV` to download the currently filtered transaction
  view.
- Use `Budgets → Data options → Import CSV` to set or update monthly budgets from
  `category,amount,month,year`.
- Use `Budgets → Data options → Export CSV` to download the currently filtered budget view.
- Use the Overview download actions to save the selected month report/chart and the six-month trend report/chart.

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
