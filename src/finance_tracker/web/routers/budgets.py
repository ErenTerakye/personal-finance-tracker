"""Budget CRUD, status, and CSV routes."""

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import Response

from finance_tracker.csv_io import (
    export_budgets_csv_text,
    import_budgets_csv_text,
)
from finance_tracker.web.dependencies import budget_service, request_csv_text
from finance_tracker.web.responses import (
    budget_response,
    budget_status_response,
    download_response,
    import_summary_response,
    period_filename,
)
from finance_tracker.web.schemas import (
    BudgetListResponse,
    BudgetMutationResponse,
    BudgetRequest,
    BudgetStatusListResponse,
    ErrorResponse,
    ImportSummaryResponse,
    NoticeResponse,
    PageResponse,
)

router = APIRouter()


@router.get(
    "/api/budgets",
    response_model=BudgetListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_budgets(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
) -> BudgetListResponse:
    budgets, total = budget_service(request).list_budgets_page(
        month=month,
        year=year,
        category=category or None,
        limit=limit,
        offset=offset,
    )
    return BudgetListResponse(
        budgets=[budget_response(item) for item in budgets],
        page=PageResponse(limit=limit, offset=offset, total=total),
    )


@router.post(
    "/api/budgets/import-csv",
    response_model=ImportSummaryResponse,
    responses={400: {"model": ErrorResponse}},
)
async def import_budgets(request: Request) -> ImportSummaryResponse:
    csv_text = await request_csv_text(request)
    result = import_budgets_csv_text(csv_text, budget_service(request))
    return import_summary_response("csv.budgets.imported", "Budget CSV import finished.", result)


@router.get(
    "/api/budgets/export-csv",
    responses={400: {"model": ErrorResponse}},
)
def export_budgets(
    request: Request,
    month: int | None = None,
    year: int | None = None,
    category: str | None = None,
) -> Response:
    budgets = budget_service(request).list_budgets(
        month=month,
        year=year,
        category=category or None,
    )
    filename = period_filename("budgets", month, year, "csv")
    return download_response(
        export_budgets_csv_text(budgets),
        filename=filename,
        media_type="text/csv; charset=utf-8",
    )


@router.post(
    "/api/budgets",
    response_model=BudgetMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def set_budget(request: Request, payload: BudgetRequest) -> BudgetMutationResponse:
    budget = budget_service(request).set_budget(
        category=payload.category,
        amount=payload.amount,
        month=payload.month,
        year=payload.year,
    )
    return BudgetMutationResponse(
        notice="Budget saved for the selected month.",
        notice_code="budget.saved",
        budget=budget_response(budget),
    )


@router.get(
    "/api/budgets/status",
    response_model=BudgetStatusListResponse,
    responses={400: {"model": ErrorResponse}},
)
def budget_status(request: Request, month: int, year: int) -> BudgetStatusListResponse:
    statuses = budget_service(request).budget_statuses(month=month, year=year)
    return BudgetStatusListResponse(statuses=[budget_status_response(item) for item in statuses])


@router.delete(
    "/api/budgets/{budget_id}",
    response_model=NoticeResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_budget(request: Request, budget_id: int) -> NoticeResponse:
    budget_service(request).delete_budget(budget_id)
    return NoticeResponse(
        notice="Budget removed from the local ledger.", notice_code="budget.deleted"
    )
