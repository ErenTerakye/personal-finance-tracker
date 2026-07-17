import { useEffect, useRef, useState } from "react";
import type { ResourceState } from "./useResource";

export type PeriodValue = { month: number; year: number };

export function usePeriodTransition<T>(
  requestedPeriod: PeriodValue,
  resource: ResourceState<T>,
) {
  const [presented, setPresented] = useState<{
    data: T;
    previousData?: T;
    period: PeriodValue;
  } | null>(() =>
    resource.status === "success"
      ? { data: resource.data, period: requestedPeriod }
      : null,
  );
  const committedData = useRef<T | undefined>(
    resource.status === "success" ? resource.data : undefined,
  );
  const requestedKey = periodKey(requestedPeriod);

  useEffect(() => {
    if (
      resource.status !== "success" ||
      resource.data === committedData.current
    ) {
      return;
    }

    const nextData = resource.data;
    committedData.current = nextData;
    setPresented({
      data: nextData,
      previousData: presented?.data,
      period: requestedPeriod,
    });
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

function periodKey(period: PeriodValue) {
  return `${period.year}-${period.month}`;
}
