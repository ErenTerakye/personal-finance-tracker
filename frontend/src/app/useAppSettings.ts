import { useCallback } from "react";
import { api } from "../api/client";
import { useResource } from "../shared/hooks/useResource";

export function useAppSettings() {
  const load = useCallback(
    (signal: AbortSignal) => api.getSettings(signal),
    [],
  );
  return useResource(load, "app-settings");
}
