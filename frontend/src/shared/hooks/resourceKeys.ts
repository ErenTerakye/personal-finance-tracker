import type { BudgetFilters, TransactionFilters } from "../../api/client";

export const resourceTags = {
  accounts: "accounts",
  budgets: "budgets",
  dashboard: "dashboard",
  rules: "rules",
  settings: "settings",
  transactions: "transactions",
} as const;

export const dashboardTags = [resourceTags.dashboard] as const;
export const transactionTags = [resourceTags.transactions] as const;
export const transactionCategoryTags = [
  resourceTags.budgets,
  resourceTags.rules,
] as const;
export const budgetTags = [
  resourceTags.budgets,
  resourceTags.dashboard,
] as const;
export const accountTags = [resourceTags.accounts] as const;
export const ruleTags = [resourceTags.rules] as const;
export const settingsTags = [resourceTags.settings] as const;

export function dashboardResourceKey(month: number, year: number) {
  return `dashboard:${year}-${month}`;
}

export function transactionResourceKey(filters: TransactionFilters) {
  return `transactions:${stableEntries(filters)}`;
}

export const transactionCategoriesResourceKey = "transaction-categories";

export function budgetResourceKey(
  filters: BudgetFilters,
  month: number,
  year: number,
) {
  return `budgets:${stableEntries({ ...filters, month, year })}`;
}

export function netWorthResourceKey(
  asOf: string,
  months: number,
  includeArchived: boolean,
  refreshKey = 0,
) {
  return `net-worth:${asOf}:${months}:${includeArchived}:${refreshKey}`;
}

function stableEntries(value: object) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}
