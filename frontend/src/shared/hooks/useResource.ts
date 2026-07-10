import { useEffect, useReducer, useRef } from "react";
import { normalizeApiError, type ApiError } from "../../api/errors";

type ResourceIdle = { status: "idle"; data?: never; error?: never };
type ResourceLoading<T> = {
  status: "loading";
  data?: T;
  error?: never;
};
type ResourceSuccess<T> = {
  status: "success";
  data: T;
  error?: never;
};
type ResourceError<T> = {
  status: "error";
  data?: T;
  error: ApiError;
};

export type ResourceState<T> =
  ResourceIdle | ResourceLoading<T> | ResourceSuccess<T> | ResourceError<T>;

type ResourceOptions = {
  enabled?: boolean;
  retainData?: boolean;
};

export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencyKey: unknown,
  { enabled = true, retainData = false }: ResourceOptions = {},
) {
  const [state, setState] = useReducer(
    (_current: ResourceState<T>, next: ResourceState<T>) => next,
    { status: "idle" },
  );
  const [refetchGeneration, refetch] = useReducer(
    (value: number) => value + 1,
    0,
  );
  const requestGeneration = useRef(0);
  const dataRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      requestGeneration.current += 1;
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    const staleData = retainData ? dataRef.current : undefined;
    setState({ status: "loading", data: staleData });

    void Promise.resolve()
      .then(() => loader(controller.signal))
      .then(
        (data) => {
          if (
            controller.signal.aborted ||
            requestGeneration.current !== generation
          ) {
            return;
          }
          dataRef.current = data;
          setState({ status: "success", data });
        },
        (error: unknown) => {
          if (
            controller.signal.aborted ||
            requestGeneration.current !== generation ||
            (error instanceof Error && error.name === "AbortError")
          ) {
            return;
          }
          setState({
            status: "error",
            data: staleData,
            error: normalizeApiError(error),
          });
        },
      );

    return () => controller.abort();
  }, [dependencyKey, enabled, loader, refetchGeneration, retainData]);

  return { ...state, refetch } as ResourceState<T> & {
    refetch: () => void;
  };
}
