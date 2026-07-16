"""Account and balance snapshot HTTP routes."""

from datetime import date

from fastapi import APIRouter, Query, Request, status

from finance_tracker.exceptions import ValidationError
from finance_tracker.web.dependencies import account_service, settings_service
from finance_tracker.web.responses import account_response, balance_snapshot_response
from finance_tracker.web.schemas import (
    AccountArchiveRequest,
    AccountCreateRequest,
    AccountListResponse,
    AccountMutationResponse,
    AccountPatchRequest,
    BalanceSnapshotListResponse,
    BalanceSnapshotMutationResponse,
    BalanceSnapshotRequest,
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
    request: Request,
    as_of: date | None = None,
    include_archived: bool = False,
) -> AccountListResponse:
    currency = settings_service(request).get_currency()
    accounts = account_service(request).list_accounts(
        as_of,
        include_archived=include_archived,
    )
    return AccountListResponse(
        accounts=[account_response(item, currency) for item in accounts]
    )


@router.post(
    "/api/accounts",
    response_model=AccountMutationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
)
def create_account(
    request: Request,
    payload: AccountCreateRequest,
) -> AccountMutationResponse:
    service = account_service(request)
    account = service.create_account(
        payload.name,
        payload.type,
        payload.initial_balance,
        payload.initial_balance_date,
    )
    item = next(
        item
        for item in service.list_accounts(include_archived=True)
        if item.account.id == account.id
    )
    return AccountMutationResponse(
        notice="Account added with its initial balance.",
        notice_code="account.created",
        account=account_response(item, settings_service(request).get_currency()),
    )


@router.patch(
    "/api/accounts/{account_id}",
    response_model=AccountMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def patch_account(
    request: Request,
    account_id: int,
    payload: AccountPatchRequest,
) -> AccountMutationResponse:
    if payload.name is None:
        raise ValidationError("Account name is required.")
    service = account_service(request)
    service.edit_account_name(account_id, payload.name)
    item = next(
        item
        for item in service.list_accounts(include_archived=True)
        if item.account.id == account_id
    )
    return AccountMutationResponse(
        notice="Account name updated.",
        notice_code="account.updated",
        account=account_response(item, settings_service(request).get_currency()),
    )


@router.delete(
    "/api/accounts/{account_id}",
    response_model=NoticeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def delete_account(
    request: Request,
    account_id: int,
    confirm: bool = Query(default=False),
) -> NoticeResponse:
    if not confirm:
        raise ValidationError("Account deletion requires confirm=true.")
    account_service(request).delete_account(account_id)
    return NoticeResponse(
        notice="Account and its initial balance were permanently deleted.",
        notice_code="account.deleted",
    )


@router.post(
    "/api/accounts/{account_id}/archive",
    response_model=AccountMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def archive_account(
    request: Request,
    account_id: int,
    payload: AccountArchiveRequest,
) -> AccountMutationResponse:
    service = account_service(request)
    service.archive_account(
        account_id,
        payload.closing_date,
        confirm_zero_balance=payload.confirm_zero_balance,
    )
    item = next(
        item
        for item in service.list_accounts(include_archived=True)
        if item.account.id == account_id
    )
    return AccountMutationResponse(
        notice="Account archived with a closing zero balance.",
        notice_code="account.archived",
        account=account_response(item, settings_service(request).get_currency()),
    )


@router.get(
    "/api/accounts/{account_id}/balance-snapshots",
    response_model=BalanceSnapshotListResponse,
    responses={404: {"model": ErrorResponse}},
)
def list_balance_snapshots(
    request: Request,
    account_id: int,
) -> BalanceSnapshotListResponse:
    currency = settings_service(request).get_currency()
    snapshots = account_service(request).list_snapshots(account_id)
    return BalanceSnapshotListResponse(
        balance_snapshots=[
            balance_snapshot_response(snapshot, currency) for snapshot in snapshots
        ]
    )


@router.put(
    "/api/accounts/{account_id}/balance-snapshots/{effective_date}",
    response_model=BalanceSnapshotMutationResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def set_balance_snapshot(
    request: Request,
    account_id: int,
    effective_date: date,
    payload: BalanceSnapshotRequest,
) -> BalanceSnapshotMutationResponse:
    result = account_service(request).set_balance(
        account_id,
        payload.amount,
        effective_date,
    )
    return BalanceSnapshotMutationResponse(
        notice=(
            "Balance for this date was replaced."
            if result.replaced
            else "Balance snapshot recorded."
        ),
        notice_code=(
            "balance_snapshot.updated"
            if result.replaced
            else "balance_snapshot.created"
        ),
        snapshot=balance_snapshot_response(
            result.snapshot,
            settings_service(request).get_currency(),
        ),
    )


@router.delete(
    "/api/accounts/{account_id}/balance-snapshots/{effective_date}",
    response_model=NoticeResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def delete_balance_snapshot(
    request: Request,
    account_id: int,
    effective_date: date,
    confirm: bool = Query(default=False),
) -> NoticeResponse:
    if not confirm:
        raise ValidationError("Balance snapshot deletion requires confirm=true.")
    account_service(request).delete_snapshot(account_id, effective_date)
    return NoticeResponse(
        notice="Balance snapshot permanently deleted.",
        notice_code="balance_snapshot.deleted",
    )
