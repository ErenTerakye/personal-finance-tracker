import { render, screen, waitFor } from "@testing-library/react";
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
});
