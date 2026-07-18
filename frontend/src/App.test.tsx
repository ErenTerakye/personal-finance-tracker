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

  it("uses theme and language toggles in the desktop layout", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { name: "Overview" });

    // The theme toggle button should have aria-label "Use dark mode" initially (since default is light)
    const themeToggle = screen.getByRole("button", { name: "Use dark mode" });
    expect(themeToggle).toBeVisible();
    expect(themeToggle.closest("footer")).toHaveClass("rail-utilities");
    expect(themeToggle.closest("aside")).toHaveClass("app-rail");
    expect(
      themeToggle.closest("footer")?.querySelector(".rail-manage-navigation"),
    ).toContainElement(screen.getByRole("link", { name: "Manage" }));
    expect(screen.queryByText("Local SQLite")).not.toBeInTheDocument();

    // The language toggle button should show target language "TR" and have aria-label "Switch to Turkish"
    const langToggle = screen.getByRole("button", {
      name: "Switch to Turkish",
    });
    expect(langToggle).toHaveTextContent("TR");
    expect(langToggle.closest("aside")).toHaveClass("app-rail");

    // Clicking language toggle should switch language to Turkish
    await userEvent.click(langToggle);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Genel Bakış" }),
    ).toBeVisible();

    // Now the language toggle should show "EN" and have aria-label "İngilizceye geç"
    const newLangToggle = screen.getByRole("button", {
      name: "İngilizceye geç",
    });
    expect(newLangToggle).toHaveTextContent("EN");

    // Clicking theme toggle should switch theme to dark
    const newThemeToggle = screen.getByRole("button", {
      name: "Koyu modu kullan",
    });
    await userEvent.click(newThemeToggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("renders a clean mobile header with manage gear icon and no redundant popover", async () => {
    mockCompactLayout();
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { name: "Overview" });

    // Verify gear icon link exists with aria-label "Manage"
    const manageLink = screen.getByRole("link", { name: "Manage" });
    expect(manageLink).toBeVisible();

    expect(
      screen.getByRole("button", { name: "Use dark mode" }).closest("header"),
    ).toHaveClass("compact-app-bar");
    expect(
      screen
        .getByRole("button", { name: "Switch to Turkish" })
        .closest("header"),
    ).toHaveClass("compact-app-bar");

    // Verify "Open preferences" button does not exist
    expect(
      screen.queryByRole("button", { name: "Open preferences" }),
    ).toBeNull();
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
      screen.getByRole("button", { name: "Switch to Turkish" }),
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

  it("activates each destination at its remembered scroll position", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] },
    });
    let scrollY = 420;
    vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(((
      options: ScrollToOptions | number,
    ) => {
      if (typeof options === "object") scrollY = options.top ?? 0;
    }) as typeof window.scrollTo);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: "Transactions" }),
    );
    await screen.findByRole("heading", { name: "Transactions" });

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: "instant",
    });

    scrollY = 180;
    await userEvent.click(screen.getByRole("link", { name: "Overview" }));
    await screen.findByRole("heading", { name: "Overview" });

    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 420,
      behavior: "instant",
    });
  });

  it("switches destinations without interpolating their scroll contexts", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] },
    });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: "Transactions" }),
    );
    await screen.findByRole("heading", { name: "Transactions" });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("route-view-transition");
  });
});
