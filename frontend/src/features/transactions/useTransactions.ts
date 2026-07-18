import { useCallback } from "react";
import { api, type TransactionFilters } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
import {
  invalidateResourceTags,
  prefetchResource,
} from "../../shared/hooks/resourceCache";
import {
  resourceTags,
  transactionCategoriesResourceKey,
  transactionCategoryTags,
  transactionResourceKey,
  transactionTags,
} from "../../shared/hooks/resourceKeys";
import type {
  ImportSummary,
  TransactionImportPreview,
  TransactionInput,
  TransactionMutationResponse,
  NoticeResponse,
} from "../../types";

export function useTransactions(filters: TransactionFilters) {
  const { month, year, category, transaction_type: transactionType } = filters;
  const load = useCallback(
    (signal: AbortSignal) =>
      api.transactions(
        { month, year, category, transaction_type: transactionType },
        signal,
      ),
    [month, year, category, transactionType],
  );
  const cacheKey = transactionResourceKey(filters);
  return useResource(load, cacheKey, {
    cacheKey,
    cacheTags: transactionTags,
    retainData: true,
  });
}

export function useTransactionCategories() {
  const load = useCallback(async (signal: AbortSignal) => {
    const [budgetResponse, ruleResponse] = await Promise.all([
      api.budgets({}, signal),
      api.categoryRules(signal),
    ]);
    return Array.from(
      new Set([
        ...budgetResponse.budgets.map((budget) => budget.category),
        ...ruleResponse.rules.map((rule) => rule.category),
      ]),
    ).sort();
  }, []);
  return useResource(load, transactionCategoriesResourceKey, {
    cacheKey: transactionCategoriesResourceKey,
    cacheTags: transactionCategoryTags,
    retainData: true,
  });
}

export function preloadTransactions(filters: TransactionFilters) {
  return Promise.all([
    prefetchResource(
      transactionResourceKey(filters),
      (signal) => api.transactions(filters, signal),
      { tags: transactionTags },
    ),
    prefetchResource(
      transactionCategoriesResourceKey,
      async (signal) => {
        const [budgetResponse, ruleResponse] = await Promise.all([
          api.budgets({}, signal),
          api.categoryRules(signal),
        ]);
        return Array.from(
          new Set([
            ...budgetResponse.budgets.map((budget) => budget.category),
            ...ruleResponse.rules.map((rule) => rule.category),
          ]),
        ).sort();
      },
      { tags: transactionCategoryTags },
    ),
  ]);
}

export function useSaveTransaction(
  onSuccess: (response: TransactionMutationResponse) => void,
) {
  return useMutation(
    ({ id, payload }: { id?: number; payload: TransactionInput }) =>
      id ? api.updateTransaction(id, payload) : api.createTransaction(payload),
    {
      onSuccess: (response) => {
        invalidateResourceTags(
          resourceTags.transactions,
          resourceTags.dashboard,
          resourceTags.budgets,
        );
        onSuccess(response);
      },
    },
  );
}

export function useDeleteTransaction(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteTransaction(id), {
    onSuccess: (response) => {
      invalidateResourceTags(
        resourceTags.transactions,
        resourceTags.dashboard,
        resourceTags.budgets,
      );
      onSuccess(response);
    },
  });
}

export function useTransactionPreview(
  onSuccess?: (response: TransactionImportPreview) => void,
) {
  return useMutation((csvText: string) => api.previewTransactionsCsv(csvText), {
    onSuccess,
  });
}

export function useTransactionImport(
  onSuccess: (response: ImportSummary) => void,
) {
  return useMutation(
    ({
      csvText,
      allowDuplicates,
    }: {
      csvText: string;
      allowDuplicates: boolean;
    }) => api.importTransactionsCsvWithOptions(csvText, allowDuplicates),
    {
      onSuccess: (response) => {
        invalidateResourceTags(
          resourceTags.transactions,
          resourceTags.dashboard,
          resourceTags.budgets,
        );
        onSuccess(response);
      },
    },
  );
}
