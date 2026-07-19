import type {
  AccountInput,
  AccountCreateInput,
  AccountMutationResponse,
  AccountRecord,
  BalanceSnapshot,
  BalanceCheckInResponse,
  BalanceSnapshotMutationResponse,
  ApiErrorBody,
  ActivityImportPreview,
  ActivityInput,
  ActivityMutationResponse,
  ActivityRecord,
  ActivityKind,
  BudgetInput,
  BudgetMutationResponse,
  BudgetRecord,
  BudgetStatus,
  CategoryRule,
  CategoryRuleInput,
  CategoryRuleMutationResponse,
  DashboardData,
  ImportSummary,
  NoticeResponse,
  NetWorthHistory,
  NetWorthOverview,
  NetWorthSummary,
  PageMetadata,
  RecurringApplyResponse,
  RecurringTemplate,
  RecurringTemplateInput,
  RecurringTemplateMutationResponse,
  TransactionInput,
  TransactionImportPreview,
  TransactionMutationResponse,
  TransactionPatch,
  TransactionRecord,
  TransactionType,
} from "../types";
import { ApiError, normalizeApiError } from "./errors";

export { ApiError } from "./errors";

export interface TransactionFilters {
  month?: number | "";
  year?: number | "";
  category?: string;
  transaction_type?: TransactionType | "";
}

export interface ActivityFilters {
  month?: number | "";
  year?: number | "";
  category?: string;
  kind?: ActivityKind | "";
  account_id?: number | "";
  search?: string;
}

export interface BudgetFilters {
  month?: number | "";
  year?: number | "";
  category?: string;
}

export interface AccountFilters {
  as_of?: string;
  include_archived?: boolean;
}

