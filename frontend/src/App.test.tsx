import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./app/App";
import {
  installAppTestLifecycle,
  mockFetch,
  mockColorScheme,
  mockCompactLayout,
  mockReducedMotion,
  budget,
  dashboardPayload,
} from "./test/appTestSupport";

installAppTestLifecycle();

describe("app composition", () => {
  it("renders dashboard totals and over-budget pressure", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: [
          {
            budget: budget(),
            actual_expenses: "185.00",
            remaining: "-35.00",
            percent_used: "123.3",
            status: "over budget",
          },
        ],
      }),
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose period/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Six-month cashflow trend")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(
      screen.getAllByText("Show chart data as a table").length,
    ).toBeGreaterThan(0);
  });

  it("navigates with browser routes", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));

    expect(window.location.pathname).toBe("/budgets");
    expect(
      await screen.findByRole("heading", { name: "Budgets" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Plan | Personal Finance Tracker");
  });

  it("pairs compact primary navigation with inline header utilities", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        media: query,
        matches: query === "(max-width: 63.999rem)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { level: 1 });

    const compactNavigation = document.querySelector<HTMLElement>(
      ".compact-primary-navigation",
    );
    expect(compactNavigation).not.toBeNull();

    const links = within(compactNavigation!).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "Activity",
      "Plan",
      "Automations",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/transactions",
      "/budgets",
      "/rules",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0].querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
    expect(links[0].querySelector("svg")).toHaveAttribute("stroke-width", "2");
    expect(links[1].querySelector("svg")).toHaveAttribute("fill", "none");
    expect(links[1].querySelector("svg")).toHaveAttribute("stroke-width", "2");

    await userEvent.click(
      within(compactNavigation!).getByRole("link", {
        name: "Activity",
      }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/transactions"));
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links[1].querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
    expect(links[1].querySelector("svg")).toHaveClass(
      "navigation-filled-icon",
      "lucide-receipt-text",
    );
    expect(
      links[1].querySelector(".navigation-icon-detail--transactions"),
    ).toHaveAttribute("stroke-width", "2");

    const compactHeader =
      document.querySelector<HTMLElement>(".compact-app-bar");
    expect(compactHeader).not.toBeNull();
    expect(document.querySelector("#app-drawer")).not.toBeInTheDocument();
    expect(
      within(compactHeader!).queryByRole("button", {
        name: "Open navigation menu",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(compactHeader!).getByRole("button", { name: "Switch language" }),
    ).toBeInTheDocument();
    expect(
      within(compactHeader!).getByRole("button", { name: "Add entry" }),
    ).toBeInTheDocument();
    expect(
      compactHeader!.querySelector(".theme-toggle"),
    ).toHaveAccessibleName();

    await userEvent.click(
      within(compactNavigation!).getByRole("link", {
        name: "Plan",
      }),
    );
    expect(window.location.pathname).toBe("/budgets");
    expect(
      await screen.findByRole("heading", { name: "Budgets" }),
    ).toBeInTheDocument();
    expect(links[2]).toHaveAttribute("aria-current", "page");
    expect(links[2].querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
    expect(links[2].querySelector("svg")).toHaveClass(
      "navigation-filled-icon",
      "lucide-piggy-bank",
    );
    expect(
      links[2].querySelector(".navigation-icon-detail--budgets"),
    ).toHaveAttribute("stroke-width", "3");

    await userEvent.click(
      within(compactNavigation!).getByRole("link", {
        name: "Automations",
      }),
    );
    await waitFor(() => expect(window.location.pathname).toBe("/rules"));
    expect(links[3]).toHaveAttribute("aria-current", "page");
    expect(links[3].querySelector("svg")).toHaveAttribute("fill", "none");
    expect(links[3].querySelector("svg")).toHaveAttribute(
      "stroke-width",
      "2.75",
    );
  });

  it("opens the transaction form from the global create command", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      document.querySelector<HTMLButtonElement>(".rail-create")!,
    );

    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toBeInTheDocument();
  });

  it("keeps compact header commands connected to their workflows", async () => {
    mockCompactLayout();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    const compactHeader =
      document.querySelector<HTMLElement>(".compact-app-bar");
    expect(compactHeader).not.toBeNull();

    await userEvent.click(
      within(compactHeader!).getByRole("button", {
        name: "Add entry",
      }),
    );
    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(compactHeader!).getByRole("link", { name: "Finance Tracker" }),
    );
    expect(window.location.pathname).toBe("/");
  });

  it("changes routes without snapshotting outgoing page content", async () => {
    mockColorScheme("light");
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Plan" }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/budgets");
  });

  it("skips view transitions when reduced motion is preferred", async () => {
    mockReducedMotion();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Plan" }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/budgets");
  });

  it("supports language toggling between English and Turkish", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: [
          {
            budget: budget(),
            actual_expenses: "185.00",
            remaining: "-35.00",
            percent_used: "123.3",
            status: "over budget",
          },
        ],
      }),
    });

    render(<App />);

    // Verify it renders in English by default
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose period/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("CASHFLOW OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    // Find and click language toggle button
    const langToggle = screen.getByRole("button", {
      name: /Switch language|Dili değiştir/i,
    });
    expect(langToggle).toHaveTextContent("TR");
    await userEvent.click(langToggle);

    // Verify page titles and other elements are now in Turkish
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dönem seçin/i }),
    ).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("EN");
    expect(screen.getByText("NAKİT AKIŞI ÖZETİ")).toBeInTheDocument();
    expect(screen.getByText("Bütçe aşıldı")).toBeInTheDocument();
    expect(screen.getAllByText("Finance Tracker").length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("tr");
    await waitFor(() => expect(langToggle).toHaveFocus());

    // Click it again to switch back to English
    await userEvent.click(langToggle);
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("TR");
    expect(screen.getByText("CASHFLOW OVERVIEW")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
