"""Budget request and response schemas."""

from pydantic import Field

from finance_tracker.web.schemas.common import ApiModel, PageResponse


class BudgetRequest(ApiModel):
    category: str = Field(min_length=1, max_length=100)
    amount: str = Field(min_length=1, max_length=64)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=1, le=9999)


class BudgetResponse(ApiModel):
    id: int
    category: str
    amount: str
    month: int
    year: int
    created_at: str | None


class BudgetStatusResponse(ApiModel):
    budget: BudgetResponse
    actual_expenses: str
    remaining: str
    percent_used: str
    status: str


class BudgetListResponse(ApiModel):
    budgets: list[BudgetResponse]
    page: PageResponse


class BudgetMutationResponse(ApiModel):
    notice: str
    notice_code: str
    budget: BudgetResponse


class BudgetStatusListResponse(ApiModel):
    statuses: list[BudgetStatusResponse]
