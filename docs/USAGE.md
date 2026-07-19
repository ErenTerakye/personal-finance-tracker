# Usage

All surfaces use one local schema-v3 SQLite activity ledger. Pass `--db-path` explicitly when
working with a demo or disposable ledger; otherwise the CLI uses its configured local default.

## Install and initialize

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev,web]"
npm install
npm run build
finance-tracker data init --db-path finance.sqlite3
```

Schema v1/v2 ledgers are not upgraded automatically. Back up the old file, create a new v3 ledger,
and rebuild or import account-aware activity.

## Inline home and terminal workspace

```bash
finance-tracker --db-path finance.sqlite3
finance-tracker tui --db-path finance.sqlite3
```

The inline home preserves terminal scrollback and offers Add activity, Review activity, Check
budgets, Update account balance, and Workspace. The full-screen workspace uses `1`–`5` for
Overview, Activity, Budgets, Accounts, and Manage; `Ctrl+P` opens its command palette, `/` focuses
search, `A` opens Add activity, and `Q` exits.

Global flags may precede a command:

```bash
finance-tracker --db-path finance.sqlite3 --output json activity list
finance-tracker --db-path finance.sqlite3 --yes activity delete 4
```

## Accounts and balances

Account types are `asset` and `liability`. Compatible subtypes are:

- Asset: `cash`, `investment`, `property`, `other`
- Liability: `credit_card`, `loan`, `other`

Names are unique without regard to case. Type is immutable; subtype may only change within the
same type.

```bash
finance-tracker account add --name "Everyday checking" --type asset --subtype cash \
  --balance 1500 --date 2026-01-01
finance-tracker account add --name "Rewards card" --type liability --subtype credit_card \
  --balance 350 --date 2026-01-01
finance-tracker account list --as-of 2026-07-31
finance-tracker account edit 1 --name "Main checking" --subtype cash
```

Account creation and its read-only opening activity are one transaction. Later balances are never
stored as mutable account fields; they are calculated by applying ordered activity.

Record an observed balance as an adjustment:

```bash
finance-tracker account adjust 1 2175.42 --date 2026-07-16 \
  --description "Bank balance"
finance-tracker activity list --account 1
```

An adjustment's amount is the observed balance. Its displayed balance effect is the difference
from the previously calculated balance. An adjustment remains authoritative even if earlier
activity is edited or removed.

Derived negative balances are valid. A negative asset is `overdrawn`; a negative liability is a
`credit_balance`.

Archive only after the calculated closing balance is zero and no later activity exists:

```bash
finance-tracker account archive 1 --date 2026-07-31 --confirm
```

Permanent deletion is limited to an active account with no activity beyond its opening:

```bash
finance-tracker account delete 3 --confirm
```

## Activity

Income and expenses require one account and category:

```bash
finance-tracker activity add income 4200 --account 1 --category Salary \
  --description "Monthly salary" --date 2026-07-01
finance-tracker activity add expense 82.35 --account 1 --category Food \
  --description "Groceries" --date 2026-07-09
```

Liability arithmetic follows economic meaning: an expense increases the amount owed and an income
or refund reduces it. Income always increases net worth and expense always decreases it.

Transfers require distinct accounts:

```bash
finance-tracker activity transfer 500 --from-account 1 --to-account 2 \
  --description "Monthly saving" --date 2026-07-10
