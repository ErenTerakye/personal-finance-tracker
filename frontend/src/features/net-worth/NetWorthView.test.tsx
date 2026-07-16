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
      "/api/net-worth/overview": overview(emptySummary, [], []),
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
      "/api/net-worth/overview": overview(
        {
          ...emptySummary,
          total_assets: "1100.00",
          total_liabilities: "1250.00",
          total_net_worth: "-150.00",
          active_account_count: 2,
          resolved_asset_count: 1,
          resolved_liability_count: 1,
        },
        [
          historyPoint("2026-06-30", "1000.00", "1200.00", "-200.00"),
          historyPoint("2026-07-16", "1100.00", "1250.00", "-150.00"),
        ],
        [
          analytics(1, "Savings", "asset", "1100.00", "1000.00", "100.00"),
          analytics(2, "Loan", "liability", "1250.00", "1200.00", "-50.00"),
        ],
      ),
    });

    render(<App />);

    expect((await screen.findAllByText("-$150.00"))[0]).toBeVisible();
    expect(screen.getAllByText("Savings")[0]).toBeVisible();
    expect(screen.getAllByText("Loan")[0]).toBeVisible();
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

  it("does not calculate change from an unknown comparison balance", async () => {
    window.history.pushState({}, "", "/?months=6");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/net-worth/overview": overview(
        {
          ...emptySummary,
          total_assets: "1100.00",
          total_net_worth: "1100.00",
          active_account_count: 1,
          resolved_asset_count: 1,
        },
        [
          historyPoint("2026-06-30", "0.00", "0.00", "0.00"),
          historyPoint("2026-07-16", "1100.00", "0.00", "1100.00"),
        ],
        [analytics(1, "New savings", "asset", "1100.00", null, null)],
      ),
    });

    render(<App />);

    expect(
      await screen.findByText(
        /Change is unavailable because one or more accounts/,
      ),
    ).toBeVisible();
    expect(screen.queryByText("Since June 30, 2026")).toBeNull();
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
      "/api/net-worth/overview": overview(
        {
          ...emptySummary,
          total_assets: "1100.00",
          total_net_worth: "1100.00",
          active_account_count: 1,
          resolved_asset_count: 1,
        },
        [historyPoint("2026-07-16", "1100.00", "0.00", "1100.00")],
        [analytics(1, "Savings", "asset", "1100.00", "1100.00", "0.00")],
      ),
    });

    render(<App />);

    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Manage" }))[0],
    );
    await userEvent.click(screen.getByRole("button", { name: "History" }));
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

  it("submits only changed rows from the balance check-in", async () => {
    window.history.pushState({}, "", "/");
    const fetchMock = mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts/balance-check-ins": {
        notice: "1 account balance updated.",
        notice_code: "balance_check_in.saved",
        balance_snapshots: [],
        replaced_count: 0,
      },
      "/api/net-worth/overview": overview(
        {
          ...emptySummary,
          total_assets: "1100.00",
          total_liabilities: "1250.00",
          total_net_worth: "-150.00",
          active_account_count: 2,
          resolved_asset_count: 1,
          resolved_liability_count: 1,
        },
        [
          historyPoint("2026-06-30", "1000.00", "1200.00", "-200.00"),
          historyPoint("2026-07-16", "1100.00", "1250.00", "-150.00"),
        ],
        [
          analytics(1, "Savings", "asset", "1100.00", "1000.00", "100.00"),
          analytics(2, "Loan", "liability", "1250.00", "1200.00", "-50.00"),
        ],
      ),
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Update balances" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Update balances" });
    const amountInputs = within(dialog).getAllByRole("spinbutton");
    await userEvent.type(amountInputs[0], "1150");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save 1 update(s)" }),
    );

    const request = fetchMock.mock.calls.find(([input]) =>
      String(input).startsWith("/api/accounts/balance-check-ins/"),
    );
    expect(request).toBeDefined();
    const options = (
      request as unknown as [RequestInfo | URL, RequestInit | undefined]
    )?.[1];
    expect(JSON.parse(String(options?.body))).toEqual({
      updates: [{ account_id: 1, amount: "1150" }],
    });
  });
});

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

function analytics(
  accountId: number,
  name: string,
  type: "asset" | "liability",
  current: string,
  comparison: string | null,
  contribution: string | null,
) {
  return {
    account_id: accountId,
    name,
    type,
    archived_on: null,
    current_balance: current,
    current_balance_date: "2026-07-16",
    comparison_balance: comparison,
    comparison_balance_date: comparison === null ? null : "2026-06-30",
    contribution_change: contribution,
    composition_percent: "100.0",
    currency: "USD",
  };
}

function overview(
  summary: typeof emptySummary,
  points: ReturnType<typeof historyPoint>[],
  accounts: ReturnType<typeof analytics>[],
) {
  const start = points[0]?.as_of ?? summary.as_of;
  const comparisonAvailable =
    points.length > 1 &&
    accounts.length > 0 &&
    accounts.every((account) => account.contribution_change !== null);
  return {
    summary,
    history: {
      as_of: summary.as_of,
      months: 12,
      points,
      change_amount: points.length > 1 ? "50.00" : null,
      change_percent: points.length > 1 ? "25.0" : null,
      currency: "USD",
    },
    comparison: {
      start_date: start,
      end_date: summary.as_of,
      available: comparisonAvailable,
      start_value: comparisonAvailable
        ? (points[0]?.total_net_worth ?? summary.total_net_worth)
        : null,
      end_value: comparisonAvailable ? summary.total_net_worth : null,
      change_amount: comparisonAvailable ? "50.00" : null,
      change_percent: comparisonAvailable ? "25.0" : null,
    },
    accounts,
    coverage: {
      resolved_account_count:
        summary.resolved_asset_count + summary.resolved_liability_count,
      unresolved_account_count: summary.unresolved_account_count,
      oldest_balance_date: accounts.length ? "2026-06-30" : null,
    },
    currency: "USD",
  };
}
