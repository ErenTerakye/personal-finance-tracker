import { useEffect, useRef, useState } from "react";
import type { ResourceState } from "./useResource";
import { runViewTransition } from "../motion/viewTransitions";

export type PeriodValue = { month: number; year: number };
export type PeriodTransitionDirection = "backward" | "forward" | "jump";

export function usePeriodTransition<T>(
  requestedPeriod: PeriodValue,
  resource: ResourceState<T>,
) {
  const [presented, setPresented] = useState<{
    data: T;
    previousData?: T;
    period: PeriodValue;
  } | null>(null);
  const committedData = useRef<T | undefined>(undefined);
  const requestedKey = periodKey(requestedPeriod);

  useEffect(() => {
    if (
      resource.status !== "success" ||
      resource.data === committedData.current
    ) {
      return;
    }

    const nextData = resource.data;
    const previous = presented;
    const direction = previous
      ? periodDirection(previous.period, requestedPeriod)
      : null;
    let cancelled = false;

    if (!direction) {
      committedData.current = nextData;
      setPresented({
        data: nextData,
        previousData: previous?.data,
        period: requestedPeriod,
      });
      return;
    }

    // Effects run while React is finishing a commit. Moving the narrowly
    // scoped flushSync boundary to a microtask gives View Transitions two
    // stable snapshots without delaying the successful data presentation.
    queueMicrotask(() => {
      if (cancelled || committedData.current === nextData) return;
      committedData.current = nextData;
      const commit = () =>
        setPresented({
          data: nextData,
          previousData: previous?.data,
          period: requestedPeriod,
        });
      runViewTransition(`period-${direction}`, commit);
    });

    return () => {
      cancelled = true;
    };
  }, [requestedKey, requestedPeriod, resource, presented]);

  const pending =
    resource.status === "loading" &&
    Boolean(presented) &&
    periodKey(presented!.period) !== requestedKey;

  return {
    data: presented?.data,
    previousData: presented?.previousData,
    presentedPeriod: presented?.period,
    pending,
  };
}

export function periodDirection(
  from: PeriodValue,
  to: PeriodValue,
): PeriodTransitionDirection | null {
  const delta = to.year * 12 + to.month - (from.year * 12 + from.month);
  if (delta === 0) return null;
  if (delta === 1) return "forward";
  if (delta === -1) return "backward";
  return "jump";
}

function periodKey(period: PeriodValue) {
  return `${period.year}-${period.month}`;
}
