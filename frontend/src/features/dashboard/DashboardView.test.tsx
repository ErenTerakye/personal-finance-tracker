import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  mockCompactLayout,
  mockFetch,
  response,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("dashboard workflow", () => {
  it("retries a failed dashboard resource load", async () => {
    let dashboardAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/dashboard")) {
        dashboardAttempts += 1;
        if (dashboardAttempts === 1) throw new TypeError("Load failed");
        return response(dashboardPayload({}));
      }
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    const alert = await screen.findByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "June 2026" }),
    ).toBeVisible();
    expect(dashboardAttempts).toBe(2);
  });

  it("exposes downloadable dashboard artifacts for the selected period", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "June 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Month report").closest("a")).toHaveAttribute(
      "href",
      "/api/reports/monthly.txt?month=7&year=2026",
    );
    expect(screen.getByText("Month chart").closest("a")).toHaveAttribute(
      "href",
      "/api/charts/monthly.png?month=7&year=2026",
    );
    expect(screen.getByText("Trend report").closest("a")).toHaveAttribute(
      "href",
      "/api/reports/trends.txt?months=6&end_month=7&end_year=2026",
    );
    expect(screen.getByText("Trend chart").closest("a")).toHaveAttribute(
      "href",
      "/api/charts/trends.png?months=6&end_month=7&end_year=2026",
    );
    const reportMenu = document.querySelector(".artifact-popover");
    const reportMenuHeading = within(reportMenu as HTMLElement).getByText(
      "Reports and exports",
    );
    expect(reportMenu).toHaveAttribute("aria-labelledby", reportMenuHeading.id);
    expect(screen.getAllByText("TXT")).toHaveLength(2);
    expect(screen.getAllByText("PNG")).toHaveLength(2);
  });

  it("changes the dashboard period from the compact period control", async () => {
    const fetchMock = mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "June 2026" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Next month,/ }));

    await waitFor(() => {
      const dashboardCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/api/dashboard"),
      );
      expect(dashboardCalls.length).toBeGreaterThan(1);
    });
  });

  it("accumulates rapid period clicks without waiting for a render", async () => {
    const fetchMock = mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });

    const next = screen.getByRole("button", { name: /^Next month,/ });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);

    await waitFor(() => {
      const dashboardCalls = fetchMock.mock.calls.map(([input]) =>
        String(input),
      );
      expect(
        dashboardCalls.some((url) => url.includes("month=10&year=2026")),
      ).toBe(true);
    });
  });

  it("groups period navigation and export in a contextual toolbar", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    await screen.findByRole("heading", { name: "June 2026" });
    const toolbar = screen.getByLabelText("Dashboard period and export tools");

    expect(
      within(toolbar).getByRole("button", { name: /^Previous month,/ }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: /^Choose period,/ }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", {
        name: "Download dashboard artifacts",
      }),
    ).toHaveTextContent("Export");

    const actions = screen.getByLabelText("Next actions");
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Set budget"]);
    expect(actions.closest(".dashboard-command-row")).toContainElement(toolbar);
    expect(document.querySelector(".quick-actions")).not.toBeInTheDocument();
  });

  it("keeps the compact export panel in normal stacking as its anchor scrolls", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
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
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(<App />);

    await screen.findByRole("heading", { name: "June 2026" });
    const appBar = document.querySelector<HTMLElement>(".compact-app-bar")!;
    const popover = document.querySelector<HTMLElement>(".artifact-popover")!;
    const trigger = screen.getByRole("button", {
      name: "Download dashboard artifacts",
    });
    const bottomNavigation = document.querySelector<HTMLElement>(
      ".compact-primary-navigation",
    )!;

    Object.defineProperties(popover, {
      scrollHeight: { configurable: true, value: 256 },
    });
    vi.spyOn(appBar, "getBoundingClientRect").mockReturnValue(
      elementBounds(0, 64),
    );
    vi.spyOn(bottomNavigation, "getBoundingClientRect").mockReturnValue(
      elementBounds(447, 520),
    );
    vi.spyOn(popover, "getBoundingClientRect").mockReturnValue(
      elementBounds(-47, 139),
    );
    let triggerBounds = elementBounds(40, 88);
    vi.spyOn(trigger, "getBoundingClientRect").mockImplementation(
      () => triggerBounds,
    );

    await userEvent.click(trigger);
    fireEvent.scroll(document);

    expect(popover).not.toHaveAttribute("popover");
    expect(popover).toHaveAttribute("data-open", "true");
    expect(popover.style.maxBlockSize).toBe("320px");
    expect(popover.style.clipPath).toBe("");

    triggerBounds = elementBounds(252, 300);
    fireEvent.scroll(document);

    expect(popover.style.maxBlockSize).toBe("131px");

    triggerBounds = elementBounds(23, 71);
    fireEvent.scroll(document);

    expect(popover).toHaveAttribute("data-open", "true");
    expect(popover.style.maxBlockSize).toBe("320px");

    await userEvent.keyboard("{Escape}");
    expect(popover).not.toHaveAttribute("data-open");
    expect(popover).toHaveAttribute("hidden");
    expect(trigger).toHaveFocus();
  });

  it("opens the compact period picker as a modal bottom sheet", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });
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

    render(<App />);

    await screen.findByRole("heading", { name: "June 2026" });
    const trigger = screen.getByRole("button", { name: /^Choose period,/ });
    const picker =
      document.querySelector<HTMLDialogElement>(".period-popover")!;

    expect(picker).not.toHaveAttribute("popover");
    expect(picker).not.toHaveAttribute("open");

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(picker).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "July" })).toHaveFocus();

    fireEvent(picker, new Event("cancel", { cancelable: true }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(picker).not.toHaveAttribute("open");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("chooses a month directly from the period picker", async () => {
    window.history.replaceState({}, "", "/cash-flow?month=6&year=2026");
    const fetchMock = mockFetch({
      "/api/dashboard": dashboardPayload({}),
    });
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

    render(<App />);

    await screen.findByRole("heading", { name: "June 2026" });
    await userEvent.click(
      screen.getByRole("button", { name: /^Choose period,/ }),
    );

    const picker = screen.getByRole("dialog", { name: "Choose a period" });
    expect(
      within(picker).getByRole("button", { name: "July" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      within(picker).getByRole("button", { name: "Next year, 2027" }),
    );
    await userEvent.click(
      within(picker).getByRole("button", { name: "January" }),
    );

    await waitFor(() => {
      const dashboardCalls = fetchMock.mock.calls.map(([input]) =>
        String(input),
      );
      expect(
        dashboardCalls.some((url) => url.includes("month=1&year=2027")),
      ).toBe(true);
    });
    expect(picker).not.toHaveAttribute("open");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Choose period,/ }),
      ).toHaveFocus();
    });
  });

  it("keeps one global entry action that moves creation to Activity", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });
    expect(
      within(screen.getByLabelText("Next actions")).queryByRole("button", {
        name: "Add entry",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      document.querySelector<HTMLButtonElement>(".rail-create")!,
    );

    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toHaveAttribute("open");
  });

  it("opens the selected-period budget form from the dashboard", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });
    await userEvent.click(
      within(screen.getByLabelText("Next actions")).getByRole("button", {
        name: "Set budget",
      }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Set budget" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByLabelText("Month")).toHaveValue("7");
    expect(within(dialog).getByLabelText("Year")).toHaveValue(2026);
  });

  it("uses Add entry consistently for every global create command", async () => {
    mockCompactLayout();
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });

    expect(document.querySelector(".rail-create")).not.toBeInTheDocument();
    expect(document.querySelector(".compact-create")).toHaveAccessibleName(
      "Add entry",
    );
  });

  it("presents the period as one cashflow story with budget setup guidance", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByText("$2,113.60 remained after expenses this month."),
    ).toBeInTheDocument();
    expect(screen.getByText("No budgets for this period")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "All transactions" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Latest activity")).not.toBeInTheDocument();
    expect(screen.getByText("-$45.90")).toBeInTheDocument();
    expect(screen.getByText("Expense")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
  });

  it("ranks risks, summarizes impact, and progressively discloses the queue", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: attentionStatuses(),
      }),
    });

    render(<App />);

    const heading = await screen.findByRole("heading", {
      name: "Needs attention",
    });
    const panel = heading.closest("article")!;

    expect(panel).toHaveTextContent(
      "3 over budget by $1,596.40 · 4 near limit with $38.51 left",
    );
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map(
          (item) => item.querySelector(".pressure-copy > strong")?.textContent,
        ),
    ).toEqual(["Rent", "Travel", "Household"]);
    expect(within(panel).getAllByText("Over budget")).toHaveLength(3);
    expect(within(panel).getAllByText("Review overage")).toHaveLength(3);
    expect(
      within(panel).getByRole("progressbar", {
        name: "Rent budget used 193.8%",
      }),
    ).toHaveAttribute("value", "100");
    expect(
      within(panel).queryByRole("button", {
        name: "Review Dining limit in Plan",
      }),
    ).not.toBeInTheDocument();

    const disclosure = within(panel).getByRole("button", {
      name: "Show 4 more",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(disclosure);

    expect(disclosure).toHaveAccessibleName("Show fewer");
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(7);
    expect(within(panel).getAllByText("Near limit")).toHaveLength(4);
    expect(within(panel).getAllByText("Review limit")).toHaveLength(4);
    expect(
      within(panel).getByRole("button", {
        name: "Review Dining limit in Plan",
      }),
    ).toBeInTheDocument();

    await userEvent.click(disclosure);
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(disclosure);

    await userEvent.click(screen.getByRole("button", { name: /^Next month,/ }));

    await waitFor(() =>
      expect(
        within(panel).getByRole("button", { name: "Show 4 more" }),
      ).toHaveAttribute("aria-expanded", "false"),
    );
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows a positive state when every configured budget is on track", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: [
          attentionStatus(1, "Food", "ok", "60.00", "40.0", "40.00"),
        ],
      }),
    });

    render(<App />);

    expect(
      await screen.findByText("All budgets are on track"),
    ).toBeInTheDocument();
    expect(screen.getByText("Budgets checked: 1")).toBeInTheDocument();
    expect(
      screen.queryByText("No budgets for this period"),
    ).not.toBeInTheDocument();
  });

  it("opens the matching period and category in Plan from a risk", async () => {
    const travelStatus = attentionStatus(
      1,
      "Travel & Fun",
      "over budget",
      "-35.00",
      "123.3",
      "185.00",
    );
    mockFetch({
      "/api/dashboard": dashboardPayload({ budget_statuses: [travelStatus] }),
      "/api/budgets/status": { statuses: [travelStatus] },
      "/api/budgets": { budgets: [travelStatus.budget] },
    });

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Review Travel & Fun overage in Plan",
      }),
    );

    expect(window.location.pathname).toBe("/budgets");
    expect(window.location.search).toBe(
      "?month=6&year=2026&category=Travel+%26+Fun",
    );
    expect(
      await screen.findByRole("heading", { name: "Your June 2026 plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Find a category" }),
    ).toHaveValue("Travel & Fun");
    expect(document.title).toBe("Plan | Personal Finance Tracker");
    await waitFor(() => expect(document.querySelector("main")).toHaveFocus());
  });

  it("uses one heading for the cashflow trend emphasis", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const trendHeading = await screen.findByRole("heading", {
      name: "Six-month cashflow trend",
    });
    const trendPanel = trendHeading.closest("article");

    expect(trendHeading).toHaveAccessibleName("Six-month cashflow trend");
    expect(trendPanel).toHaveTextContent(
      "Income, expenses, and net savings by period.",
    );
    expect(
      within(trendPanel!).getByRole("figure", {
        name: "Six-month income, expense, and net savings trend",
      }),
    ).toBeInTheDocument();
    expect(within(trendPanel!).getAllByRole("heading")).toHaveLength(1);
  });

  it("keeps recent activity and expense mix visible in the analysis pair", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    const activityHeading = await screen.findByRole("heading", {
      name: "Recent activity",
    });
    const mixHeading = screen.getByRole("heading", { name: "Expense mix" });
    const analysisPair = document.querySelector(".dashboard-analysis-pair");

    expect(analysisPair).toContainElement(activityHeading.closest("article"));
    expect(analysisPair).toContainElement(mixHeading.closest("article"));
    expect(
      screen.queryByText("Category mix and reports"),
    ).not.toBeInTheDocument();
    expect(mixHeading.closest("details")).toBeNull();
  });

  it("groups the supporting cashflow metrics in a semantic definition list", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    await screen.findByText("MONTHLY NET CASHFLOW");
    const metrics = document.querySelector<HTMLElement>(".cashflow-comparison");

    expect(metrics).toBeInstanceOf(HTMLDListElement);
    expect(within(metrics!).getByText("Income").tagName).toBe("DT");
    expect(within(metrics!).getByText("$2,500.00").closest("dd")?.tagName).toBe(
      "DD",
    );
    expect(within(metrics!).getByText("Expenses").tagName).toBe("DT");
    expect(within(metrics!).getByText("$386.40").closest("dd")?.tagName).toBe(
      "DD",
    );
    expect(within(metrics!).getByText("Savings rate").tagName).toBe("DT");
    expect(within(metrics!).getByText("84.5%").closest("dd")?.tagName).toBe(
      "DD",
    );
    expect(metrics!.querySelector(".cashflow-metric-savings")).toHaveClass(
      "positive",
    );
  });

  it("explains negative and unchanged long net values without relying on color", async () => {
    const payload = dashboardPayload({});
    mockFetch({
      "/api/dashboard": dashboardPayload({
        report: {
          ...payload.report,
          total_income: "1234567890.12",
          total_expenses: "2469135780.24",
          net_savings: "-1234567890.12",
          net_savings_delta: "0.00",
        },
        savings_rate: "-100.0",
      }),
    });

    render(<App />);

    expect(
      await screen.findByText(
        "Expenses exceeded income by $1,234,567,890.12 this month.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Unchanged from last month.")).toBeInTheDocument();
    expect(screen.getByText("-$1,234,567,890.12")).toBeInTheDocument();
    expect(document.querySelector(".balance-story")).toHaveClass("negative");
    expect(document.querySelector(".cashflow-metric-savings")).toHaveClass(
      "negative",
    );
  });
});

