import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";
import { prefetchResource } from "../../shared/hooks/resourceCache";
import {
  accountTags,
  netWorthResourceKey,
} from "../../shared/hooks/resourceKeys";

export function useNetWorthData(
  asOf: string,
  months: number,
  includeArchived: boolean,
  refreshKey: number,
) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const queryDate = asOf || undefined;
      return api.netWorthOverview(months, queryDate, includeArchived, signal);
    },
    [asOf, includeArchived, months],
  );
  const cacheKey = netWorthResourceKey(
    asOf,
    months,
    includeArchived,
    refreshKey,
  );
  return useResource(load, cacheKey, {
    cacheKey,
    cacheTags: accountTags,
    retainData: true,
  });
}

export function preloadNetWorthData(
  asOf: string,
  months: number,
  includeArchived: boolean,
) {
  return prefetchResource(
    netWorthResourceKey(asOf, months, includeArchived),
    (signal) =>
      api.netWorthOverview(months, asOf || undefined, includeArchived, signal),
    { tags: accountTags },
  );
}
