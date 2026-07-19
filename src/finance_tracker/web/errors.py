"""JSON exception translation for the HTTP adapter."""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from finance_tracker.exceptions import (
    AccountNotFoundError,
    ActivityNotFoundError,
    BudgetNotFoundError,
    CategoryRuleNotFoundError,
    FinanceTrackerError,
    RecurringTemplateNotFoundError,
    TransactionNotFoundError,
)


def error_response(
    status_code: int,
    code: str,
    message: str,
    fields: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "fields": fields}},
    )


async def handle_finance_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, FinanceTrackerError):
        raise exc
    status_code = (
        status.HTTP_404_NOT_FOUND
        if isinstance(
            exc,
            (
                AccountNotFoundError,
                ActivityNotFoundError,
                BudgetNotFoundError,
                CategoryRuleNotFoundError,
                RecurringTemplateNotFoundError,
                TransactionNotFoundError,
            ),
        )
        else status.HTTP_400_BAD_REQUEST
    )
    code = "not_found" if status_code == status.HTTP_404_NOT_FOUND else "validation_error"
    return error_response(status_code, code, str(exc))


async def handle_request_validation(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc
    fields = {
        ".".join(str(part) for part in item["loc"] if part != "body"): item["msg"]
        for item in exc.errors()
    }
    return error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "request_validation_error",
        "The request contains invalid fields.",
        fields or None,
    )


async def handle_http_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        raise exc
    detail = exc.detail
    if isinstance(detail, dict):
        message = str(detail.get("error") or detail.get("message") or "Request failed.")
    else:
        message = str(detail)
    code = {
        status.HTTP_413_CONTENT_TOO_LARGE: "upload_too_large",
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
    }.get(exc.status_code, "http_error")
    return error_response(exc.status_code, code, message)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(FinanceTrackerError, handle_finance_error)
    app.add_exception_handler(RequestValidationError, handle_request_validation)
    app.add_exception_handler(HTTPException, handle_http_error)
