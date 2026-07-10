import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
import type {
  CategoryRuleInput,
  CategoryRuleMutationResponse,
  NoticeResponse,
} from "../../types";

export function useCategoryRules() {
  const load = useCallback(
    (signal: AbortSignal) => api.categoryRules(signal),
    [],
  );
  return useResource(load, "category-rules", { retainData: true });
}

export function useSaveCategoryRule(
  onSuccess: (response: CategoryRuleMutationResponse) => void,
) {
  return useMutation((input: CategoryRuleInput) => api.setCategoryRule(input), {
    onSuccess,
  });
}

export function useDeleteCategoryRule(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteCategoryRule(id), { onSuccess });
}
