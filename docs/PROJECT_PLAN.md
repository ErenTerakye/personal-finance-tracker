# Project Plan

## Purpose

Personal Finance Tracker is a portfolio-ready Python CLI application for recording income and expenses, storing records in SQLite, moving data through CSV files, and producing monthly financial reports.

The project is intentionally local-first and easy to run. It demonstrates Python packaging, CLI design, object-oriented domain modeling, persistence, CSV processing, testing, and data visualization.

## Architecture

The application uses a layered structure:

- `cli.py` owns Typer commands, terminal output, and process exit behavior.
- `models.py` owns domain objects and validation helpers.
- `services.py` coordinates use cases and keeps CLI code away from persistence details.
- `repositories.py` owns SQL queries and maps database rows into domain objects.
- `database.py` owns SQLite connection setup and schema initialization.
- `csv_io.py` owns portable transaction and budget CSV import/export behavior.
- `reports.py` owns monthly and trend report calculations and text formatting.
- `charts.py` owns optional PNG chart generation with matplotlib.

SQL should stay in repository/database modules. Business validation should stay in models/services. CLI commands should stay thin and user-facing.

## Data Model

The first version stores transactions with:

- `id`: SQLite autoincrement primary key
- `type`: `income` or `expense`
- `amount`: positive decimal value stored as text for predictable decimal round-tripping
- `category`: required text label
- `description`: optional text note
- `date`: ISO date string, `YYYY-MM-DD`
- `created_at`: SQLite timestamp

The SQLite schema enforces valid transaction types with a `CHECK` constraint.

Monthly category budgets are stored separately with:

- `id`: SQLite autoincrement primary key
- `category`: required text label matched case-insensitively for status calculations
- `month`: integer month, `1-12`
- `year`: positive integer year
- `amount`: positive decimal value stored as text
- `created_at`: SQLite timestamp

Each category can have one budget per month and year. Setting the same category/month/year again updates the existing budget.

## CLI Commands

Primary command:

```bash
finance-tracker
```

Supported commands:

- `init`: create the database and schema.
- `add`: add an income or expense.
- `edit`: update selected fields on an existing transaction.
- `list`: list transactions with optional filters.
- `delete`: remove a transaction by ID.
- `budget-set`: set or update a monthly category budget.
- `budget-list`: list stored budgets with optional filters.
- `budget-delete`: remove a budget by ID.
- `budget-status`: compare monthly category budgets with actual expenses.
- `summary`: print monthly totals.
- `report`: print monthly totals and optionally save a PNG chart.
- `trends`: print multi-month trend totals and optionally save a PNG chart.
- `import-csv`: import transactions from CSV.
- `export-csv`: export transactions to CSV.
- `import-budgets-csv`: import monthly category budgets from CSV.
- `export-budgets-csv`: export monthly category budgets to CSV.

Database path defaults to `./data/finance_tracker.sqlite3`. Users can override it with `--db-path` or `FINANCE_TRACKER_DB`.

## CSV Format

Transaction CSV files use this header:

```csv
type,amount,category,description,date
```

Budget CSV files use this header:

```csv
category,amount,month,year
```

Invalid data rows are skipped during import and reported to the user. Missing required columns stop the import.

## Suggested Commit Order

1. Add project metadata and source/test directories.
2. Add documentation and agent guidance.
3. Add SQLite schema and repository layer.
4. Add transaction models and service layer.
5. Add Typer CLI commands.
6. Add CSV import/export.
7. Add monthly reports and chart output.
8. Add tests and README polish.

## Current Development Direction

The project should stay CLI-first for the next iteration. A web interface would be a meaningful scope change because it would add routing, browser UI, packaging, and likely a second application boundary. The current pre-web milestone is portfolio polish: monthly category budgets, multi-month trends, and budget CSV import/export provide a reusable local-first data foundation that can later feed a dashboard.

Future CLI-first improvements can build from this foundation with recurring transaction templates, richer category analysis, or a carefully scoped web UI.

## Testing Strategy

Use pytest with temporary SQLite databases. Cover:

- Schema creation.
- Transaction validation and persistence.
- Filtering by month, year, category, and type.
- CSV import/export round trips.
- Budget CSV import/export round trips.
- Monthly budget create/update/delete flows.
- Budget status calculations by category.
- Monthly and trend report calculations.
- Chart output for monthly and trend reports.
- CLI smoke flows through Typer's test runner.
- GitHub Actions should run pytest and Ruff on Python 3.14.
