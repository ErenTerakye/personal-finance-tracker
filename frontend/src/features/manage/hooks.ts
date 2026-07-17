import { useCallback } from "react";
import { api } from "../../api/client";
import { useMutation } from "../../shared/hooks/useMutation";
import { useResource } from "../../shared/hooks/useResource";
import {
  invalidateResourceTags,
  prefetchResource,
} from "../../shared/hooks/resourceCache";
import {
  resourceTags,
  ruleTags,
  settingsTags,
  transactionTags,
} from "../../shared/hooks/resourceKeys";
import type {
  CategoryRuleInput,
  CategoryRuleMutationResponse,
  NoticeResponse,
  RecurringApplyResponse,
  RecurringTemplateInput,
  RecurringTemplateMutationResponse,
} from "../../types";

export function useCategoryRules() {
  const load = useCallback(
    (signal: AbortSignal) => api.categoryRules(signal),
    [],
  );
  return useResource(load, "manage-category-rules", {
    cacheKey: "category-rules",
    cacheTags: ruleTags,
    retainData: true,
  });
}

export function useSaveCategoryRule(
  onSuccess: (response: CategoryRuleMutationResponse) => void,
) {
  return useMutation((input: CategoryRuleInput) => api.setCategoryRule(input), {
    onSuccess: (response) => {
      invalidateResourceTags(resourceTags.rules);
      onSuccess(response);
    },
  });
}

export function useDeleteCategoryRule(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteCategoryRule(id), {
    onSuccess: (response) => {
      invalidateResourceTags(resourceTags.rules);
      onSuccess(response);
    },
  });
}

export function useRecurringTemplates() {
  const load = useCallback(
    (signal: AbortSignal) => api.recurringTemplates(signal),
    [],
  );
  return useResource(load, "manage-recurring-templates", {
    cacheKey: "recurring-templates",
    cacheTags: transactionTags,
    retainData: true,
  });
}

export function useLedgerSettings() {
  const load = useCallback(
    (signal: AbortSignal) => api.getSettings(signal),
    [],
  );
  return useResource(load, "manage-ledger-settings", {
    cacheKey: "ledger-settings",
    cacheTags: settingsTags,
    retainData: true,
  });
}

export function preloadCategoryRules() {
  return prefetchResource("category-rules", api.categoryRules, {
    tags: ruleTags,
  });
}

export function preloadRecurringTemplates() {
  return prefetchResource("recurring-templates", api.recurringTemplates, {
    tags: transactionTags,
  });
}

export function preloadLedgerSettings() {
  return prefetchResource("ledger-settings", api.getSettings, {
    tags: settingsTags,
  });
}

export function useSaveRecurringTemplate(
  onSuccess: (response: RecurringTemplateMutationResponse) => void,
) {
  return useMutation(
    (input: RecurringTemplateInput) => api.createRecurringTemplate(input),
    {
      onSuccess: (response) => {
        invalidateResourceTags(resourceTags.transactions);
        onSuccess(response);
      },
    },
  );
}

export function useDeleteRecurringTemplate(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteRecurringTemplate(id), {
    onSuccess: (response) => {
      invalidateResourceTags(resourceTags.transactions);
      onSuccess(response);
    },
  });
}

export function useUpdateLedgerSettings(
  onSuccess: (response: NoticeResponse, input: string) => void,
) {
  return useMutation((currency: string) => api.updateSettings({ currency }), {
    onSuccess: (response, input) => {
      invalidateResourceTags(resourceTags.settings);
      onSuccess(response, input);
    },
  });
}

export function useApplyRecurringTemplates(
  onSuccess: (response: RecurringApplyResponse) => void,
) {
  return useMutation(
    ({ month, year }: { month: number; year: number }) =>
      api.applyRecurringTemplates(month, year),
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
