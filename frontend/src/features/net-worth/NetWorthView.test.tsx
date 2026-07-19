import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  mockFetch,
  response,
} from "../../test/appTestSupport";

installAppTestLifecycle();

const account = {
  id: 1,
  name: "Everyday checking",
  type: "asset",
  subtype: "cash",
  archived_on: null,
  created_at: "2026-01-01T00:00:00",
  as_of: "2026-07-19",
  balance: "-25.00",
  balance_state: "overdrawn",
  opening_balance: "1000.00",
  opening_date: "2026-01-01",
  opening_activity_id: 1,
  currency: "USD",
};

const overview = {
  summary: {
    as_of: "2026-07-19",
    total_assets: "-25.00",
    total_liabilities: "0.00",
    total_net_worth: "-25.00",
    active_account_count: 1,
    archived_account_count: 0,
    resolved_asset_count: 1,
    resolved_liability_count: 0,
    account_state_warning_count: 1,
    currency: "USD",
  },
  history: {
    as_of: "2026-07-19",
    months: 2,
    points: [
      {
        as_of: "2026-06-30",
        total_assets: "100.00",
        total_liabilities: "0.00",
        total_net_worth: "100.00",
        resolved_asset_count: 1,
        resolved_liability_count: 0,
        account_state_warning_count: 0,
      },
      {
        as_of: "2026-07-19",
        total_assets: "-25.00",
        total_liabilities: "0.00",
        total_net_worth: "-25.00",
        resolved_asset_count: 1,
        resolved_liability_count: 0,
        account_state_warning_count: 1,
      },
    ],
    change_amount: "-125.00",
    change_percent: "-125.0",
    currency: "USD",
  },
  comparison: {
    start_date: "2026-06-30",
    end_date: "2026-07-19",
    available: true,
    start_value: "100.00",
    end_value: "-25.00",
    change_amount: "-125.00",
    change_percent: "-125.0",
  },
  accounts: [],
  account_state: { warning_count: 1, oldest_activity_date: "2026-01-01" },
  attribution: {
    cashflow: "-100.00",
    adjustments: "-25.00",
    transfers: "0.00",
  },
  currency: "USD",
};

function route() {
  return document.querySelector<HTMLElement>(
    '[data-route="accounts"].is-active',
  )!;
}

describe("account activity workflow", () => {
  it("shows derived opening provenance and negative-balance attention", async () => {
    window.history.replaceState({}, "", "/accounts?months=2");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/net-worth/overview": overview,
      "/api/accounts": { accounts: [account] },
    });
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Accounts" }),
    ).toBeVisible();
    expect(within(route()).getAllByText("Everyday checking")[0]).toBeVisible();
    expect(within(route()).getByText("Overdrawn")).toBeVisible();
    expect(within(route()).getByText(/1,000\.00.*2026-01-01/)).toBeVisible();
    expect(within(route()).getByText("Income and expenses")).toBeVisible();
    expect(within(route()).getByText("Transfers")).toBeVisible();
    expect(within(route()).getAllByText("$0.00").length).toBeGreaterThan(0);
    expect(
      within(route()).getByRole("link", { name: "Activity" }),
    ).toHaveAttribute("href", "/activity?account_id=1");
    expect(within(route()).getAllByRole("table")).toHaveLength(1);
  });

  it("records an observed balance from the account context", async () => {
    window.history.replaceState({}, "", "/accounts");
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/settings"))
          return response({ currency: "USD" });
        if (url.startsWith("/api/net-worth/overview"))
          return response(overview);
        if (url.startsWith("/api/accounts"))
          return response({ accounts: [account] });
        if (url === "/api/activities" && init?.method === "POST") {
          submitted = JSON.parse(String(init.body));
          return response({
            notice: "Balance updated.",
            notice_code: "activity.created",
          });
        }
        return response({});
      }),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByText("Everyday checking").length).toBeGreaterThan(
        0,
      ),
    );
    await userEvent.click(
      within(route()).getByRole("button", {
        name: "Actions for Everyday checking",
      }),
    );
    await userEvent.click(
      within(route()).getByRole("menuitem", { name: "Update balance" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Update Everyday checking balance",
    });
    const balance = within(dialog).getByLabelText("Observed balance");
    await userEvent.clear(balance);
    await userEvent.type(balance, "50.00");
    expect(within(dialog).getByText(/Net-worth effect.*75\.00/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(submitted).toMatchObject({
        kind: "adjustment",
        amount: "50.00",
        account_id: 1,
      }),
    );
  });

  it("creates an account with subtype and dated opening balance", async () => {
    window.history.replaceState({}, "", "/accounts");
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/settings"))
          return response({ currency: "USD" });
        if (url.startsWith("/api/net-worth/overview"))
          return response(overview);
        if (url === "/api/accounts" && init?.method === "POST") {
          submitted = JSON.parse(String(init.body));
          return response({
            notice: "Account created.",
            notice_code: "account.created",
          });
        }
        if (url.startsWith("/api/accounts"))
          return response({ accounts: [account] });
        return response({});
      }),
    );
    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByText("Everyday checking").length).toBeGreaterThan(
        0,
      ),
    );
    await userEvent.click(
      within(route()).getByRole("button", { name: "Add account" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add account" });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Liability" }),
    );
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Subtype"),
      "loan",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Account"),
      "Education loan",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Opening balance"),
      "9000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add account" }),
    );
    await waitFor(() =>
      expect(submitted).toMatchObject({
        name: "Education loan",
        type: "liability",
        subtype: "loan",
        opening_balance: "9000",
      }),
    );
  });
});
