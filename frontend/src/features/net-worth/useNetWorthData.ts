import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";

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
  return useResource(
    load,
    `${asOf}:${months}:${includeArchived}:${refreshKey}`,
    { retainData: true },
  );
}
