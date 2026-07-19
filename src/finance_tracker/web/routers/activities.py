"""Paginated activity CRUD and account-aware CSV routes."""

from typing import Literal

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import Response

from finance_tracker.csv_io import (
    export_activities_csv_text,
    import_activities_csv_text,
    preview_activities_csv_text,
)
from finance_tracker.web.dependencies import activity_service, request_csv_text
from finance_tracker.web.responses import (
    activity_import_preview_response,
    activity_response,
    download_response,
    import_summary_response,
    period_filename,
)
from finance_tracker.web.schemas import (
    ActivityImportPreviewResponse,
    ActivityListResponse,
    ActivityMutationResponse,
    ActivityRequest,
    AdjustmentActivityRequest,
    ErrorResponse,
    ImportSummaryResponse,
    IncomeExpenseActivityRequest,
    NoticeResponse,
    PageResponse,
    TransferActivityRequest,
)

router = APIRouter()


@router.get(
    "/api/activities",
    response_model=ActivityListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_activities(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    kind: Literal["opening", "income", "expense", "transfer", "adjustment"] | None = None,
    account_id: int | None = None,
    search: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ActivityListResponse:
    page = activity_service(request).list_activities_page(
        month=month,
        year=year,
        category=category or None,
        kind=kind,
        account_id=account_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return ActivityListResponse(
        activities=[activity_response(item) for item in page.activities],
        page=PageResponse(limit=page.limit, offset=page.offset, total=page.total),
    )


@router.post(
    "/api/activities/import-csv",
    response_model=ImportSummaryResponse,
    responses={400: {"model": ErrorResponse}},
)
async def import_activities(
    request: Request, allow_duplicates: bool = False
) -> ImportSummaryResponse:
    result = import_activities_csv_text(
        await request_csv_text(request),
        activity_service(request),
        allow_duplicates=allow_duplicates,
    )
    return import_summary_response(
        "csv.activities.imported", "Activity CSV import finished.", result
    )


@router.post(
    "/api/activities/import-csv/preview",
    response_model=ActivityImportPreviewResponse,
    responses={400: {"model": ErrorResponse}},
)
async def preview_activity_import(request: Request) -> ActivityImportPreviewResponse:
    preview = preview_activities_csv_text(
        await request_csv_text(request), activity_service(request)
    )
    return activity_import_preview_response(preview)


@router.get(
    "/api/activities/export-csv",
    responses={400: {"model": ErrorResponse}},
)
def export_activities(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    kind: Literal["opening", "income", "expense", "transfer", "adjustment"] | None = None,
    account_id: int | None = None,
    search: str | None = None,
) -> Response:
    records = activity_service(request).list_activities(
        month=month,
        year=year,
        category=category or None,
        kind=kind,
        account_id=account_id,
        search=search,
    )
    return download_response(
        export_activities_csv_text(records),
        period_filename("activities", month, year, "csv"),
        "text/csv; charset=utf-8",
    )


@router.post(
    "/api/activities",
    response_model=ActivityMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def create_activity(request: Request, payload: ActivityRequest) -> ActivityMutationResponse:
    service = activity_service(request)
    if isinstance(payload, IncomeExpenseActivityRequest):
        record = service.add_activity(
            payload.kind,
            payload.amount,
            payload.category,
            payload.description,
            payload.date,
            payload.account_id,
        )
    elif isinstance(payload, TransferActivityRequest):
        record = service.add_transfer(
            payload.amount,
            payload.description,
            payload.date,
            payload.from_account_id,
            payload.to_account_id,
        )
    else:
        assert isinstance(payload, AdjustmentActivityRequest)
        record = service.adjust_account(
            payload.account_id,
            payload.amount,
            payload.date,
            payload.description,
        )
    return ActivityMutationResponse(
        notice="Activity added to the local ledger.",
        notice_code="activity.created",
        activity=activity_response(record),
    )


@router.put(
    "/api/activities/{activity_id}",
    response_model=ActivityMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def update_activity(
    request: Request, activity_id: int, payload: ActivityRequest
) -> ActivityMutationResponse:
    if isinstance(payload, IncomeExpenseActivityRequest):
        record = activity_service(request).edit_activity(
            activity_id,
            kind=payload.kind,
            amount=payload.amount,
            description=payload.description,
            activity_date=payload.date,
            category=payload.category,
            account_id=payload.account_id,
        )
    elif isinstance(payload, TransferActivityRequest):
        record = activity_service(request).edit_activity(
            activity_id,
            kind=payload.kind,
            amount=payload.amount,
            description=payload.description,
            activity_date=payload.date,
            from_account_id=payload.from_account_id,
            to_account_id=payload.to_account_id,
        )
    else:
        assert isinstance(payload, AdjustmentActivityRequest)
        record = activity_service(request).edit_activity(
            activity_id,
            kind=payload.kind,
            amount=payload.amount,
            description=payload.description,
            activity_date=payload.date,
            account_id=payload.account_id,
        )
    return ActivityMutationResponse(
        notice="Activity changes saved.",
        notice_code="activity.updated",
        activity=activity_response(record),
    )


@router.delete(
    "/api/activities/{activity_id}",
    response_model=NoticeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def delete_activity(request: Request, activity_id: int) -> NoticeResponse:
    activity_service(request).delete_activity(activity_id)
    return NoticeResponse(
        notice="Activity removed from the local ledger.",
        notice_code="activity.deleted",
    )
