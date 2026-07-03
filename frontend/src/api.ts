import type {
  ApiErrorBody,
  BudgetInput,
  BudgetMutationResponse,
  BudgetRecord,
  BudgetStatus,
  DashboardData,
  ImportSummary,
  NoticeResponse,
  TransactionInput,
  TransactionMutationResponse,
  TransactionPatch,
  TransactionRecord,
  TransactionType
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface TransactionFilters {
  month?: number | "";
  year?: number | "";
  category?: string;
  transaction_type?: TransactionType | "";
}

export interface BudgetFilters {
  month?: number | "";
  year?: number | "";
  category?: string;
}

export const api = {
  dashboard: (month: number, year: number) =>
    request<DashboardData>(`/api/dashboard?${query({ month, year })}`),

  transactions: (filters: TransactionFilters = {}) =>
    request<{ transactions: TransactionRecord[] }>(`/api/transactions?${query(filters)}`),

  importTransactionsCsv: (csvText: string) =>
    request<ImportSummary>("/api/transactions/import-csv", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" }
    }),

  transactionCsvExportUrl: (filters: TransactionFilters = {}) =>
    `/api/transactions/export-csv?${query(filters)}`,

  createTransaction: (payload: TransactionInput) =>
    request<TransactionMutationResponse>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  updateTransaction: (id: number, payload: TransactionPatch) =>
    request<TransactionMutationResponse>(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  deleteTransaction: (id: number) =>
    request<NoticeResponse>(`/api/transactions/${id}`, { method: "DELETE" }),

  budgets: (filters: BudgetFilters = {}) =>
    request<{ budgets: BudgetRecord[] }>(`/api/budgets?${query(filters)}`),

  importBudgetsCsv: (csvText: string) =>
    request<ImportSummary>("/api/budgets/import-csv", {
      method: "POST",
      body: csvText,
      headers: { "Content-Type": "text/csv; charset=utf-8" }
    }),

  budgetCsvExportUrl: (filters: BudgetFilters = {}) =>
    `/api/budgets/export-csv?${query(filters)}`,

  setBudget: (payload: BudgetInput) =>
    request<BudgetMutationResponse>("/api/budgets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  budgetStatuses: (month: number, year: number) =>
    request<{ statuses: BudgetStatus[] }>(`/api/budgets/status?${query({ month, year })}`),

  deleteBudget: (id: number) => request<NoticeResponse>(`/api/budgets/${id}`, { method: "DELETE" })
};

export const artifactUrls = {
  monthlyReport: (month: number, year: number) =>
    `/api/reports/monthly.txt?${query({ month, year })}`,
  trendReport: (month: number, year: number, months = 6) =>
    `/api/reports/trends.txt?${query({ months, end_month: month, end_year: year })}`,
  monthlyChart: (month: number, year: number) =>
    `/api/charts/monthly.png?${query({ month, year })}`,
  trendChart: (month: number, year: number, months = 6) =>
    `/api/charts/trends.png?${query({ months, end_month: month, end_year: year })}`
};

export function query(values: object): string {
  const params = new URLSearchParams();
  Object.entries(values as Record<string, string | number | undefined | null>).forEach(([key, value]) => {
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
      ...init.headers
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(readError(body), response.status);
  }
  return body as T;
}

function readError(body: ApiErrorBody): string {
  if (body.error) {
    return body.error;
  }
  if (typeof body.detail === "string") {
    return body.detail;
  }
  if (body.detail?.error) {
    return body.detail.error;
  }
  return "The request could not be completed.";
}
