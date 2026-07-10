import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
import type {
  NoticeResponse,
  RecurringApplyResponse,
  RecurringTemplateInput,
  RecurringTemplateMutationResponse,
} from "../../types";

export function useRecurringTemplates() {
  const load = useCallback(
    (signal: AbortSignal) => api.recurringTemplates(signal),
    [],
  );
  return useResource(load, "recurring-templates", { retainData: true });
}

export function useLedgerSettings() {
  const load = useCallback(
    (signal: AbortSignal) => api.getSettings(signal),
    [],
  );
  return useResource(load, "ledger-settings", { retainData: true });
}

export function useSaveRecurringTemplate(
  onSuccess: (response: RecurringTemplateMutationResponse) => void,
) {
  return useMutation(
    (input: RecurringTemplateInput) => api.createRecurringTemplate(input),
    { onSuccess },
  );
}

export function useDeleteRecurringTemplate(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteRecurringTemplate(id), {
    onSuccess,
  });
}

export function useUpdateLedgerSettings(
  onSuccess: (response: NoticeResponse, input: string) => void,
) {
  return useMutation((currency: string) => api.updateSettings({ currency }), {
    onSuccess,
  });
}

export function useApplyRecurringTemplates(
  onSuccess: (response: RecurringApplyResponse) => void,
) {
  return useMutation(
    ({ month, year }: { month: number; year: number }) =>
      api.applyRecurringTemplates(month, year),
    { onSuccess },
  );
}
