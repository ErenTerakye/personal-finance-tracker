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
      const [summary, accounts, history] = await Promise.all([
        api.netWorth(queryDate, signal),
        api.accounts(
          { as_of: queryDate, include_archived: includeArchived },
          signal,
        ),
        api.netWorthHistory(months, queryDate, signal),
      ]);
      return { summary, accounts: accounts.accounts, history };
    },
    [asOf, includeArchived, months],
  );
  return useResource(
    load,
    `${asOf}:${months}:${includeArchived}:${refreshKey}`,
    { retainData: true },
  );
}
