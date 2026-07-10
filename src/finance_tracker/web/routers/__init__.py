"""FastAPI routers composed by the application factory."""

from finance_tracker.web.routers.budgets import router as budgets_router
from finance_tracker.web.routers.category_rules import router as category_rules_router
from finance_tracker.web.routers.dashboard import router as dashboard_router
from finance_tracker.web.routers.health import router as health_router
from finance_tracker.web.routers.recurring import router as recurring_router
from finance_tracker.web.routers.reports import router as reports_router
from finance_tracker.web.routers.settings import router as settings_router
from finance_tracker.web.routers.transactions import router as transactions_router

ROUTERS = (
    health_router,
    dashboard_router,
    transactions_router,
    budgets_router,
    category_rules_router,
    recurring_router,
    reports_router,
    settings_router,
)

__all__ = ["ROUTERS"]