export const api = {
  dashboard: (month: number, year: number, signal?: AbortSignal) =>
    request<DashboardData>(`/api/dashboard?${query({ month, year })}`, {
      signal,
    }),

  accounts: (filters: AccountFilters = {}, signal?: AbortSignal) =>
    request<{ accounts: AccountRecord[] }>(`/api/accounts?${query(filters)}`, {
      signal,
    }),

  createAccount: (payload: AccountInput | AccountCreateInput) =>
    request<AccountMutationResponse>("/api/accounts", {
      method: "POST",
      body: JSON.stringify(normalizeAccountInput(payload)),
    }),

  updateAccount: (
    id: number,
    payload: { name?: string; subtype?: AccountCreateInput["subtype"] },
  ) =>
    request<AccountMutationResponse>(`/api/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteAccount: (id: number) =>
    request<NoticeResponse>(`/api/accounts/${id}?confirm=true`, {
      method: "DELETE",
    }),

  archiveAccount: (
    id: number,
    payload: { closing_date: string; confirm_zero_balance?: boolean },
  ) =>
    request<AccountMutationResponse>(`/api/accounts/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ closing_date: payload.closing_date }),
    }),

  balanceSnapshots: (id: number, signal?: AbortSignal) =>
    request<{ balance_snapshots: BalanceSnapshot[] }>(
      `/api/accounts/${id}/balance-snapshots`,
      { signal },
    ),

  setBalanceSnapshot: (id: number, effectiveDate: string, amount: string) =>
    request<BalanceSnapshotMutationResponse>(
      `/api/accounts/${id}/balance-snapshots/${effectiveDate}`,
      {
        method: "PUT",
        body: JSON.stringify({ amount }),
      },
    ),

  deleteBalanceSnapshot: (id: number, effectiveDate: string) =>
    request<NoticeResponse>(
      `/api/accounts/${id}/balance-snapshots/${effectiveDate}?confirm=true`,
      { method: "DELETE" },
    ),

  netWorth: (asOf?: string, signal?: AbortSignal) =>
    request<NetWorthSummary>(`/api/net-worth?${query({ as_of: asOf })}`, {
      signal,
    }),

  netWorthHistory: (months: number, asOf?: string, signal?: AbortSignal) =>
    request<NetWorthHistory>(
      `/api/net-worth/history?${query({ as_of: asOf, months })}`,
      { signal },
    ),

  netWorthOverview: (
    months: number,
    asOf?: string,
    includeArchived = false,
    signal?: AbortSignal,
  ) =>
    request<NetWorthOverview>(
      `/api/net-worth/overview?${query({
        as_of: asOf,
        months,
        include_archived: includeArchived,
      })}`,
      { signal },
    ),

  checkInBalances: (
    effectiveDate: string,
    updates: { account_id: number; amount: string }[],
  ) =>
    request<BalanceCheckInResponse>(
      `/api/accounts/balance-check-ins/${effectiveDate}`,
      {
        method: "PUT",
        body: JSON.stringify({ updates }),
      },
    ),

  activities: (filters: ActivityFilters = {}, signal?: AbortSignal) =>
    request<{ activities: ActivityRecord[]; page: PageMetadata }>(
      `/api/activities?${query(filters)}`,
      { signal },
    ),

  previewActivitiesCsv: (csvText: string) =>
    request<ActivityImportPreview>("/api/activities/import-csv/preview", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    }),

  importActivitiesCsv: (csvText: string, allowDuplicates = false) =>
    request<ImportSummary>(
      `/api/activities/import-csv?${query({ allow_duplicates: allowDuplicates })}`,
      {
        method: "POST",
        body: csvText,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      },
    ),

  createActivity: (payload: ActivityInput) =>
    request<ActivityMutationResponse>("/api/activities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateActivity: (id: number, payload: ActivityInput) =>
    request<ActivityMutationResponse>(`/api/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteActivity: (id: number) =>
    request<NoticeResponse>(`/api/activities/${id}`, { method: "DELETE" }),

  transactions: (filters: TransactionFilters = {}, signal?: AbortSignal) =>
    request<{ transactions: TransactionRecord[]; page: PageMetadata }>(
      `/api/transactions?${query(filters)}`,
      { signal },
    ),

  importTransactionsCsv: (csvText: string) =>
    request<ImportSummary>("/api/transactions/import-csv", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    }),

  previewTransactionsCsv: (csvText: string) =>
    request<TransactionImportPreview>("/api/transactions/import-csv/preview", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    }),

  importTransactionsCsvWithOptions: (
    csvText: string,
    allowDuplicates = false,
  ) =>
    request<ImportSummary>(
      `/api/transactions/import-csv?${query({ allow_duplicates: allowDuplicates })}`,
      {
        method: "POST",
        body: csvText,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      },
    ),

  createTransaction: (payload: TransactionInput) =>
    request<TransactionMutationResponse>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTransaction: (id: number, payload: TransactionPatch) =>
    request<TransactionMutationResponse>(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteTransaction: (id: number) =>
    request<NoticeResponse>(`/api/transactions/${id}`, { method: "DELETE" }),

  budgets: (filters: BudgetFilters = {}, signal?: AbortSignal) =>
    request<{ budgets: BudgetRecord[]; page: PageMetadata }>(
      `/api/budgets?${query(filters)}`,
      { signal },
    ),

  importBudgetsCsv: (csvText: string) =>
    request<ImportSummary>("/api/budgets/import-csv", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    }),

  setBudget: (payload: BudgetInput) =>
    request<BudgetMutationResponse>("/api/budgets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  budgetStatuses: (month: number, year: number, signal?: AbortSignal) =>
    request<{ statuses: BudgetStatus[] }>(
      `/api/budgets/status?${query({ month, year })}`,
      { signal },
    ),

  deleteBudget: (id: number) =>
    request<NoticeResponse>(`/api/budgets/${id}`, { method: "DELETE" }),

  categoryRules: (signal?: AbortSignal) =>
    request<{ rules: CategoryRule[] }>("/api/category-rules", { signal }),

  setCategoryRule: (payload: CategoryRuleInput) =>
    request<CategoryRuleMutationResponse>("/api/category-rules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteCategoryRule: (id: number) =>
    request<NoticeResponse>(`/api/category-rules/${id}`, { method: "DELETE" }),

  recurringTemplates: (signal?: AbortSignal) =>
    request<{ templates: RecurringTemplate[] }>("/api/recurring-templates", {
      signal,
    }),

  createRecurringTemplate: (payload: RecurringTemplateInput) =>
    request<RecurringTemplateMutationResponse>("/api/recurring-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteRecurringTemplate: (id: number) =>
    request<NoticeResponse>(`/api/recurring-templates/${id}`, {
      method: "DELETE",
    }),

  applyRecurringTemplates: (month: number, year: number) =>
    request<RecurringApplyResponse>(
      `/api/recurring-templates/apply?${query({ month, year })}`,
      {
        method: "POST",
      },
    ),

  getSettings: (signal?: AbortSignal) =>
    request<{ currency: string }>("/api/settings", { signal }),

  updateSettings: (payload: { currency: string }) =>
    request<NoticeResponse>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

function normalizeAccountInput(
  payload: AccountInput | AccountCreateInput,
): AccountCreateInput {
  if ("opening_balance" in payload) return payload;
  return {
    name: payload.name,
    type: payload.type,
    subtype: "other",
    opening_balance: payload.initial_balance,
    opening_date: payload.initial_balance_date,
  };
}

export function query(values: object): string {
  const params = new URLSearchParams();
  Object.entries(
    values as Record<string, string | number | boolean | undefined | null>,
  ).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(readError(body), response.status);
  }
  return body as T;
}

function readError(body: ApiErrorBody): string {
  if (typeof body.error === "string") {
    return body.error;
  }
  if (body.error?.message) {
    return body.error.message;
  }
  if (typeof body.detail === "string") {
    return body.detail;
  }
  if (body.detail?.error) {
    return body.detail.error;
  }
  return normalizeApiError(body).message;
}
