import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourceState } from "./useResource";
import {
  periodDirection,
  usePeriodTransition,
  type PeriodValue,
} from "./usePeriodTransition";

type Props = {
  period: PeriodValue;
  resource: ResourceState<string>;
};

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  vi.unstubAllGlobals();
});

describe("usePeriodTransition", () => {
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

  it("commits adjacent and jumped periods with semantic transitions", async () => {
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
    expect(startViewTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({ types: ["period-forward"] }),
    );

    rerender({
      period: { month: 3, year: 2025 },
      resource: success("March"),
    });
    await waitFor(() => expect(result.current.data).toBe("March"));
    expect(startViewTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({ types: ["period-jump"] }),
    );
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

  it("keeps compact glass navigation live during period updates", async () => {
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
    expect(startViewTransition).toHaveBeenCalledWith(
      expect.objectContaining({ types: ["period-forward"] }),
    );
  });
});

describe("periodDirection", () => {
  it("distinguishes adjacent navigation from a picker jump", () => {
    expect(
      periodDirection({ month: 1, year: 2026 }, { month: 12, year: 2025 }),
    ).toBe("backward");
    expect(
      periodDirection({ month: 12, year: 2025 }, { month: 1, year: 2026 }),
    ).toBe("forward");
    expect(
      periodDirection({ month: 1, year: 2026 }, { month: 3, year: 2026 }),
    ).toBe("jump");
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
