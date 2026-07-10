"""Category alias-rule routes."""

from fastapi import APIRouter, Request, status

from finance_tracker.web.dependencies import category_rule_service
from finance_tracker.web.responses import category_rule_response
from finance_tracker.web.schemas import (
    CategoryRuleListResponse,
    CategoryRuleMutationResponse,
    CategoryRuleRequest,
    ErrorResponse,
    NoticeResponse,
)

router = APIRouter()


@router.get("/api/category-rules", response_model=CategoryRuleListResponse)
def list_category_rules(request: Request) -> CategoryRuleListResponse:
    rules = category_rule_service(request).list_rules()
    return CategoryRuleListResponse(rules=[category_rule_response(rule) for rule in rules])


@router.post(
    "/api/category-rules",
    response_model=CategoryRuleMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def set_category_rule(
    request: Request,
    payload: CategoryRuleRequest,
) -> CategoryRuleMutationResponse:
    rule = category_rule_service(request).set_rule(
        alias=payload.alias,
        category=payload.category,
    )
    return CategoryRuleMutationResponse(
        notice="Category rule saved.",
        notice_code="category_rule.saved",
        rule=category_rule_response(rule),
    )


@router.delete(
    "/api/category-rules/{rule_id}",
    response_model=NoticeResponse,
    responses={404: {"model": ErrorResponse}},
)
def delete_category_rule(request: Request, rule_id: int) -> NoticeResponse:
    category_rule_service(request).delete_rule(rule_id)
    return NoticeResponse(notice="Category rule removed.", notice_code="category_rule.deleted")
