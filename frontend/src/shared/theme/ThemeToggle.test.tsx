import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  colorSchemeMeta,
  installAppTestLifecycle,
  mockFetch,
  mockColorScheme,
  mockReducedMotion,
  dashboardPayload,
} from "../../test/appTestSupport";
import { COLOR_SCHEME_STORAGE_KEY } from "../../shared/theme/preference";

installAppTestLifecycle();

describe("theme preference workflow", () => {
  it("defaults to system color mode with no stored preference", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Use dark mode" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });

  it("pins the opposite system mode and restores system mode", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Use dark mode" }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe(
        "dark",
      );
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Use system color setting" }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement).not.toHaveAttribute("data-theme");
      expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
    });
  });

  it("reveals the new theme from the activated control", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    const finished = deferred<void>();
    const { startViewTransition } = installViewTransitions([finished.promise]);

    render(<App />);
    const toggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    vi.spyOn(toggle, "getBoundingClientRect").mockReturnValue(
      domRect({ left: 20, top: 30, width: 48, height: 48 }),
    );

    await userEvent.click(toggle);

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveClass("theme-view-transition");
    expect(
      document.documentElement.style.getPropertyValue("--theme-reveal-x"),
    ).toBe("44px");
    expect(
      document.documentElement.style.getPropertyValue("--theme-reveal-y"),
    ).toBe("54px");
    expect(
      document.documentElement.style.getPropertyValue("--theme-reveal-radius"),
    ).toBe(`${Math.hypot(956, 746)}px`);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(toggle).toHaveFocus();

    finished.resolve();
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass("theme-view-transition");
    });
    expect(
      document.documentElement.style.getPropertyValue("--theme-reveal-x"),
    ).toBe("");
  });

  it("switches immediately when reduced motion is preferred", async () => {
    mockReducedMotion();
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
    const { startViewTransition } = installViewTransitions([Promise.resolve()]);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Use dark mode" }),
    );

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).not.toHaveClass("theme-view-transition");
  });

  it("lets the latest rapid toggle own transition cleanup", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
    const firstFinished = deferred<void>();
    const secondFinished = deferred<void>();
    const { transitions } = installViewTransitions([
      firstFinished.promise,
      secondFinished.promise,
    ]);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Use dark mode" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use system color setting" }),
    );

    expect(transitions[0].skipTransition).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveClass("theme-view-transition");
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    firstFinished.resolve();
    await Promise.resolve();
    expect(document.documentElement).toHaveClass("theme-view-transition");

    secondFinished.resolve();
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass("theme-view-transition");
    });
    expect(
      document.documentElement.style.getPropertyValue("--theme-reveal-radius"),
    ).toBe("");
  });

  it("applies a stored manual mode on render", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "dark");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Use system color setting" }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
  });

  it("updates the system-mode action when the OS color mode changes", async () => {
    const colorScheme = mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Use dark mode" }),
    ).toBeInTheDocument();
    colorScheme.set("dark");

    expect(
      await screen.findByRole("button", { name: "Use light mode" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await userEvent.click(
      screen.getByRole("button", { name: "Use light mode" }),
    );
    colorScheme.set("light");

    expect(
      await screen.findByRole("button", { name: "Use system color setting" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("falls back to system mode when stored theme data is invalid or unavailable", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    const { unmount } = render(<App />);

    expect(
      await screen.findByRole("button", { name: "Use dark mode" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
    unmount();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Use dark mode" }),
    ).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });
});

function installViewTransitions(finishedPromises: Promise<void>[]) {
  const transitions = finishedPromises.map(
    (finished) =>
      ({
        finished,
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
        types: new Set<string>(),
      }) as unknown as ViewTransition,
  );
  const startViewTransition = vi.fn(
    (
      callbackOptions?:
        ViewTransitionUpdateCallback | StartViewTransitionOptions,
    ) => {
      if (typeof callbackOptions === "function") {
        callbackOptions();
      } else {
        callbackOptions?.update?.();
      }
      const transition = transitions[startViewTransition.mock.calls.length - 1];
      if (!transition) throw new Error("Missing mocked view transition");
      return transition;
    },
  );
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: startViewTransition,
  });
  return { startViewTransition, transitions };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function domRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
