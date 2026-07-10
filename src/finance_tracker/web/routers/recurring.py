"""Recurring transaction-template routes."""

from fastapi import APIRouter, Request, status

from finance_tracker.web.dependencies import recurring_template_service
from finance_tracker.web.responses import recurring_apply_response, recurring_template_response
from finance_tracker.web.schemas import (
    ErrorResponse,
    NoticeResponse,
    RecurringApplyResponse,
    RecurringTemplateListResponse,
    RecurringTemplateMutationResponse,
    RecurringTemplateRequest,
)

router = APIRouter()


@router.get("/api/recurring-templates", response_model=RecurringTemplateListResponse)
def list_recurring_templates(request: Request) -> RecurringTemplateListResponse:
    templates = recurring_template_service(request).list_templates()
    return RecurringTemplateListResponse(
        templates=[recurring_template_response(template) for template in templates]
    )


@router.post(
    "/api/recurring-templates",
    response_model=RecurringTemplateMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def create_recurring_template(
    request: Request,
    payload: RecurringTemplateRequest,
) -> RecurringTemplateMutationResponse:
    template = recurring_template_service(request).add_template(
        transaction_type=payload.type,
        amount=payload.amount,
        category=payload.category,
        description=payload.description,
        day_of_month=payload.day_of_month,
    )
    return RecurringTemplateMutationResponse(
        notice="Recurring template saved.",
        notice_code="recurring_template.saved",
        template=recurring_template_response(template),
    )


@router.delete(
    "/api/recurring-templates/{template_id}",
    response_model=NoticeResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_recurring_template(request: Request, template_id: int) -> NoticeResponse:
    recurring_template_service(request).delete_template(template_id)
    return NoticeResponse(
        notice="Recurring template removed.", notice_code="recurring_template.deleted"
    )


@router.post(
    "/api/recurring-templates/apply",
    response_model=RecurringApplyResponse,
    responses={400: {"model": ErrorResponse}},
)
def apply_recurring_templates(
    request: Request,
    month: int,
    year: int,
) -> RecurringApplyResponse:
    result = recurring_template_service(request).apply_templates(month=month, year=year)
    return recurring_apply_response(result)
