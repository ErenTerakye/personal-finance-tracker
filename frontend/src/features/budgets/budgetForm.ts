import type { BudgetFilters } from "../../api/client";
import type { BudgetInput } from "../../types";

export function defaultBudget(period: {
  month: number;
  year: number;
}): BudgetInput {
  return { category: "", amount: "", month: period.month, year: period.year };
}

export function readBudgetFilters(period: {
  month: number;
  year: number;
}): BudgetFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    month: numberParam(params.get("month"), period.month),
    year: numberParam(params.get("year"), period.year),
    category: params.get("category") ?? "",
  };
}

export function writeBudgetFilters(filters: BudgetFilters) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(filters)) {
    if (value === "" || value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function numberParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
