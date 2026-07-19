import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("formats the supported activity boundary without losing a cent", async ({
  page,
}) => {
  await page.goto("/activity");
  await expect(
    page.getByText("$90,071,992,547,409.91", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("$90,071,992,547,409.90")).toHaveCount(0);
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`Activity reflows without document overflow at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/activity");
    await expect(
      page.getByRole("heading", { name: "Activity", exact: true, level: 1 }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(page.locator(".activity-table-scroll")).toHaveCSS(
      "overflow-x",
      "auto",
    );
  });
}

test("account-aware activity dialog fits compact viewports and shows projections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/activity");
  await page.getByRole("button", { name: "Add activity" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add activity" });
  await dialog.getByLabel("Amount").fill("25");
  await dialog.getByLabel("Account").selectOption("1");
  await dialog.getByLabel("Category").fill("Food");
  await expect(
    dialog.getByText("Projected effects", { exact: true }),
  ).toBeVisible();
  const [box, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  ]);
  expect(box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.height).toBeLessThanOrEqual(viewport.height);
});

test("Accounts exposes activity provenance and an Update balance action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/accounts");
  await expect(
    page.getByText(
      "Balances are calculated from the opening and ordered activity.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Activity" }),
  ).toHaveAttribute("href", "/activity?account_id=1");
  await page.getByRole("button", { name: "Update balance" }).click();
  const dialog = page.getByRole("dialog", { name: "Update Checking balance" });
  await expect(dialog.getByLabel("Observed balance")).toHaveValue("1054.10");
});

test("compact navigation switches between canonical primary routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const navigation = page.locator(".compact-primary-navigation");
  for (const [name, path] of [
    ["Activity", "/activity"],
    ["Budgets", "/budgets"],
    ["Accounts", "/accounts"],
    ["Overview", "/"],
  ] as const) {
    await navigation.getByRole("link", { name }).click();
    await expect(page).toHaveURL(
      new RegExp(`${path === "/" ? "/$" : `${path}$`}`),
    );
  }
});

test("reduced motion avoids route view transitions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {
        throw new Error("View transition must not run under reduced motion");
      },
    });
  });
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Activity" })
    .click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.locator("html")).not.toHaveClass(/route-view-transition/);
});

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    if (path === "/api/settings") {
      return route.fulfill({ json: { currency: "USD" } });
    }
    if (path === "/api/accounts") {
      return route.fulfill({ json: { accounts: [account()] } });
    }
    if (path === "/api/activities") {
      return route.fulfill({
        json: {
          activities: [activity()],
          page: { limit: 100, offset: 0, total: 1 },
        },
      });
    }
    if (path === "/api/net-worth/overview") {
      return route.fulfill({ json: netWorthOverview() });
    }
    if (path === "/api/dashboard") {
      return route.fulfill({ json: dashboard() });
    }
    if (path === "/api/budgets/status") {
      return route.fulfill({ json: { statuses: [] } });
    }
    if (path === "/api/budgets") {
      return route.fulfill({
        json: { budgets: [], page: { limit: 100, offset: 0, total: 0 } },
      });
    }
    if (path === "/api/category-rules") {
      return route.fulfill({ json: { rules: [] } });
    }
    if (path === "/api/recurring-templates") {
      return route.fulfill({ json: { templates: [] } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { message: `Unhandled mock ${path}` } },
    });
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

function activity() {
  return {
    id: 2,
    kind: "expense",
    amount: "90071992547409.91",
    category: "Food",
    description: "Groceries",
    date: "2026-06-12",
    account: {
      id: 1,
      name: "Checking",
      type: "asset",
      subtype: "cash",
      role: "account",
      before_balance: "90071992548464.01",
      after_balance: "1054.10",
      balance_effect: "-90071992547409.91",
      balance_state: "normal",
    },
    from_account: null,
    to_account: null,
    net_worth_effect: "-90071992547409.91",
    cashflow_effect: "-90071992547409.91",
    created_at: null,
    updated_at: null,
  };
}

function summary() {
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
    summary: summary(),
    history: {
      as_of: "2026-07-16",
      months: 12,
      points: [summary()],
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
      income_by_category: {},
      expenses_by_category: {},
      ytd_income: "100.00",
      ytd_expenses: "45.90",
      ytd_net_savings: "54.10",
      income_delta: "0.00",
      expenses_delta: "0.00",
      net_savings_delta: "0.00",
    },
    trend: {
      months: [],
      total_income: "100.00",
      total_expenses: "45.90",
      net_savings: "54.10",
      transaction_count: 2,
      top_expense_categories: {},
    },
    savings_rate: "54.1",
    recent_activities: [activity()],
    budget_statuses: [],
    net_worth: summary(),
    currency: "USD",
  };
}
