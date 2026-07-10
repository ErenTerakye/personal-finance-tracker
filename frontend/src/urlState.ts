import type { BudgetFilters, TransactionFilters } from "./api";

export function readTransactionFilters(period: {
  month: number;
  year: number;
}): TransactionFilters {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  return {
    month: positiveNumber(params.get("month")) || period.month,
    year: positiveNumber(params.get("year")) || period.year,
    category: params.get("category") ?? "",
    transaction_type: type === "income" || type === "expense" ? type : "",
  };
}

export function readBudgetFilters(period: {
  month: number;
  year: number;
}): BudgetFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    month: positiveNumber(params.get("month")) || period.month,
    year: positiveNumber(params.get("year")) || period.year,
    category: params.get("category") ?? "",
  };
}

export function writeFilters(
  filters: TransactionFilters | BudgetFilters,
): void {
  const url = new URL(window.location.href);
  const values: Record<string, string | number | undefined> = {
    month: filters.month || undefined,
    year: filters.year || undefined,
    category: filters.category || undefined,
    type:
      "transaction_type" in filters
        ? filters.transaction_type || undefined
        : undefined,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function positiveNumber(value: string | null): number | "" {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : "";
}
