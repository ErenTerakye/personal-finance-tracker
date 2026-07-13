import { useLayoutEffect, useRef, useState } from "react";
import type { ResourceState } from "./useResource";

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

  useLayoutEffect(() => {
    if (
      resource.status !== "success" ||
      resource.data === committedData.current
    ) {
      return;
    }

    const next = {
      data: resource.data,
      previousData: presented?.data,
      period: requestedPeriod,
    };
    committedData.current = resource.data;
    setPresented(next);
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
    direction: presented
      ? periodDirection(presented.period, requestedPeriod)
      : null,
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
