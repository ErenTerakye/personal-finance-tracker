import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  colorSchemeMeta,
  installAppTestLifecycle,
  mockFetch,
  mockColorScheme,
  dashboardPayload,
} from "../../test/appTestSupport";
import { COLOR_SCHEME_STORAGE_KEY } from "../../shared/theme/preference";

installAppTestLifecycle();

describe("theme preference workflow", () => {
  it("defaults to system color mode with no stored preference", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const themeToggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    expect(themeToggle).toBeVisible();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });

  it("pins light and dark modes without cycling back to system", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    const themeToggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    await userEvent.click(themeToggle);

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe(
        "dark",
      );
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
    });

    const themeToggleLight = screen.getByRole("button", {
      name: "Use light mode",
    });
    await userEvent.click(themeToggleLight);

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe(
        "light",
      );
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
      expect(colorSchemeMeta()).toHaveAttribute("content", "light");
    });
  });

  it("switches back and forth immediately without starting a view transition", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    const themeToggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });

    await userEvent.click(themeToggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    const themeToggleLight = screen.getByRole("button", {
      name: "Use light mode",
    });
    await userEvent.click(themeToggleLight);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(themeToggleLight).toHaveFocus();
  });

  it("applies a stored manual mode on render", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "dark");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const themeToggle = await screen.findByRole("button", {
      name: "Use light mode",
    });
    expect(themeToggle).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
  });

  it("updates the system-mode action when the OS color mode changes", async () => {
    const colorScheme = mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const themeToggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    expect(themeToggle).toBeVisible();
    act(() => colorScheme.set("dark"));

    const themeToggleLight = screen.getByRole("button", {
      name: "Use light mode",
    });
    expect(themeToggleLight).toBeVisible();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await userEvent.click(themeToggleLight);
    act(() => colorScheme.set("light"));

    const themeToggleDark = screen.getByRole("button", {
      name: "Use dark mode",
    });
    expect(themeToggleDark).toBeVisible();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("falls back to system mode when stored theme data is invalid or unavailable", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    const { unmount } = render(<App />);

    const themeToggle = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    expect(themeToggle).toBeVisible();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
    unmount();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const themeToggle2 = await screen.findByRole("button", {
      name: "Use dark mode",
    });
    expect(themeToggle2).toBeVisible();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });
});
