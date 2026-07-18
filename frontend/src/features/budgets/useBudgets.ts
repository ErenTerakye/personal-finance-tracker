import { useCallback } from "react";
import { api, type BudgetFilters } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
import {
  invalidateResourceTags,
  prefetchResource,
} from "../../shared/hooks/resourceCache";
import {
  budgetResourceKey,
  budgetTags,
  resourceTags,
} from "../../shared/hooks/resourceKeys";
import type {
  BudgetInput,
  BudgetMutationResponse,
  ImportSummary,
  NoticeResponse,
} from "../../types";

export function useBudgets(
  filters: BudgetFilters,
  selectedPeriod: { month: number; year: number },
) {
  const month = Number(filters.month || selectedPeriod.month);
  const year = Number(filters.year || selectedPeriod.year);
  const category = filters.category;
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [budgetResponse, statusResponse, dashboardResponse] =
        await Promise.all([
          api.budgets({ month, year, category }, signal),
          api.budgetStatuses(month, year, signal),
          api.dashboard(month, year, signal),
        ]);
      return {
        budgets: budgetResponse.budgets,
        statuses: statusResponse.statuses,
        totalExpenses: dashboardResponse.report.total_expenses,
      };
    },
    [month, year, category],
  );
  const cacheKey = budgetResourceKey(filters, month, year);
  return useResource(load, cacheKey, {
    cacheKey,
    cacheTags: budgetTags,
    retainData: true,
  });
}

export function preloadBudgets(
  filters: BudgetFilters,
  selectedPeriod: { month: number; year: number },
) {
  const month = Number(filters.month || selectedPeriod.month);
  const year = Number(filters.year || selectedPeriod.year);
  return prefetchResource(
    budgetResourceKey(filters, month, year),
    async (signal) => {
      const [budgetResponse, statusResponse, dashboardResponse] =
        await Promise.all([
          api.budgets(filters, signal),
          api.budgetStatuses(month, year, signal),
          api.dashboard(month, year, signal),
        ]);
      return {
        budgets: budgetResponse.budgets,
        statuses: statusResponse.statuses,
        totalExpenses: dashboardResponse.report.total_expenses,
      };
    },
    { tags: budgetTags },
  );
}

export function useSaveBudget(
  onSuccess: (response: BudgetMutationResponse, input: BudgetInput) => void,
) {
  return useMutation((input: BudgetInput) => api.setBudget(input), {
    onSuccess: (response, input) => {
      invalidateResourceTags(resourceTags.budgets, resourceTags.dashboard);
      onSuccess(response, input);
    },
  });
}

export function useDeleteBudget(onSuccess: (response: NoticeResponse) => void) {
  return useMutation((id: number) => api.deleteBudget(id), {
    onSuccess: (response) => {
      invalidateResourceTags(resourceTags.budgets, resourceTags.dashboard);
      onSuccess(response);
    },
  });
}

export function useBudgetImport(onSuccess: (response: ImportSummary) => void) {
  return useMutation((csvText: string) => api.importBudgetsCsv(csvText), {
    onSuccess: (response) => {
      invalidateResourceTags(resourceTags.budgets, resourceTags.dashboard);
      onSuccess(response);
    },
  });
}
