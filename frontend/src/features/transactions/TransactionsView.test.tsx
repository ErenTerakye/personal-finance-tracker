import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  activity,
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
  balance: "954.10",
  balance_state: "normal",
  opening_balance: "1000.00",
  opening_date: "2026-01-01",
  opening_activity_id: 1,
  currency: "USD",
};

const emptyPage = {
  activities: [],
  page: { limit: 100, offset: 0, total: 0 },
};

function route() {
  return document.querySelector<HTMLElement>(
    '[data-route="transactions"].is-active',
  )!;
}

describe("activity workflow", () => {
  it("renders semantic account references and calculated effects", async () => {
    window.history.replaceState({}, "", "/activity?kind=expense");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [account] },
      "/api/activities": {
        activities: [activity()],
        page: { limit: 100, offset: 0, total: 1 },
      },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Activity" }),
    ).toBeVisible();
    await userEvent.type(within(route()).getByLabelText("Search"), "Groceries");
    expect(await within(route()).findByText("Groceries")).toBeVisible();
    expect(
      within(route()).getByRole("button", { name: "Everyday checking" }),
    ).toBeVisible();
    expect(within(route()).getByText(/1,000\.00.*954\.10/)).toBeVisible();
    expect(within(route()).getByLabelText("Kind")).toHaveValue("expense");
  });

  it("requires an account and previews an exact expense effect", async () => {
    window.history.replaceState({}, "", "/activity");
    let submitted: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/settings"))
          return response({ currency: "USD" });
        if (url.startsWith("/api/accounts"))
          return response({ accounts: [account] });
        if (url === "/api/activities" && init?.method === "POST") {
          submitted = JSON.parse(String(init.body));
          return response({
            notice: "Activity added.",
            notice_code: "activity.created",
            activity: activity(),
          });
        }
        if (url.startsWith("/api/activities")) return response(emptyPage);
        return response({});
      }),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Activity" });

    await userEvent.click(
      within(route()).getAllByRole("button", { name: "Add activity" })[0],
    );
    const dialog = screen.getByRole("dialog", { name: "Add activity" });
    expect(within(dialog).getByLabelText("Account")).toBeRequired();
    await userEvent.type(within(dialog).getByLabelText("Amount"), "45.90");
    await userEvent.selectOptions(
      within(dialog).getByLabelText("Account"),
      "1",
    );
    await userEvent.type(within(dialog).getByLabelText("Category"), "Food");
    expect(within(dialog).getByText(/954\.10.*908\.20/)).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add activity" }),
    );

    await waitFor(() =>
      expect(submitted).toMatchObject({
        kind: "expense",
        amount: "45.90",
        category: "Food",
        account_id: 1,
      }),
    );
  });

  it("offers transfer creation with distinct account fields", async () => {
    window.history.replaceState({}, "", "/activity");
    const savings = {
      ...account,
      id: 2,
      name: "Emergency fund",
      balance: "500.00",
    };
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [account, savings] },
      "/api/activities": emptyPage,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Activity" });

    await userEvent.click(
      within(route()).getAllByRole("button", { name: "Add activity" })[0],
    );
    const dialog = screen.getByRole("dialog", { name: "Add activity" });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Transfer" }),
    );
    expect(within(dialog).getByLabelText("From account")).toBeRequired();
    expect(within(dialog).getByLabelText("To account")).toBeRequired();
    expect(within(dialog).queryByLabelText("Category")).toBeNull();
  });

  it("keeps openings read-only", async () => {
    window.history.replaceState({}, "", "/activity");
    const opening = {
      ...activity(),
      id: 7,
      kind: "opening",
      amount: "1000.00",
      category: null,
      description: "Opening balance",
      cashflow_effect: "0.00",
      net_worth_effect: "1000.00",
    };
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [account] },
      "/api/activities": {
        activities: [opening],
        page: { limit: 100, offset: 0, total: 1 },
      },
    });
    render(<App />);
    expect(await screen.findByText("Read-only")).toBeVisible();
    expect(within(route()).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("opens account-aware CSV preview and exports the active filters", async () => {
    window.history.replaceState({}, "", "/activity?account_id=1");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [account] },
      "/api/activities": emptyPage,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Activity" });
    expect(
      within(route()).getByRole("link", { name: "Export CSV" }),
    ).toHaveAttribute("href", expect.stringContaining("account_id=1"));
    await userEvent.click(
      within(route()).getByRole("button", { name: "Import CSV" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Import activity CSV" }),
    ).toHaveAttribute("open");
  });

  it("restricts the amount field to maximum two decimal places", async () => {
    window.history.replaceState({}, "", "/activity");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [account] },
      "/api/activities": emptyPage,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Activity" });

    await userEvent.click(
      within(route()).getAllByRole("button", { name: "Add activity" })[0],
    );
    const dialog = screen.getByRole("dialog", { name: "Add activity" });
    const amountInput = within(dialog).getByLabelText(
      "Amount",
    ) as HTMLInputElement;

    await userEvent.type(amountInput, "12.345");
    expect(amountInput.value).toBe("12.34");

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "abc");
    expect(amountInput.value).toBe("");
  });
});
