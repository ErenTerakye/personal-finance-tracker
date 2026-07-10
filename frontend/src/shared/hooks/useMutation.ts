import { useCallback, useEffect, useReducer, useRef } from "react";
import { normalizeApiError, type ApiError } from "../../api/errors";

type MutationIdle = { status: "idle"; data?: never; error?: never };
type MutationPending = { status: "pending"; data?: never; error?: never };
type MutationSuccess<T> = { status: "success"; data: T; error?: never };
type MutationError = { status: "error"; data?: never; error: ApiError };

export type MutationState<T> =
  MutationIdle | MutationPending | MutationSuccess<T> | MutationError;

export function useMutation<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>,
  options: {
    onSuccess?: (data: TOutput, input: TInput) => void | Promise<void>;
  } = {},
) {
  const [state, setState] = useReducer(
    (_current: MutationState<TOutput>, next: MutationState<TOutput>) => next,
    { status: "idle" },
  );
  const pending = useRef(false);
  const actionRef = useRef(action);
  const onSuccessRef = useRef(options.onSuccess);
  useEffect(() => {
    actionRef.current = action;
    onSuccessRef.current = options.onSuccess;
  }, [action, options.onSuccess]);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput | undefined> => {
      if (pending.current) {
        return undefined;
      }
      pending.current = true;
      setState({ status: "pending" });
      try {
        const data = await actionRef.current(input);
        await onSuccessRef.current?.(data, input);
        setState({ status: "success", data });
        return data;
      } catch (error) {
        setState({ status: "error", error: normalizeApiError(error) });
        return undefined;
      } finally {
        pending.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (!pending.current) {
      setState({ status: "idle" });
    }
  }, []);

  return { ...state, mutate, reset } as MutationState<TOutput> & {
    mutate: (input: TInput) => Promise<TOutput | undefined>;
    reset: () => void;
  };
}
