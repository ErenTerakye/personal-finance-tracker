import { useCallback } from "react";
import { api } from "../api/client";
import { useResource } from "../shared/hooks/useResource";
import { settingsTags } from "../shared/hooks/resourceKeys";

export function useAppSettings() {
  const load = useCallback(
    (signal: AbortSignal) => api.getSettings(signal),
    [],
  );
  return useResource(load, "app-settings", {
    cacheKey: "ledger-settings",
    cacheTags: settingsTags,
  });
}
