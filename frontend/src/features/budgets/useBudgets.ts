import { useCallback } from "react";
import { api, type BudgetFilters } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
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
    [month, year, category],
  );
  return useResource(load, JSON.stringify({ filters, month, year }), {
    retainData: true,
  });
}

export function useSaveBudget(
  onSuccess: (response: BudgetMutationResponse, input: BudgetInput) => void,
) {
  return useMutation((input: BudgetInput) => api.setBudget(input), {
    onSuccess,
  });
}

export function useDeleteBudget(onSuccess: (response: NoticeResponse) => void) {
  return useMutation((id: number) => api.deleteBudget(id), { onSuccess });
}

export function useBudgetImport(onSuccess: (response: ImportSummary) => void) {
  return useMutation((csvText: string) => api.importBudgetsCsv(csvText), {
    onSuccess,
  });
}
