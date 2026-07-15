import type { TransactionFilters } from "../../api/client";
import type { TransactionInput } from "../../types";
import { todayIso } from "../../shared/format/dates";

export function defaultTransaction(): TransactionInput {
  return {
    type: "expense",
    amount: "",
    category: "",
    description: "",
    date: todayIso(),
  };
}

const AMOUNT_DRAFT_PATTERN = /^\d*(?:\.\d{0,2})?$/;

export function normalizeAmountDraft(value: string): string | null {
  const normalized = value.replaceAll(",", ".");
  if (normalized.length > 64 || !AMOUNT_DRAFT_PATTERN.test(normalized)) {
    return null;
  }
  return normalized.startsWith(".") ? `0${normalized}` : normalized;
}

export function readTransactionFilters(period: {
  month: number;
  year: number;
}): TransactionFilters {
  const params = new URLSearchParams(window.location.search);
  return {
    month: numberParam(params.get("month"), period.month),
    year: numberParam(params.get("year"), period.year),
    category: params.get("category") ?? "",
    transaction_type:
      params.get("transaction_type") === "income"
        ? "income"
        : params.get("transaction_type") === "expense"
          ? "expense"
          : "",
  };
}

export function writeTransactionFilters(filters: TransactionFilters) {
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