```

Transfers move equal economic value and have zero net-worth, cashflow, and budget impact.

List and filter the complete ledger:

```bash
finance-tracker activity list
finance-tracker activity list --month 7 --year 2026 --kind expense
finance-tracker activity list --account 2 --search saving
```

Income and expense may be reclassified between each other. Transfer, adjustment, and opening kinds
are immutable; opening entries are entirely read-only.

```bash
finance-tracker activity edit 8 --kind income --amount 42.50 --category Refund
finance-tracker activity delete 8 --confirm
```

## Recurring activity

Income, expense, and transfer templates can recur. Openings and adjustments cannot.

```bash
finance-tracker recurring add expense 1500 --account 1 --category Rent --day 2
finance-tracker recurring add transfer 300 --from-account 1 --to-account 2 --day 5
finance-tracker recurring list
finance-tracker recurring apply --month 7 --year 2026
```

Applying a template is explicit. Generated dates clamp to the month's last day and account-aware
duplicates are skipped.

## Budgets, aliases, and reports

```bash
finance-tracker budget set Food 600 --month 7 --year 2026
finance-tracker budget status --month 7 --year 2026
finance-tracker category set groceries Food
finance-tracker report monthly --month 7 --year 2026
finance-tracker report trends --months 12 --end-month 7 --end-year 2026
finance-tracker report net-worth --as-of 2026-07-16
finance-tracker report net-worth-history --as-of 2026-07-16 --months 12
```

Monthly reports, trends, budgets, and categories consume income/expense only. Net-worth reporting
uses every account posting and attributes change to cashflow, adjustments/valuation changes, and
transfers; transfer attribution reconciles to zero.

## Activity CSV

Required columns, in order:

```text
kind,amount,category,description,date,account,from_account,to_account
```

Rules by kind:

- `income`, `expense`: positive `amount`, `category`, `date`, and `account` name.
- `transfer`: positive `amount`, `date`, distinct `from_account` and `to_account` names.
- `adjustment`: observed balance in `amount`, `date`, and `account` name.
- `opening`: rejected; create the account instead.

```bash
finance-tracker activity import examples/sample_activities.csv --preview
finance-tracker activity import examples/sample_activities.csv
finance-tracker activity import examples/sample_activities.csv --allow-duplicates
finance-tracker activity export exports/activities.csv
finance-tracker activity export exports/checking.csv --account 1
```

Preview resolves names case-insensitively, applies category aliases, identifies account-aware
duplicates, validates kind-specific columns, and displays projected before/after balances.

Budget CSV remains `category,month,year,amount` and uses `budget import|export`.

## Web UI and API

```bash
finance-tracker web --db-path finance.sqlite3
```

Primary routes:

- `/` — monthly overview and recent activity
- `/activity` — canonical unified ledger
- `/budgets` — category plans and status
- `/accounts` — calculated balances, provenance, activity links, and net-worth history

`/transactions` is a query-preserving client redirect to `/activity`. Manage routes contain
recurring activity, category aliases, data movement, and preferences.

The global action is Add activity. Income, expense, and transfer are available there; adjustments
originate from an account's Update balance action. The form requires explicit account selection
unless launched from account context and shows projected account/net-worth/cashflow effects.

FastAPI publishes OpenAPI and canonical endpoints under `/api`, including:

- `GET|POST /api/activities`
- `PUT|DELETE /api/activities/{id}`
- `POST /api/activities/import-csv/preview`
- `POST /api/activities/import-csv`
- `GET /api/activities/export-csv`
- account, budget, recurring, category, report, net-worth, settings, and dashboard resources

Activity create/update uses a discriminator on `kind`; API responses contain semantic
`account`/`from_account`/`to_account` effects and never expose persistence postings.

## Complete-ledger recovery

CSV is portable for activity and budgets. Use SQLite backup for every domain:

```bash
finance-tracker data backup backups/ledger.sqlite3 --db-path finance.sqlite3
finance-tracker data verify backups/ledger.sqlite3
finance-tracker data restore backups/ledger.sqlite3 --db-path finance.sqlite3 --confirm
```

Verification checks schema version 3, required tables/indexes/foreign keys, SQLite integrity, and
foreign-key integrity before restore replaces the active ledger.

## Demo and development

```bash
.venv/bin/python examples/build_demo.py --db-path demo.sqlite3 --force
finance-tracker web --db-path demo.sqlite3
```

For frontend development, run FastAPI on port 8000 and `npm run dev` separately; Vite serves on
`127.0.0.1:5173` and proxies `/api`.

Verification commands are listed in the root `AGENTS.md` and `docs/RELEASE_CHECKLIST.md`.
