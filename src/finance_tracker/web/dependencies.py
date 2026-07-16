"""Concrete FastAPI request dependencies."""

from pathlib import Path

from fastapi import HTTPException, Request, status

from finance_tracker.services import (
    AccountService,
    BudgetService,
    CategoryRuleService,
    RecurringTemplateService,
    SettingsService,
    TransactionService,
)

MAX_CSV_BYTES = 5 * 1024 * 1024


def initialize_web_database(db_path: Path) -> None:
    """Initialize the ledger through the public application-service boundary."""

    TransactionService(db_path)


def account_service(request: Request) -> AccountService:
    return AccountService(request.app.state.db_path, initialize=False)


def transaction_service(request: Request) -> TransactionService:
    return TransactionService(request.app.state.db_path, initialize=False)


def budget_service(request: Request) -> BudgetService:
    return BudgetService(request.app.state.db_path, initialize=False)


def category_rule_service(request: Request) -> CategoryRuleService:
    return CategoryRuleService(request.app.state.db_path, initialize=False)


def recurring_template_service(request: Request) -> RecurringTemplateService:
    return RecurringTemplateService(request.app.state.db_path, initialize=False)


def settings_service(request: Request) -> SettingsService:
    return SettingsService(request.app.state.db_path, initialize=False)


async def request_csv_text(request: Request) -> str:
    """Read a bounded UTF-8 CSV request body with the frozen validation behavior."""

    content_type = request.headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
    if content_type not in {"text/csv", "application/csv", "text/plain"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": "CSV upload must use a CSV text content type."},
        )
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={"error": "CSV upload must be 5 MB or smaller."},
        )
    body = await request.body()
    if len(body) > MAX_CSV_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={"error": "CSV upload must be 5 MB or smaller."},
        )
    try:
        return body.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "CSV upload must be UTF-8 text."},
        ) from exc
