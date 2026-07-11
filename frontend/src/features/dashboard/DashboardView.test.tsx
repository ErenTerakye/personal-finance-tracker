import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
    ).toEqual(["Add entry", "Set budget"]);
    expect(actions.closest(".dashboard-command-row")).toContainElement(toolbar);
    expect(document.querySelector(".quick-actions")).not.toBeInTheDocument();
  });

  it("opens creation forms directly from the dashboard command row", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { name: "June 2026" });
    await userEvent.click(
      within(screen.getByLabelText("Next actions")).getByRole("button", {
        name: "Add entry",
      }),
    );

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
    expect(screen.getByRole("table")).toBeInTheDocument();
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
    expect(within(metrics!).getByText("$2,500.00").tagName).toBe("DD");
    expect(within(metrics!).getByText("Expenses").tagName).toBe("DT");
    expect(within(metrics!).getByText("$386.40").tagName).toBe("DD");
    expect(within(metrics!).getByText("Savings rate").tagName).toBe("DT");
    expect(within(metrics!).getByText("84.5%").tagName).toBe("DD");
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