function attentionStatuses() {
  return [
    attentionStatus(1, "Dining", "near limit", "5.70", "96.6", "164.30"),
    attentionStatus(
      2,
      "Rent",
      "over budget",
      "-1500.00",
      "193.8",
      "3100.00",
      "1600.00",
    ),
    attentionStatus(
      3,
      "Subscriptions",
      "near limit",
      "5.01",
      "90.0",
      "44.99",
      "50.00",
    ),
    attentionStatus(
      4,
      "Household",
      "over budget",
      "-6.40",
      "103.6",
      "186.40",
      "180.00",
    ),
    attentionStatus(5, "Health", "near limit", "8.00", "92.0", "92.00"),
    attentionStatus(
      6,
      "Travel",
      "over budget",
      "-90.00",
      "116.4",
      "640.00",
      "550.00",
    ),
    attentionStatus(
      7,
      "Utilities",
      "near limit",
      "19.80",
      "91.2",
      "205.20",
      "225.00",
    ),
  ];
}

function attentionStatus(
  id: number,
  category: string,
  status: string,
  remaining: string,
  percentUsed: string,
  actualExpenses: string,
  amount = "100.00",
) {
  return {
    budget: {
      id,
      category,
      amount,
      month: 6,
      year: 2026,
      created_at: "2026-06-01T12:00:00",
    },
    actual_expenses: actualExpenses,
    remaining,
    percent_used: percentUsed,
    status,
  };
}

function elementBounds(top: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 0,
    right: 100,
    top,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}
