# Project Plan

## Purpose

Personal Finance Tracker is a portfolio-ready Python application for recording income and expenses, storing records in SQLite, moving data through CSV files, producing monthly financial reports, and presenting the same local data in a browser-based dashboard.

The project is intentionally local-first and easy to run. It demonstrates Python packaging, CLI design, object-oriented domain modeling, persistence, CSV processing, testing, data visualization, a FastAPI JSON API, and a React + Vite Web UI.

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
- `web/` owns the FastAPI JSON API and static SPA hosting.
- `frontend/` owns the React + Vite + TypeScript browser app.

SQL should stay in repository/database modules. Business validation should stay in models/services. CLI commands should stay thin and user-facing. Web routes should call the same service and report layers rather than duplicating business rules.

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
- `web`: run the local FastAPI Web UI.

Database path defaults to `./data/finance_tracker.sqlite3`, which is local runtime state and ignored by git. Users can override it with `--db-path` or `FINANCE_TRACKER_DB`; reproducible demos should use the CSV examples imported into a separate `demo.sqlite3`.

## Web UI

The Web UI is an intentional scope expansion from the original CLI-first milestone while preserving the local-first architecture. It runs with:

```bash
finance-tracker web --host 127.0.0.1 --port 8000
```

The Python app exposes JSON endpoints under `/api` and serves the compiled React SPA for browser routes. During development, Vite can run separately against the same local API.

Supported browser workflows:

- Personal Finance Tracker dashboard with a six-month cashflow trend, compact period controls, monthly KPI cards, functional browser-rendered charts, recent transactions, budget pressure, and category mix.
- Route-aware SPA navigation for `/`, `/transactions`, and `/budgets`.
- Transaction add, edit, delete, and filtering through native dialog workflows.
- Budget set/update, delete, filtering, and budget status comparison with pressure as the primary view.

Browser support policy: target modern Baseline-capable browsers as of June 2026. Newly available platform features, such as native dialogs and popovers, SVG chart affordances, container queries, color-scheme-aware dark mode, same-document view transitions, and reduced-motion-aware animation, are allowed when they are progressive enhancements and the core local CRUD workflows remain usable without large polyfills.

The live Web UI is not designed for GitHub Pages because Pages only serves static files. The repository can include a static showcase page for portfolio presentation, but live CRUD requires running the local Python server.

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

The current milestone is a 2026-quality local Web UI over the existing SQLite/service/report foundation. It should remain a portfolio-scale app: no authentication, cloud sync, background workers, or hosted database unless the project scope changes again.

Future improvements can build from this foundation with recurring transaction templates, richer category analysis, CSV import/export from the browser, or downloadable chart artifacts.

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
- Web API dashboard data, form validation feedback, CRUD flows, and filters.
- React dashboard, route navigation, transaction/budget dialog workflows, delete-dialog, API-client, and SVG chart behavior.
- CLI smoke flows through Typer's test runner.
- GitHub Actions should run pytest and Ruff on Python 3.14.
