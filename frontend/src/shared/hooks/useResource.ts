import { useEffect, useReducer, useRef } from "react";
import { normalizeApiError, type ApiError } from "../../api/errors";
import { loadResourceCache, readResourceCache } from "./resourceCache";

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
  cacheKey?: string;
  cacheTags?: readonly string[];
  enabled?: boolean;
  freshForMs?: number;
  retainData?: boolean;
};

const EMPTY_CACHE_TAGS: readonly string[] = [];

export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencyKey: unknown,
  {
    cacheKey,
    cacheTags = EMPTY_CACHE_TAGS,
    enabled = true,
    freshForMs = 30_000,
    retainData = false,
  }: ResourceOptions = {},
) {
  const [state, setState] = useReducer(
    (_current: ResourceState<T>, next: ResourceState<T>) => next,
    cacheKey,
    initialState<T>,
  );
  const [refetchGeneration, refetch] = useReducer(
    (value: number) => value + 1,
    0,
  );
  const requestGeneration = useRef(0);
  const dataRef = useRef<T | undefined>(undefined);
  const handledRefetchGeneration = useRef(0);

  useEffect(() => {
    if (!enabled) {
      requestGeneration.current += 1;
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    const cached = cacheKey
      ? readResourceCache<T>(cacheKey, freshForMs)
      : undefined;
    const staleData =
      cached?.data ?? (retainData ? dataRef.current : undefined);
    const force = handledRefetchGeneration.current !== refetchGeneration;
    handledRefetchGeneration.current = refetchGeneration;

    if (!force && cached?.fresh && cached.error !== undefined) {
      setState({
        status: "error",
        data: staleData,
        error: normalizeApiError(cached.error),
      });
      return;
    }

    if (!force && cached?.fresh && cached.data !== undefined) {
      dataRef.current = cached.data;
      setState({ status: "success", data: cached.data });
      return;
    }
    setState({ status: "loading", data: staleData });

    const request = cacheKey
      ? loadResourceCache(cacheKey, loader, {
          force,
          freshForMs,
          tags: cacheTags,
        })
      : Promise.resolve().then(() => loader(controller.signal));

    void request.then(
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
  }, [
    cacheKey,
    cacheTags,
    dependencyKey,
    enabled,
    freshForMs,
    loader,
    refetchGeneration,
    retainData,
  ]);

  return { ...state, refetch } as ResourceState<T> & {
    refetch: () => void;
  };
}

function initialState<T>(cacheKey?: string): ResourceState<T> {
  if (!cacheKey) return { status: "idle" };
  const cached = readResourceCache<T>(cacheKey);
  if (cached.fresh && cached.error !== undefined) {
    return { status: "error", error: normalizeApiError(cached.error) };
  }
  return cached.data === undefined
    ? { status: "idle" }
    : { status: "success", data: cached.data };
}
