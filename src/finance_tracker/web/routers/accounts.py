"""Account lifecycle HTTP routes."""

from datetime import date

from fastapi import APIRouter, Query, Request, status

from finance_tracker.exceptions import ValidationError
from finance_tracker.web.dependencies import account_service, settings_service
from finance_tracker.web.responses import account_response
from finance_tracker.web.schemas import (
    AccountArchiveRequest,
    AccountCreateRequest,
    AccountListResponse,
    AccountMutationResponse,
    AccountPatchRequest,
    ErrorResponse,
    NoticeResponse,
)

router = APIRouter()


@router.get(
    "/api/accounts",
    response_model=AccountListResponse,
    responses={400: {"model": ErrorResponse}},
)
def list_accounts(
    request: Request, as_of: date | None = None, include_archived: bool = False
) -> AccountListResponse:
    currency = settings_service(request).get_currency()
    items = account_service(request).list_accounts(as_of, include_archived=include_archived)
    return AccountListResponse(accounts=[account_response(item, currency) for item in items])


@router.post(
    "/api/accounts",
    response_model=AccountMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def create_account(request: Request, payload: AccountCreateRequest) -> AccountMutationResponse:
    service = account_service(request)
    account = service.create_account(
        payload.name,
        payload.type,
        payload.opening_balance,
        payload.opening_date,
        payload.subtype,
    )
    assert account.id is not None
    resolved = service.get_resolved_account(account.id)
    return AccountMutationResponse(
        notice="Account added with its opening activity.",
        notice_code="account.created",
        account=account_response(resolved, settings_service(request).get_currency()),
    )


@router.patch(
    "/api/accounts/{account_id}",
    response_model=AccountMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def patch_account(
    request: Request, account_id: int, payload: AccountPatchRequest
) -> AccountMutationResponse:
    if payload.name is None and payload.subtype is None:
        raise ValidationError("Provide an account name or subtype to update.")
    service = account_service(request)
    service.edit_account(account_id, name=payload.name, subtype=payload.subtype)
    resolved = service.get_resolved_account(account_id)
    return AccountMutationResponse(
        notice="Account updated.",
        notice_code="account.updated",
        account=account_response(resolved, settings_service(request).get_currency()),
    )


@router.delete(
    "/api/accounts/{account_id}",
    response_model=NoticeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def delete_account(
    request: Request, account_id: int, confirm: bool = Query(default=False)
) -> NoticeResponse:
    if not confirm:
        raise ValidationError("Account deletion requires confirm=true.")
    account_service(request).delete_account(account_id)
    return NoticeResponse(
        notice="Account and its opening activity were permanently deleted.",
        notice_code="account.deleted",
    )


@router.post(
    "/api/accounts/{account_id}/archive",
    response_model=AccountMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def archive_account(
    request: Request, account_id: int, payload: AccountArchiveRequest
) -> AccountMutationResponse:
    service = account_service(request)
    service.archive_account(account_id, payload.closing_date)
    resolved = service.get_resolved_account(account_id, payload.closing_date)
    return AccountMutationResponse(
        notice="Zero-balance account archived.",
        notice_code="account.archived",
        account=account_response(resolved, settings_service(request).get_currency()),
    )
