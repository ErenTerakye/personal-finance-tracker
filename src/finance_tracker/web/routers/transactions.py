"""Transaction CRUD and CSV routes."""

from typing import Literal

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import Response

from finance_tracker.csv_io import (
    export_transactions_csv_text,
    import_transactions_csv_text,
    preview_transactions_csv_text,
)
from finance_tracker.web.dependencies import request_csv_text, transaction_service
from finance_tracker.web.responses import (
    download_response,
    import_summary_response,
    period_filename,
    transaction_import_preview_response,
    transaction_response,
)
from finance_tracker.web.schemas import (
    ErrorResponse,
    ImportSummaryResponse,
    NoticeResponse,
    PageResponse,
    TransactionImportPreviewResponse,
    TransactionListResponse,
    TransactionMutationResponse,
    TransactionPatchRequest,
    TransactionRequest,
)

router = APIRouter()


@router.get(
    "/api/transactions",
    response_model=TransactionListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_transactions(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    transaction_type: Literal["income", "expense"] | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
) -> TransactionListResponse:
    transactions, total = transaction_service(request).list_transactions_page(
        month=month,
        year=year,
        category=category or None,
        transaction_type=transaction_type,
        limit=limit,
        offset=offset,
    )
    return TransactionListResponse(
        transactions=[transaction_response(item) for item in transactions],
        page=PageResponse(limit=limit, offset=offset, total=total),
    )


@router.post(
    "/api/transactions/import-csv",
    response_model=ImportSummaryResponse,
    responses={400: {"model": ErrorResponse}},
)
async def import_transactions(
    request: Request,
    allow_duplicates: bool = False,
) -> ImportSummaryResponse:
    csv_text = await request_csv_text(request)
    result = import_transactions_csv_text(
        csv_text,
        transaction_service(request),
        allow_duplicates=allow_duplicates,
    )
    return import_summary_response(
        "csv.transactions.imported", "Transaction CSV import finished.", result
    )


@router.post(
    "/api/transactions/import-csv/preview",
    response_model=TransactionImportPreviewResponse,
    responses={400: {"model": ErrorResponse}},
)
async def preview_transaction_import(request: Request) -> TransactionImportPreviewResponse:
    csv_text = await request_csv_text(request)
    result = preview_transactions_csv_text(csv_text, transaction_service(request))
    return transaction_import_preview_response(result)


@router.get(
    "/api/transactions/export-csv",
    responses={400: {"model": ErrorResponse}},
)
def export_transactions(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    transaction_type: Literal["income", "expense"] | None = None,
) -> Response:
    transactions = transaction_service(request).list_transactions(
        month=month,
        year=year,
        category=category or None,
        transaction_type=transaction_type,
    )
    filename = period_filename("transactions", month, year, "csv")
    return download_response(
        export_transactions_csv_text(transactions),
        filename=filename,
        media_type="text/csv; charset=utf-8",
    )


@router.post(
    "/api/transactions",
    response_model=TransactionMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def create_transaction(
    request: Request,
    payload: TransactionRequest,
) -> TransactionMutationResponse:
    transaction = transaction_service(request).add_transaction(
        transaction_type=payload.type,
        amount=payload.amount,
        category=payload.category,
        description=payload.description,
        transaction_date=payload.date,
    )
    return TransactionMutationResponse(
        notice="Transaction added to the local ledger.",
        notice_code="transaction.created",
        transaction=transaction_response(transaction),
    )


@router.patch(
    "/api/transactions/{transaction_id}",
    response_model=TransactionMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_transaction(
    request: Request,
    transaction_id: int,
    payload: TransactionPatchRequest,
) -> TransactionMutationResponse:
    transaction = transaction_service(request).edit_transaction(
        transaction_id=transaction_id,
        transaction_type=payload.type,
        amount=payload.amount,
        category=payload.category,
        description=payload.description,
        transaction_date=payload.date,
    )
    return TransactionMutationResponse(
        notice="Transaction changes saved.",
        notice_code="transaction.updated",
        transaction=transaction_response(transaction),
    )


@router.delete(
    "/api/transactions/{transaction_id}",
    response_model=NoticeResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_transaction(request: Request, transaction_id: int) -> NoticeResponse:
    transaction_service(request).delete_transaction(transaction_id)
    return NoticeResponse(
        notice="Transaction removed from the local ledger.",
        notice_code="transaction.deleted",
    )
