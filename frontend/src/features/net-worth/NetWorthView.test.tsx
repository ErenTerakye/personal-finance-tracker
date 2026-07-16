import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../app/App";
import { installAppTestLifecycle, mockFetch } from "../../test/appTestSupport";

installAppTestLifecycle();

const emptySummary = {
  as_of: "2026-07-16",
  total_assets: "0.00",
  total_liabilities: "0.00",
  total_net_worth: "0.00",
  active_account_count: 0,
  archived_account_count: 0,
  resolved_asset_count: 0,
  resolved_liability_count: 0,
  unresolved_account_count: 0,
  currency: "USD",
};

describe("net worth workflow", () => {
  it("shows first-use education without implying complete zero coverage", async () => {
    window.history.pushState({}, "", "/net-worth");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/net-worth/history": {
        as_of: "2026-07-16",
        months: 12,
        points: [],
        change_amount: null,
        change_percent: null,
        currency: "USD",
      },
      "/api/net-worth": emptySummary,
      "/api/accounts": { accounts: [] },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Net worth", level: 1 }),
    ).toBeVisible();
    expect(screen.getByText("Add your first account")).toBeVisible();
    expect(
      screen.queryByRole("img", { name: /Net worth over time/ }),
    ).toBeNull();
    expect(document.title).toContain("Net worth");
  });

  it("renders signed totals, account composition, focusable points, and table data", async () => {
    window.history.pushState({}, "", "/net-worth?months=6");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/net-worth/history": {
        as_of: "2026-07-16",
        months: 6,
        points: [
          historyPoint("2026-06-30", "1000.00", "1200.00", "-200.00"),
          historyPoint("2026-07-16", "1100.00", "1250.00", "-150.00"),
        ],
        change_amount: "50.00",
        change_percent: "25.0",
        currency: "USD",
      },
      "/api/net-worth": {
        ...emptySummary,
        total_assets: "1100.00",
        total_liabilities: "1250.00",
        total_net_worth: "-150.00",
        active_account_count: 2,
        resolved_asset_count: 1,
        resolved_liability_count: 1,
      },
      "/api/accounts": {
        accounts: [
          account(1, "Savings", "asset", "1100.00"),
          account(2, "Loan", "liability", "1250.00"),
        ],
      },
    });

    render(<App />);

    expect((await screen.findAllByText("-$150.00"))[0]).toBeVisible();
    expect(screen.getByText("Savings")).toBeVisible();
    expect(screen.getByText("Loan")).toBeVisible();
    const chart = screen.getByRole("img", {
      name: /Net worth over time/,
    });
    expect(chart.querySelector("path")?.getAttribute("d")).not.toContain("NaN");
    const points = within(chart).getAllByRole("button");
    expect(points).toHaveLength(2);
    await userEvent.tab();
    await userEvent.click(screen.getByText("Show complete chart data"));
    expect(
      screen.getByRole("table", {
        name: "Net worth history with asset and liability totals",
      }),
    ).toBeVisible();
  });

  it("uses a native destructive dialog that names the sole account snapshot", async () => {
    window.history.pushState({}, "", "/net-worth");
    mockFetch({
      "/api/accounts/1/balance-snapshots": {
        balance_snapshots: [
          {
            id: 1,
            account_id: 1,
            amount: "1100.00",
            effective_date: "2026-07-16",
            created_at: "2026-07-16T00:00:00",
            updated_at: "2026-07-16T00:00:00",
            currency: "USD",
          },
        ],
      },
      "/api/settings": { currency: "USD" },
      "/api/net-worth/history": {
        as_of: "2026-07-16",
        months: 12,
        points: [historyPoint("2026-07-16", "1100.00", "0.00", "1100.00")],
        change_amount: null,
        change_percent: null,
        currency: "USD",
      },
      "/api/net-worth": {
        ...emptySummary,
        total_assets: "1100.00",
        total_net_worth: "1100.00",
        active_account_count: 1,
        resolved_asset_count: 1,
      },
      "/api/accounts": {
        accounts: [account(1, "Savings", "asset", "1100.00")],
      },
    });

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "History" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete account" }),
    );

    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    expect(
      screen.getByRole("heading", {
        name: /Permanently delete Savings and its initial balance/,
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /This permanently removes its only balance, \$1,100\.00 recorded on/,
      ),
    ).toBeVisible();
  });
});

function account(
  id: number,
  name: string,
  type: "asset" | "liability",
  balance: string,
) {
  return {
    id,
    name,
    type,
    archived_on: null,
    created_at: "2026-01-01T00:00:00",
    as_of: "2026-07-16",
    resolved_balance: balance,
    resolved_balance_date: "2026-07-16",
    currency: "USD",
  };
}

function historyPoint(
  asOf: string,
  assets: string,
  liabilities: string,
  total: string,
) {
  return {
    as_of: asOf,
    total_assets: assets,
    total_liabilities: liabilities,
    total_net_worth: total,
    resolved_asset_count: 1,
    resolved_liability_count: 1,
    unresolved_account_count: 0,
  };
}
