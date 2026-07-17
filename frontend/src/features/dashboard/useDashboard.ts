import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { prefetchResource } from "../../shared/hooks/resourceCache";
import {
  dashboardResourceKey,
  dashboardTags,
} from "../../shared/hooks/resourceKeys";

export function useDashboard(month: number, year: number) {
  const load = useCallback(
    (signal: AbortSignal) => api.dashboard(month, year, signal),
    [month, year],
  );
  const cacheKey = dashboardResourceKey(month, year);
  return useResource(load, cacheKey, {
    cacheKey,
    cacheTags: dashboardTags,
    retainData: true,
  });
}

export function preloadDashboard(month: number, year: number) {
  return prefetchResource(
    dashboardResourceKey(month, year),
    (signal) => api.dashboard(month, year, signal),
    { tags: dashboardTags },
  );
}
