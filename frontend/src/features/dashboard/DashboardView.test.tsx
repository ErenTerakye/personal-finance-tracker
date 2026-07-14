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
  mockFetch,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("dashboard workflow", () => {
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
  });

  it("keeps the compact period picker out of the top layer", async () => {
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
    const popover = document.querySelector<HTMLElement>(".period-popover")!;

    expect(popover).not.toHaveAttribute("popover");
    expect(popover).toHaveAttribute("hidden");

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(popover).not.toHaveAttribute("hidden");
    expect(popover).toHaveAttribute("data-open", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(popover).toHaveAttribute("hidden");
    expect(trigger).toHaveFocus();
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
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });

    expect(document.querySelector(".rail-create")).toHaveTextContent(
      "Add entry",
    );
    expect(document.querySelector(".compact-create")).toHaveAccessibleName(
      "Add entry",
    );
    expect(document.querySelector(".drawer-create")).toHaveTextContent(
      "Add entry",
    );
  });

  it("presents the period as one cashflow story with a quiet attention state", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(
      await screen.findByText("$2,113.60 remained after expenses this month."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nothing needs attention. Spending is within the budgets set for this period.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View all activity" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
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

    await screen.findByText("NET POSITION");
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
