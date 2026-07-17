import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./app/App";
import { resolveRoute } from "./app/routes";
import {
  budget,
  dashboardPayload,
  installAppTestLifecycle,
  mockCompactLayout,
  mockFetch,
  response,
  transaction,
} from "./test/appTestSupport";

installAppTestLifecycle();

describe("app composition", () => {
  it("does not flash the dashboard loading panel during startup", async () => {
    let releaseDashboard!: () => void;
    const dashboardResponse = new Promise<Response>((resolve) => {
      releaseDashboard = () => {
        void response(dashboardPayload({})).then(resolve);
      };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/dashboard")) return dashboardResponse;
        if (url.startsWith("/api/settings")) {
          return response({ currency: "USD" });
        }
        return response({});
      }),
    );

    render(<App />);

    await screen.findByRole("status");
    expect(screen.queryByText("Loading dashboard")).toBeNull();
    releaseDashboard();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Overview" }),
    ).toBeVisible();
    expect(screen.queryByText("Loading dashboard")).toBeNull();
  });

  it("renders the unified Overview", async () => {
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
      await screen.findByRole("heading", { level: 1, name: "Overview" }),
    ).toBeVisible();
    expect(screen.getByText("Six-month cashflow trend")).toBeVisible();
    expect(screen.getByText("Over budget")).toBeVisible();
    expect(document.title).toBe("Overview | Personal Finance Tracker");
  });

  it("uses four stable primary destinations and a separate Manage entry", async () => {
    mockCompactLayout();
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "Overview" });

    const compactNavigation = document.querySelector<HTMLElement>(
      ".compact-primary-navigation",
    )!;
    const links = within(compactNavigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Overview",
      "Transactions",
      "Budgets",
      "Accounts",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/transactions",
      "/budgets",
      "/accounts",
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0].querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
    expect(links[0].querySelector("svg")).toHaveAttribute(
      "stroke",
      "currentColor",
    );
    expect(links[0].querySelector("svg")).toHaveAttribute("fill-opacity", "1");
    expect(links[0].querySelectorAll("path")).not.toHaveLength(0);
    for (const link of links.slice(1)) {
      expect(link.querySelector("svg")).toHaveAttribute("fill", "none");
      expect(link.querySelector("svg")).toHaveAttribute("stroke-width", "2");
    }
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/manage/automations",
    );
  });

  it("navigates to Budgets with matching route, heading, and title", async () => {
    mockCompactLayout();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Budgets" }));

    expect(window.location.pathname).toBe("/budgets");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Budgets" }),
    ).toHaveFocus();
    expect(document.title).toBe("Budgets | Personal Finance Tracker");

    const compactNavigation = document.querySelector<HTMLElement>(
      ".compact-primary-navigation",
    )!;
    expect(
      within(compactNavigation)
        .getByRole("link", { name: "Overview" })
        .querySelector("svg"),
    ).toHaveAttribute("data-variant", "outline-open-door");
  });

  it("keeps the global command tied to Add transaction", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Budgets" }));
    await screen.findByRole("heading", { level: 1, name: "Budgets" });
    await userEvent.click(
      document.querySelector<HTMLButtonElement>(".rail-create")!,
    );

    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toBeVisible();
  });

  it("opens Manage within one action from compact chrome", async () => {
    mockCompactLayout();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/recurring": { templates: [] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await screen.findByRole("heading", { name: "Overview" });
    await userEvent.click(screen.getByRole("link", { name: "Manage" }));

    expect(window.location.pathname).toBe("/manage/automations");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Automations" }),
    ).toBeVisible();
    expect(document.title).toBe("Automations | Personal Finance Tracker");
  });

  it("translates compatibility routes and preserves relevant query state", () => {
    expect(resolveRoute("/cash-flow", "?month=5&year=2026")).toEqual({
      view: "overview",
      canonicalUrl: "/?month=5&year=2026",
    });
    expect(resolveRoute("/net-worth", "?as_of=2026-07-01&months=6")).toEqual({
      view: "accounts",
      canonicalUrl: "/accounts?as_of=2026-07-01&months=6",
    });
    expect(resolveRoute("/rules", "?month=7&year=2026")).toEqual({
      view: "manageAutomations",
      canonicalUrl: "/manage/automations?month=7&year=2026",
    });
  });

  it("keeps destination concepts stable in Turkish", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
    render(<App />);
    await screen.findByRole("heading", { name: "Overview" });

    await userEvent.click(
      screen.getByRole("button", { name: "Switch language" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "Genel Bakış" }),
      ).toBeVisible(),
    );
    expect(screen.getByRole("link", { name: "İşlemler" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Bütçeler" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Hesaplar" })).toBeVisible();
    expect(document.title).toBe("Genel Bakış | Personal Finance Tracker");
  });

  it("restores a visited destination without resetting its local view state", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] },
      "/api/budgets/status": { statuses: [] },
      "/api/budgets": { budgets: [] },
      "/api/category-rules": { rules: [] },
    });
    render(<App />);

    await userEvent.click(
      await screen.findByRole("link", { name: "Transactions" }),
    );
    const search = await screen.findByRole("searchbox");
    await userEvent.type(search, "groceries");
    await userEvent.click(screen.getByRole("link", { name: "Budgets" }));
    await screen.findByRole("heading", { name: "Budgets" });
    await userEvent.click(screen.getByRole("link", { name: "Transactions" }));

    expect(await screen.findByRole("searchbox")).toHaveValue("groceries");
    expect(document.querySelector(".route-loading-shell")).toBeNull();
  });
});
