import { useCallback } from "react";
import { api } from "../../api/client";
import { useResource } from "../../shared/hooks/useResource";

export function useDashboard(month: number, year: number) {
  const load = useCallback(
    (signal: AbortSignal) => api.dashboard(month, year, signal),
    [month, year],
  );
  return useResource(load, `${year}-${month}`);
}
