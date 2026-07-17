import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  { path: "/", heading: "Overview" },
  { path: "/transactions", heading: "Transactions" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/accounts", heading: "Accounts" },
  { path: "/manage/automations", heading: "Automations" },
  { path: "/manage/categories", heading: "Categories" },
  { path: "/manage/data", heading: "Data" },
  { path: "/manage/preferences", heading: "Preferences" },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
];

for (const viewport of viewports) {
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
          page.getByRole("heading", { name: route.heading, exact: true }),
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

test.describe("keyboard accessibility smoke checks", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("moves between primary views with keyboard activation", async ({
    page,
  }) => {
    await page.goto("/");

    const transactionsLink = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Transactions" });
    await transactionsLink.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/transactions$/);
    const heading = page.getByRole("heading", {
      name: "Transactions",
      exact: true,
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(heading).toHaveCSS("outline-style", "none");
  });

  test("opens and closes the transaction dialog with the keyboard", async ({
    page,
  }) => {
    await page.goto("/transactions");

    const addButton = page
      .getByRole("button", { name: "Add transaction" })
      .first();
    await addButton.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainClass("modal");
    await expect.poll(() => dialogContainsFocus(page)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(addButton).toBeFocused();
  });

  test("does not select chart disclosure text after rapid activation", async ({
    page,
  }) => {
    await page.goto("/");

    const summary = page.locator(".chart-data > summary").first();
    await summary.click({ clickCount: 3 });

    await expect(summary.locator("..")).toHaveAttribute("open", "");
    expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  });

  test("expands the attention queue and reviews a budget by keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible();

    const disclosure = page.locator(".pressure-disclosure");
    await expect(disclosure).toHaveAccessibleName("Show 4 more");
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAccessibleName("Show fewer");
    await expect(
      page.locator(".attention-panel").getByRole("listitem"),
    ).toHaveCount(7);

    const review = page.getByRole("button", {
      name: "Review Rent overage in Budgets",
    });
    await review.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/budgets\?month=6&year=2026&category=Rent$/);
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Find a category" }),
    ).toHaveValue("Rent");
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeFocused();
  });
});

test.describe("route compatibility and history", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("redirects legacy URLs to canonical destinations with relevant context", async ({
    page,
  }) => {
    await page.goto("/cash-flow?month=6&year=2026&discard=1");
    await expect(page).toHaveURL("/?month=6&year=2026");
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();

    await page.goto("/net-worth?as_of=2026-07-12&months=6&discard=1");
    await expect(page).toHaveURL("/accounts?as_of=2026-07-12&months=6");
    await expect(
      page.getByRole("heading", { name: "Accounts", exact: true }),
    ).toBeVisible();

    await page.goto("/rules?month=7&year=2026&tab=categories");
    await expect(page).toHaveURL("/manage/automations?month=7&year=2026");
    await expect(
      page.getByRole("heading", { name: "Automations", exact: true }),
    ).toBeVisible();
  });

  test("restores route query context through browser history", async ({
    page,
  }) => {
    await page.goto("/transactions?month=5&year=2026&search=Rent");
    await expect(
      page.getByRole("searchbox", { name: "Search transactions" }),
    ).toHaveValue("Rent");

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Overview" })
      .click();
    await expect(page).toHaveURL("/");

    await page.goBack();
    await expect(page).toHaveURL("/transactions?month=5&year=2026&search=Rent");
    await expect(
      page.getByRole("heading", { name: "Transactions", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("searchbox", { name: "Search transactions" }),
    ).toHaveValue("Rent");
  });
});

test.describe("accessibility display preferences", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("keeps controls and dialogs usable in forced-colors mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Review Rent overage in Budgets" }),
    ).toBeVisible();
    await expect(
      page.getByText("Over budget", { exact: true }).first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".pressure-surface")
          .evaluate((element) => getComputedStyle(element).borderStyle),
      )
      .not.toBe("none");

    await page.goto("/transactions");

    const addButton = page
      .getByRole("button", { name: "Add transaction" })
      .first();
    await expect(addButton).toBeVisible();
    await addButton.click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Amount").focus();
    await expect(dialog.getByLabel("Amount")).toBeFocused();
    await expect
      .poll(() =>
        addButton.evaluate((element) => getComputedStyle(element).borderStyle),
      )
      .not.toBe("none");
  });

  test("reflows the dashboard and forms at 200 percent text size", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show 4 more" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);

    await page.goto("/manage/automations");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    await expect(
      page.getByRole("heading", { name: "Automations", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add recurring entry" }).click();
    await expect(
      page.getByRole("textbox", { name: "Description (optional)" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      )
      .toBe(true);
  });

  test("navigates instantly when reduced motion is requested", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => {
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value: () => {
          throw new Error(
            "View transition should not start under reduced motion",
          );
        },
      });
    });

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Budgets" })
      .click();
    await expect(page).toHaveURL(/\/budgets$/);
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeFocused();
  });
});

