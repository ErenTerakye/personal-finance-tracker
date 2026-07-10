import { render, screen, waitFor } from "@testing-library/react";
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
