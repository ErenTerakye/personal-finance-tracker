import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const routes = [
  { path: "/", heading: "Overview" },
  { path: "/activity", heading: "Activity" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/accounts", heading: "Accounts" },
  { path: "/manage/automations", heading: "Automations" },
  { path: "/manage/categories", heading: "Categories" },
  { path: "/manage/data", heading: "Data" },
  { path: "/manage/preferences", heading: "Preferences" },
];

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test.describe(`accessibility at ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockApi(page);
    });

    for (const route of routes) {
      test(`${route.heading} has no serious automated accessibility issues`, async ({
        page,
      }) => {
        await page.goto(route.path);
        await expect(
          page.getByRole("heading", {
            name: route.heading,
            exact: true,
            level: 1,
          }),
        ).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(
          results.violations.filter(
            (violation) =>
              violation.impact === "serious" || violation.impact === "critical",
          ),
        ).toEqual([]);
      });
    }
  });
}

test.describe("activity keyboard and route behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("navigates to Activity and focuses its route heading", async ({
    page,
  }) => {
    await page.goto("/");
    const link = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Activity" });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/activity$/);
    await expect(
      page.getByRole("heading", { name: "Activity", exact: true }),
    ).toBeFocused();
  });

  test("opens and closes the account-aware activity dialog by keyboard", async ({
    page,
  }) => {
    await page.goto("/activity");
    const add = page.getByRole("button", { name: "Add activity" }).first();
    await add.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Add activity" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Account")).toBeVisible();
    await expect.poll(() => dialogContainsFocus(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
  });

  test("preserves supported query context through the legacy route", async ({
    page,
  }) => {
    await page.goto(
      "/transactions?month=5&year=2026&kind=expense&account_id=1&search=Rent&discard=1",
    );
    await expect(page).toHaveURL(
      "/activity?month=5&year=2026&kind=expense&account_id=1&search=Rent",
    );
    await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue(
      "Rent",
    );
    await expect(page.getByLabel("Kind")).toHaveValue("expense");
    await expect(
      page.getByRole("region", { name: "Find activity" }).getByLabel("Account"),
    ).toHaveValue("1");
  });

  test("keeps dialog controls visible in forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/activity");
    await page.getByRole("button", { name: "Add activity" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add activity" });
    await expect(dialog.getByLabel("Amount")).toBeVisible();
    await expect
      .poll(() =>
        dialog.evaluate((element) => getComputedStyle(element).borderStyle),
      )
      .not.toBe("none");
  });
});

test("announces a recoverable Activity load error and retries by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mockApi(page);
  let attempts = 0;
  let shouldFail = true;
  await page.route("**/api/activities**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/activities") return route.fallback();
    attempts += 1;
    if (shouldFail) {
      await route.fulfill({
        status: 503,
        json: { detail: { error: "Load failed" } },
      });
      return;
    }
    await route.fulfill({ json: { activities: [], page: pageInfo(0) } });
  });
  await page.goto("/activity");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Load failed");
  shouldFail = false;
  const retry = alert.getByRole("button", { name: "Retry" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("No activity matches these filters."),
  ).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});

async function dialogContainsFocus(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector("dialog[open]");
    return Boolean(active && dialog?.contains(active));
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    if (url.pathname === "/api/dashboard") {
      await route.fulfill({ json: dashboard() });
    } else if (url.pathname === "/api/settings") {
      await route.fulfill({ json: { currency: "USD" } });
    } else if (url.pathname === "/api/accounts") {
      await route.fulfill({ json: { accounts: [account()] } });
    } else if (url.pathname === "/api/activities") {
      await route.fulfill({
        json: { activities: [activity()], page: pageInfo(1) },
      });
    } else if (url.pathname === "/api/net-worth/overview") {
      await route.fulfill({ json: netWorthOverview() });
    } else if (url.pathname === "/api/budgets/status") {
      await route.fulfill({ json: { statuses: [budgetStatus()] } });
    } else if (url.pathname === "/api/budgets") {
      await route.fulfill({ json: { budgets: [budget()], page: pageInfo(1) } });
    } else if (url.pathname === "/api/category-rules") {
      await route.fulfill({ json: { rules: [] } });
    } else if (url.pathname === "/api/recurring-templates") {
      await route.fulfill({ json: { templates: [] } });
    } else {
      await route.fulfill({
        status: 404,
        json: { error: { message: `Unhandled mock ${url.pathname}` } },
      });
    }
  });
}

function account() {
  return {
    id: 1,
    name: "Checking",
    type: "asset",
    subtype: "cash",
    archived_on: null,
    created_at: "2026-01-01T00:00:00",
    as_of: "2026-07-16",
    balance: "1054.10",
    balance_state: "normal",
    opening_balance: "1000.00",
    opening_date: "2026-01-01",
    opening_activity_id: 1,
    currency: "USD",
  };
}

function effect() {
  return {
    id: 1,
    name: "Checking",
    type: "asset",
    subtype: "cash",
    role: "account",
    before_balance: "1100.00",
    after_balance: "1054.10",
    balance_effect: "-45.90",
    balance_state: "normal",
  };
}

function activity() {
  return {
    id: 2,
    kind: "expense",
    amount: "45.90",
    category: "Food",
    description: "Groceries",
    date: "2026-06-12",
    account: effect(),
    from_account: null,
    to_account: null,
    net_worth_effect: "-45.90",
    cashflow_effect: "-45.90",
    created_at: "2026-06-12T12:00:00",
    updated_at: "2026-06-12T12:00:00",
  };
}

function budget() {
  return {
    id: 1,
    category: "Food",
    amount: "100.00",
    month: 6,
    year: 2026,
    created_at: "2026-01-01T00:00:00",
  };
}

function budgetStatus() {
  return {
    budget: budget(),
    actual_expenses: "45.90",
    remaining: "54.10",
    percent_used: "45.9",
    status: "ok",
  };
}

function pageInfo(total: number) {
  return { limit: 100, offset: 0, total };
}

function netWorthSummary() {
  return {
    as_of: "2026-07-16",
    total_assets: "1054.10",
    total_liabilities: "0.00",
    total_net_worth: "1054.10",
    active_account_count: 1,
    archived_account_count: 0,
    resolved_asset_count: 1,
    resolved_liability_count: 0,
    account_state_warning_count: 0,
    currency: "USD",
  };
}

function netWorthOverview() {
  return {
    summary: netWorthSummary(),
    history: {
      as_of: "2026-07-16",
      months: 12,
      points: [netWorthSummary()],
      change_amount: null,
      change_percent: null,
      currency: "USD",
    },
    comparison: {
      start_date: "2026-07-16",
      end_date: "2026-07-16",
      available: true,
      start_value: "1054.10",
      end_value: "1054.10",
      change_amount: "0.00",
      change_percent: "0.0",
    },
    accounts: [],
    account_state: { warning_count: 0, oldest_activity_date: "2026-01-01" },
    attribution: { cashflow: "54.10", adjustments: "0.00", transfers: "0.00" },
    currency: "USD",
  };
}

function dashboard() {
  return {
    month: 6,
    year: 2026,
    period_label: "June 2026",
    report: {
      month: 6,
      year: 2026,
      total_income: "100.00",
      total_expenses: "45.90",
      net_savings: "54.10",
      transaction_count: 2,
      income_by_category: { Salary: "100.00" },
      expenses_by_category: { Food: "45.90" },
      ytd_income: "100.00",
      ytd_expenses: "45.90",
      ytd_net_savings: "54.10",
      income_delta: "100.00",
      expenses_delta: "45.90",
      net_savings_delta: "54.10",
    },
    trend: {
      months: [],
      total_income: "100.00",
      total_expenses: "45.90",
      net_savings: "54.10",
      transaction_count: 2,
      top_expense_categories: { Food: "45.90" },
    },
    savings_rate: "54.1",
    recent_activities: [activity()],
    budget_statuses: [budgetStatus()],
    net_worth: netWorthSummary(),
    currency: "USD",
  };
}