test.describe("empty and recoverable error states", () => {
  for (const viewport of [
    { name: "compact light", width: 390, colorScheme: "light" as const },
    { name: "compact dark", width: 390, colorScheme: "dark" as const },
    { name: "desktop light", width: 1280, colorScheme: "light" as const },
    { name: "desktop dark", width: 1280, colorScheme: "dark" as const },
  ]) {
    test(`renders a flat accessible transaction empty state at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 });
      await page.emulateMedia({ colorScheme: viewport.colorScheme });
      await mockApi(page, { transactions: [] });
      await page.goto("/transactions");

      const emptyState = page.locator(".empty-state");
      await expect(emptyState).toContainText("No transactions yet");
      await expect(emptyState).toContainText(
        "Add your first entry for this period to start building your history.",
      );
      await expect(emptyState).toHaveCSS("background-image", "none");
      await expect(emptyState).toHaveCSS("border-style", "solid");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);

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

  test("keeps a forced-colors load error visible and retries by keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ forcedColors: "active" });
    await mockApi(page);
    let attempts = 0;
    await page.route("**/api/transactions**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== "/api/transactions") {
        await route.fallback();
        return;
      }
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          json: { detail: { error: "Load failed" } },
        });
        return;
      }
      await route.fulfill({ json: { transactions: [] } });
    });
    await page.goto("/transactions");

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Load failed");
    await expect(alert).toHaveCSS("border-style", "solid");
    const retry = alert.getByRole("button", { name: "Retry" });
    await retry.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("No transactions yet")).toBeVisible();
    expect(attempts).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
});

async function dialogContainsFocus(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector("dialog[open]");
    return Boolean(active && dialog?.contains(active));
  });
}

async function mockApi(
  page: Page,
  { transactions = [transaction()] }: { transactions?: unknown[] } = {},
) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    if (url.pathname === "/api/dashboard") {
      await route.fulfill({ json: dashboardPayload() });
      return;
    }
    if (url.pathname === "/api/settings") {
      await route.fulfill({ json: { currency: "USD" } });
      return;
    }
    if (url.pathname === "/api/accounts") {
      await route.fulfill({ json: { accounts: [] } });
      return;
    }
    if (url.pathname === "/api/net-worth/history") {
      await route.fulfill({
        json: {
          as_of: "2026-07-16",
          months: Number(url.searchParams.get("months") ?? 12),
          points: [],
          change_amount: null,
          change_percent: null,
          currency: "USD",
        },
      });
      return;
    }
    if (url.pathname === "/api/net-worth/overview") {
      await route.fulfill({ json: netWorthOverview() });
      return;
    }
    if (url.pathname === "/api/net-worth") {
      await route.fulfill({ json: netWorthSummary() });
      return;
    }
    if (url.pathname === "/api/transactions") {
      await route.fulfill({ json: { transactions } });
      return;
    }
    if (url.pathname === "/api/budgets/status") {
      await route.fulfill({ json: { statuses: budgetStatuses() } });
      return;
    }
    if (url.pathname === "/api/budgets") {
      await route.fulfill({ json: { budgets: [budget()] } });
      return;
    }
    if (url.pathname === "/api/category-rules") {
      await route.fulfill({
        json: {
          rules: [
            { id: 1, alias: "groceries", category: "Food", created_at: null },
          ],
        },
      });
      return;
    }
    if (url.pathname === "/api/recurring-templates") {
      await route.fulfill({
        json: {
          templates: [
            {
              id: 1,
              type: "expense",
              amount: "1200.00",
              category: "Rent",
              description: "Monthly rent",
              day_of_month: 1,
              active: true,
              created_at: null,
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({
      status: 404,
      json: { detail: { error: "Unhandled mock route" } },
    });
  });
}

function transaction() {
  return {
    id: 1,
    type: "expense",
    amount: "45.90",
    category: "Food",
    description: "Groceries",
    date: "2026-06-12",
    created_at: "2026-06-12T12:00:00",
  };
}

function budget(overrides: Partial<ReturnType<typeof budgetPayload>> = {}) {
  return {
    ...budgetPayload(),
    ...overrides,
  };
}

function budgetPayload() {
  return {
    id: 1,
    category: "Travel",
    amount: "150.00",
    month: 6,
    year: 2026,
    created_at: "2026-06-12T12:00:00",
  };
}

function budgetStatuses() {
  return [
    budgetStatus({
      budget: budget({ id: 2, category: "Food", amount: "480.00" }),
      actual_expenses: "428.75",
      remaining: "51.25",
      percent_used: "89.3",
      status: "ok",
    }),
    budgetStatus({
      budget: budget({ id: 3, category: "Dining", amount: "170.00" }),
      actual_expenses: "164.30",
      remaining: "5.70",
      percent_used: "96.6",
      status: "near limit",
    }),
    budgetStatus(),
  ];
}

function budgetStatus(
  overrides: Partial<ReturnType<typeof budgetStatusPayload>> = {},
) {
  return {
    ...budgetStatusPayload(),
    ...overrides,
  };
}

function budgetStatusPayload() {
  return {
    budget: budget(),
    actual_expenses: "185.00",
    remaining: "-35.00",
    percent_used: "123.3",
    status: "over budget",
  };
}

function dashboardPayload() {
  return {
    month: 6,
    year: 2026,
    period_label: "June 2026",
    report: {
      month: 6,
      year: 2026,
      total_income: "2500.00",
      total_expenses: "386.40",
      net_savings: "2113.60",
      transaction_count: 2,
      income_by_category: { Salary: "2500.00" },
      expenses_by_category: { Food: "386.40", Travel: "185.00" },
      ytd_income: "15000.00",
      ytd_expenses: "3000.00",
      ytd_net_savings: "12000.00",
      income_delta: "100.00",
      expenses_delta: "-25.00",
      net_savings_delta: "125.00",
    },
    trend: {
      months: [
        trendMonth("2026-01", "2120.80"),
        trendMonth("2026-02", "2135.45"),
        trendMonth("2026-03", "2536.30"),
        trendMonth("2026-04", "1840.25"),
        trendMonth("2026-05", "2210.15"),
        trendMonth("2026-06", "0.00", {
          total_income: "0.00",
          total_expenses: "0.00",
          transaction_count: 0,
        }),
      ],
      total_income: "12500.00",
      total_expenses: "2500.00",
      net_savings: "10842.95",
      transaction_count: 25,
      top_expense_categories: { Food: "386.40", Travel: "185.00" },
    },
    savings_rate: "84.5",
    recent_transactions: [transaction()],
    budget_statuses: attentionQueueStatuses(),
    net_worth: netWorthSummary(),
  };
}

function netWorthSummary() {
  return {
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
}

function netWorthOverview() {
  const summary = netWorthSummary();
  return {
    summary,
    history: {
      as_of: summary.as_of,
      months: 12,
      points: [],
      change_amount: null,
      change_percent: null,
      currency: "USD",
    },
    comparison: {
      start_date: summary.as_of,
      end_date: summary.as_of,
      available: false,
      start_value: null,
      end_value: null,
      change_amount: null,
      change_percent: null,
    },
    accounts: [],
    coverage: {
      resolved_account_count: 0,
      unresolved_account_count: 0,
      oldest_balance_date: null,
    },
    currency: "USD",
  };
}

function attentionQueueStatuses() {
  return [
    budgetStatus({
      budget: budget({ id: 1, category: "Rent", amount: "1600.00" }),
      actual_expenses: "3100.00",
      remaining: "-1500.00",
      percent_used: "193.8",
    }),
    budgetStatus({
      budget: budget({ id: 2, category: "Travel", amount: "550.00" }),
      actual_expenses: "640.00",
      remaining: "-90.00",
      percent_used: "116.4",
    }),
    budgetStatus({
      budget: budget({ id: 3, category: "Household", amount: "180.00" }),
      actual_expenses: "186.40",
      remaining: "-6.40",
      percent_used: "103.6",
    }),
    budgetStatus({
      budget: budget({ id: 4, category: "Dining", amount: "170.00" }),
      actual_expenses: "164.30",
      remaining: "5.70",
      percent_used: "96.6",
      status: "near limit",
    }),
    budgetStatus({
      budget: budget({ id: 5, category: "Health", amount: "100.00" }),
      actual_expenses: "92.00",
      remaining: "8.00",
      percent_used: "92.0",
      status: "near limit",
    }),
    budgetStatus({
      budget: budget({ id: 6, category: "Utilities", amount: "225.00" }),
      actual_expenses: "205.20",
      remaining: "19.80",
      percent_used: "91.2",
      status: "near limit",
    }),
    budgetStatus({
      budget: budget({ id: 7, category: "Subscriptions", amount: "50.00" }),
      actual_expenses: "44.99",
      remaining: "5.01",
      percent_used: "90.0",
      status: "near limit",
    }),
  ];
}

function trendMonth(
  label: string,
  netSavings: string,
  overrides: Partial<ReturnType<typeof baseTrendMonth>> = {},
) {
  return {
    ...baseTrendMonth(label, netSavings),
    ...overrides,
  };
}

function baseTrendMonth(label: string, netSavings: string) {
  const [year, month] = label.split("-").map(Number);
  return {
    month,
    year,
    label,
    total_income: "2500.00",
    total_expenses: "500.00",
    net_savings: netSavings,
    transaction_count: 5,
    savings_rate: "80.0",
    income_delta: "0.00",
    expenses_delta: "0.00",
    net_savings_delta: "0.00",
  };
}
