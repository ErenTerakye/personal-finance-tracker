import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelActiveViewTransition,
  runViewTransition,
} from "./viewTransitions";

afterEach(() => {
  cancelActiveViewTransition();
  Reflect.deleteProperty(document, "startViewTransition");
  document.documentElement.classList.remove("period-view-transition");
  vi.unstubAllGlobals();
});

describe("view transition coordinator", () => {
  it("updates synchronously when unsupported or reduced motion is requested", () => {
    const unsupportedUpdate = vi.fn();
    expect(runViewTransition("period-forward", unsupportedUpdate).started).toBe(
      false,
    );
    expect(unsupportedUpdate).toHaveBeenCalledOnce();

    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    const reducedUpdate = vi.fn();
    runViewTransition("period-forward", reducedUpdate);
    expect(reducedUpdate).toHaveBeenCalledOnce();
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("passes semantic types and cleans period state after completion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const startViewTransition = vi.fn(({ update }: { update: () => void }) => {
      update();
      return {
        updateCallbackDone: Promise.resolve(),
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
      };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    const result = runViewTransition("period-jump", vi.fn());
    expect(document.documentElement).toHaveClass("period-view-transition");
    expect(startViewTransition).toHaveBeenCalledWith(
      expect.objectContaining({ types: ["period-jump"] }),
    );
    await result.finished;
    expect(document.documentElement).not.toHaveClass("period-view-transition");
  });

  it("skips an obsolete snapshot before starting the newest one", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const skipTransition = vi.fn();
    const never = new Promise<void>(() => undefined);
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: ({ update }: { update: () => void }) => {
        update();
        return {
          updateCallbackDone: Promise.resolve(),
          finished: never,
          skipTransition,
        };
      },
    });

    runViewTransition("period-forward", vi.fn());
    runViewTransition("period-backward", vi.fn());
    expect(skipTransition).toHaveBeenCalledOnce();
  });

  it("releases an active period snapshot when navigation takes over", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const skipTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: ({ update }: { update: () => void }) => {
        update();
        return {
          updateCallbackDone: Promise.resolve(),
          finished: new Promise<void>(() => undefined),
          skipTransition,
        };
      },
    });

    runViewTransition("period-forward", vi.fn());
    cancelActiveViewTransition();

    expect(skipTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveClass("period-view-transition");
  });
});
