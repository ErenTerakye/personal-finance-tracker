import { expect, test, type Page } from "@playwright/test";

const viewports = [320, 390, 430, 768, 1024, 1280, 1440];

for (const width of viewports) {
  test.describe(`responsive layout at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
    });

    test("keeps the dashboard readable without horizontal overflow", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();
      await expect(page.getByText("Six-month cashflow strip")).toBeVisible();
      await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      const firstTapeCard = page.locator(".statement-tape li").first();
      await expect(firstTapeCard).toBeVisible();
      const cardBox = await firstTapeCard.boundingBox();
      expect(cardBox?.width).toBeLessThanOrEqual(width);
      expect(cardBox?.height).toBeLessThan(width <= 430 ? 110 : 230);
    });

    test("adapts transaction records and dialogs", async ({ page }) => {
      await page.goto("/transactions");

      await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
      await expect(page.getByText("Groceries")).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await expectTableModeMatchesContainer(page);

      await page.getByRole("button", { name: "Add entry" }).click();
      const dialog = page.getByRole("dialog", { name: "Add transaction" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
    });

    test("adapts budget records and dialogs", async ({ page }) => {
      await page.goto("/budgets");

      await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();
      await expect(page.locator(".records-panel .data-table td[data-label='Category']")).toHaveText("Travel");
      await assertNoHorizontalOverflow(page);
      await expectTableModeMatchesContainer(page);

      await page.getByRole("button", { name: "Set budget" }).click();
      const dialog = page.getByRole("dialog", { name: "Set budget" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
    });
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectTableModeMatchesContainer(page: Page) {
  const { headerDisplay, wrapWidth, rootFontSize } = await page.locator(".table-wrap").first().evaluate((node) => {
    const tableHeader = node.querySelector(".data-table thead");
    if (!tableHeader) {
      throw new Error("Expected data table header inside table wrapper");
    }
    return {
      headerDisplay: getComputedStyle(tableHeader).display,
      wrapWidth: node.getBoundingClientRect().width,
      rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    };
  });

  if (wrapWidth < rootFontSize * 48) {
    expect(headerDisplay).toBe("none");
    return;
  }
  expect(headerDisplay).not.toBe("none");
}

async function expectDialogFitsViewport(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  const [box, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight
    }))
  ]);

  expect(box?.width).toBeLessThanOrEqual(viewport.width);
  expect(box?.height).toBeLessThanOrEqual(viewport.height);
}

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/dashboard") {
      await route.fulfill({ json: dashboardPayload() });
      return;
    }
    if (url.pathname === "/api/transactions") {
      await route.fulfill({ json: { transactions: [transaction()] } });
      return;
    }
    if (url.pathname === "/api/budgets/status") {
      await route.fulfill({ json: { statuses: [budgetStatus()] } });
      return;
    }
    if (url.pathname === "/api/budgets") {
      await route.fulfill({ json: { budgets: [budget()] } });
      return;
    }
    await route.fulfill({ status: 404, json: { detail: { error: "Unhandled mock route" } } });
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
    created_at: "2026-06-12T12:00:00"
  };
}

function budget() {
  return {
    id: 1,
    category: "Travel",
    amount: "150.00",
    month: 6,
    year: 2026,
    created_at: "2026-06-12T12:00:00"
  };
}

function budgetStatus() {
  return {
    budget: budget(),
    actual_expenses: "185.00",
    remaining: "-35.00",
    percent_used: "123.3",
    status: "over budget"
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
      expenses_by_category: { Food: "386.40", Travel: "185.00" }
    },
    trend: {
      months: [
        trendMonth("2026-01", "2120.80"),
        trendMonth("2026-02", "2135.45"),
        trendMonth("2026-03", "2536.30"),
        trendMonth("2026-04", "1840.25"),
        trendMonth("2026-05", "2210.15"),
        trendMonth("2026-06", "2113.60")
      ],
      total_income: "15000.00",
      total_expenses: "3000.00",
      net_savings: "12000.00",
      transaction_count: 12,
      top_expense_categories: { Food: "386.40", Travel: "185.00" }
    },
    savings_rate: "84.5",
    recent_transactions: [transaction()],
    budget_statuses: [budgetStatus()]
  };
}

function trendMonth(label: string, netSavings: string) {
  const [year, month] = label.split("-").map(Number);
  return {
    month,
    year,
    label,
    total_income: "2500.00",
    total_expenses: "500.00",
    net_savings: netSavings,
    transaction_count: 5,
    savings_rate: "80.0"
  };
}
