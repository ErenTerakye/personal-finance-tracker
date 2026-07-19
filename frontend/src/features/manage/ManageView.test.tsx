import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../../app/App";
import {
  dashboardPayload,
  installAppTestLifecycle,
  mockFetch,
} from "../../test/appTestSupport";

installAppTestLifecycle();

const recurringTemplate = {
  id: 1,
  kind: "expense",
  amount: "1200.00",
  category: "Housing",
  description: "Monthly rent",
  day_of_month: 1,
  account_id: 1,
  from_account_id: null,
  to_account_id: null,
  active: true,
  created_at: "2026-07-01T00:00:00",
  currency: "USD",
};

describe("Manage workflows", () => {
  it("keeps recurring templates in Automations", async () => {
    window.history.replaceState({}, "", "/manage/automations");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/accounts": { accounts: [] },
      "/api/recurring-templates": { templates: [recurringTemplate] },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Automations" }),
    ).toBeVisible();
    expect((await screen.findAllByText("Monthly rent")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText("Imported alias")).toBeNull();
    expect(screen.getByRole("link", { name: "Categories" })).toHaveAttribute(
      "href",
      "/manage/categories",
    );
  });

  it("keeps category normalization in Categories", async () => {
    window.history.replaceState({}, "", "/manage/categories");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/category-rules": {
        rules: [{ id: 1, alias: "uber", category: "Transport" }],
      },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Categories" }),
    ).toBeVisible();
    expect(await screen.findByText("uber")).toBeVisible();
    expect(screen.getByText("Transport")).toBeVisible();
    expect(screen.getByText("Applies to future writes")).toBeVisible();
  });

  it("previews recurring entries and links to the resulting Transactions", async () => {
    window.history.replaceState(
      {},
      "",
      "/manage/automations?month=7&year=2026",
    );
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/recurring-templates/apply": {
        notice: "Recurring entries applied.",
        notice_code: "recurring.applied",
        created_count: 1,
        skipped_duplicates: 0,
        activities: [],
      },
      "/api/recurring-templates": { templates: [recurringTemplate] },
      "/api/accounts": { accounts: [] },
      "/api/activities": {
        activities: [],
        page: { limit: 100, offset: 0, total: 0 },
      },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Review entries" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: /Review July 2026 entries/,
    });
    expect(
      within(dialog).getByText(
        "Entries already created for this month will be skipped.",
      ),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create 1 entries" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "View created activity",
      }),
    );

    expect(window.location.pathname).toBe("/activity");
    expect(window.location.search).toContain("month=7");
    expect(window.location.search).toContain("year=2026");
  });

  it("groups transaction and budget portability in Data", async () => {
    window.history.replaceState({}, "", "/manage/data?month=7&year=2026");
    mockFetch({ "/api/settings": { currency: "USD" } });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Data" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Activity" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Budgets" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Export CSV" })).toHaveLength(2);
    expect(screen.getByText("Your ledger stays local")).toBeVisible();
  });

  it("exposes currency, language, and theme in Preferences", async () => {
    window.history.replaceState({}, "", "/manage/preferences");
    mockFetch({ "/api/settings": { currency: "USD" } });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Preferences" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Ledger currency")).toHaveValue("USD");
    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Turkish" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("keeps Overview available from Manage navigation", async () => {
    window.history.replaceState({}, "", "/manage/data");
    mockFetch({
      "/api/settings": { currency: "USD" },
      "/api/dashboard": dashboardPayload({}),
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Data" });

    await userEvent.click(screen.getByRole("link", { name: "Overview" }));

    expect(window.location.pathname).toBe("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Overview" }),
    ).toBeVisible();
  });
});
