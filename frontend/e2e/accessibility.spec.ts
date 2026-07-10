import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  { path: "/", heading: "Dashboard" },
  { path: "/transactions", heading: "Transactions" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/rules", heading: "Rules" },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
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
          page.getByRole("heading", { name: route.heading }),
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
    await expect(
      page.getByRole("heading", { name: "Transactions" }),
    ).toBeVisible();
    await expect(page.locator("main")).toBeFocused();
  });

  test("opens and closes the transaction dialog with the keyboard", async ({
    page,
  }) => {
    await page.goto("/transactions");

    const addButton = page.getByRole("button", { name: "Add entry" }).first();
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
    await page.goto("/transactions");

    const addButton = page.getByRole("button", { name: "Add entry" }).first();
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

  test("reflows at 200 percent text size without horizontal page overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/rules");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Alias" })).toBeVisible();
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
    await expect(page.locator("main")).toBeFocused();
  });
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
      await route.fulfill({ json: dashboardPayload() });
      return;
    }
    if (url.pathname === "/api/settings") {
      await route.fulfill({ json: { currency: "USD" } });
      return;
    }
    if (url.pathname === "/api/transactions") {
      await route.fulfill({ json: { transactions: [transaction()] } });
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
    budget_statuses: [budgetStatus()],
  };
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
