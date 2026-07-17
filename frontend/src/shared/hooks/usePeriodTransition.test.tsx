import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceState } from "./useResource";
import { usePeriodTransition, type PeriodValue } from "./usePeriodTransition";

type Props = {
  period: PeriodValue;
  resource: ResourceState<string>;
};

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  vi.unstubAllGlobals();
});

describe("usePeriodTransition", () => {
  it("presents prepared initial data without a loading frame", () => {
    const { result } = renderHook(() =>
      usePeriodTransition({ month: 6, year: 2026 }, success("Prepared June")),
    );

    expect(result.current.data).toBe("Prepared June");
    expect(result.current.presentedPeriod).toEqual({ month: 6, year: 2026 });
  });

  it("retains presented data while the requested period loads", () => {
    const { result, rerender } = renderHook(
      ({ period, resource }: Props) => usePeriodTransition(period, resource),
      {
        initialProps: {
          period: { month: 6, year: 2026 },
          resource: success("June"),
        },
      },
    );

    rerender({
      period: { month: 7, year: 2026 },
      resource: { status: "loading", data: "June" },
    });

    expect(result.current.data).toBe("June");
    expect(result.current.pending).toBe(true);
  });

  it("commits rapid period results without starting document snapshots", async () => {
    const startViewTransition = installViewTransition();
    const { result, rerender } = renderHook(
      ({ period, resource }: Props) => usePeriodTransition(period, resource),
      {
        initialProps: {
          period: { month: 6, year: 2026 },
          resource: success("June"),
        },
      },
    );

    rerender({
      period: { month: 7, year: 2026 },
      resource: success("July"),
    });
    await waitFor(() => expect(result.current.data).toBe("July"));

    rerender({
      period: { month: 8, year: 2026 },
      resource: success("August"),
    });
    await waitFor(() => expect(result.current.data).toBe("August"));
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("updates without a transition for reduced motion or same-period data", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
    }));
    const startViewTransition = installViewTransition();
    const { result, rerender } = renderHook(
      ({ period, resource }: Props) => usePeriodTransition(period, resource),
      {
        initialProps: {
          period: { month: 6, year: 2026 },
          resource: success("initial"),
        },
      },
    );

    rerender({
      period: { month: 5, year: 2026 },
      resource: success("reduced motion"),
    });
    rerender({
      period: { month: 5, year: 2026 },
      resource: success("filtered"),
    });

    await waitFor(() => expect(result.current.data).toBe("filtered"));
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("keeps compact glass navigation outside period snapshots", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 63.999rem)",
    }));
    const startViewTransition = installViewTransition();
    const { result, rerender } = renderHook(
      ({ period, resource }: Props) => usePeriodTransition(period, resource),
      {
        initialProps: {
          period: { month: 6, year: 2026 },
          resource: success("June"),
        },
      },
    );

    rerender({
      period: { month: 7, year: 2026 },
      resource: success("July"),
    });

    await waitFor(() => expect(result.current.data).toBe("July"));
    expect(startViewTransition).not.toHaveBeenCalled();
  });
});

function success(data: string): ResourceState<string> {
  return { status: "success", data };
}

function installViewTransition() {
  const startViewTransition = vi.fn(
    ({ update }: { update: () => void; types?: string[] }) => {
      update();
      return {
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
      };
    },
  );
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: startViewTransition,
  });
  return startViewTransition;
}
