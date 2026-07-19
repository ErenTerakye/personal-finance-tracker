import { useCallback } from "react";
import { api, type ActivityFilters } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { useMutation } from "../../shared/hooks/useMutation";
import {
  invalidateResourceTags,
  prefetchResource,
} from "../../shared/hooks/resourceCache";
import {
  activityResourceKey,
  activityTags,
  resourceTags,
} from "../../shared/hooks/resourceKeys";
import type {
  ActivityImportPreview,
  ActivityInput,
  ActivityMutationResponse,
  ImportSummary,
  NoticeResponse,
} from "../../types";

export function useActivities(filters: ActivityFilters) {
  const { month, year, category, kind, account_id, search } = filters;
  const load = useCallback(
    (signal: AbortSignal) => api.activities(filters, signal),
    // Individual primitives prevent object-identity refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, year, category, kind, account_id, search],
  );
  const cacheKey = activityResourceKey(filters);
  return useResource(load, cacheKey, {
    cacheKey,
    cacheTags: activityTags,
    retainData: true,
  });
}

export function preloadActivities(filters: ActivityFilters) {
  return prefetchResource(
    activityResourceKey(filters),
    (signal) => api.activities(filters, signal),
    { tags: activityTags },
  );
}

function invalidateActivityConsumers() {
  invalidateResourceTags(
    resourceTags.activities,
    resourceTags.accounts,
    resourceTags.dashboard,
    resourceTags.budgets,
  );
}

export function useSaveActivity(
  onSuccess: (response: ActivityMutationResponse) => void,
) {
  return useMutation(
    ({ id, payload }: { id?: number; payload: ActivityInput }) =>
      id ? api.updateActivity(id, payload) : api.createActivity(payload),
    {
      onSuccess: (response) => {
        invalidateActivityConsumers();
        onSuccess(response);
      },
    },
  );
}

export function useDeleteActivity(
  onSuccess: (response: NoticeResponse) => void,
) {
  return useMutation((id: number) => api.deleteActivity(id), {
    onSuccess: (response) => {
      invalidateActivityConsumers();
      onSuccess(response);
    },
  });
}

export function useActivityPreview(
  onSuccess?: (response: ActivityImportPreview) => void,
) {
  return useMutation((csvText: string) => api.previewActivitiesCsv(csvText), {
    onSuccess,
  });
}

export function useActivityImport(
  onSuccess: (response: ImportSummary) => void,
) {
  return useMutation(
    ({
      csvText,
      allowDuplicates,
    }: {
      csvText: string;
      allowDuplicates: boolean;
    }) => api.importActivitiesCsv(csvText, allowDuplicates),
    {
      onSuccess: (response) => {
        invalidateActivityConsumers();
        onSuccess(response);
      },
    },
  );
}
