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
- `csv_io.py` owns portable CSV import/export behavior.
- `reports.py` owns monthly report calculations and text formatting.
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

## CLI Commands

Primary command:

```bash
finance-tracker
```

Supported commands:

- `init`: create the database and schema.
- `add`: add an income or expense.
- `list`: list transactions with optional filters.
- `delete`: remove a transaction by ID.
- `summary`: print monthly totals.
- `report`: print monthly totals and optionally save a PNG chart.
- `import-csv`: import transactions from CSV.
- `export-csv`: export transactions to CSV.

Database path defaults to `./data/finance_tracker.sqlite3`. Users can override it with `--db-path` or `FINANCE_TRACKER_DB`.

## CSV Format

CSV files use this header:

```csv
type,amount,category,description,date
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

## Testing Strategy

Use pytest with temporary SQLite databases. Cover:

- Schema creation.
- Transaction validation and persistence.
- Filtering by month, year, category, and type.
- CSV import/export round trips.
- Monthly report calculations.
- CLI smoke flows through Typer's test runner.
