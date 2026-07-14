"""FastAPI application composition for the local finance tracker."""

from pathlib import Path

from fastapi import FastAPI

from finance_tracker.config import resolve_db_path
from finance_tracker.web.dependencies import initialize_web_database
from finance_tracker.web.errors import install_error_handlers
from finance_tracker.web.middleware import security_headers
from finance_tracker.web.routers import ROUTERS
from finance_tracker.web.static import mount_spa


def create_app(db_path: Path | str | None = None) -> FastAPI:
    """Construct the frozen JSON API and packaged SPA host."""

    resolved_db_path = resolve_db_path(db_path)
    initialize_web_database(resolved_db_path)
    app = FastAPI(title="Personal Finance Tracker", version="1.1.0")
    app.state.db_path = resolved_db_path
    app.middleware("http")(security_headers)
    install_error_handlers(app)
    for router in ROUTERS:
        app.include_router(router)
    mount_spa(app)
    return app
