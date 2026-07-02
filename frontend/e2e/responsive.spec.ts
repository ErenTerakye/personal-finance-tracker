import { expect, test, type Page } from "@playwright/test";

const colorSchemeStorageKey = "finance-tracker-color-scheme";
const viewports = [320, 390, 430, 768, 1024, 1280, 1440, 1800, 1920];
const themeViewports = [390, 1280];

for (const width of viewports) {
  test.describe(`responsive layout at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
    });

    test("keeps the dashboard readable without horizontal overflow", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByText("Six-month cashflow trend")).toBeVisible();
      await expect(page.getByRole("button", { name: /Choose period/ })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertCannotPanHorizontally(page);
      await expectDashboardFitsViewport(page);
      await expectQuickActionsStacked(page);
      await expectThemeToggleIconCentered(page);
      await expectMobileNavigationIsCompact(page, width);
      await page.getByRole("button", { name: /Choose period/ }).click();
      await expectElementsFitViewport(page, [".period-popover"]);

      const firstTapeCard = page.locator(".cashflow-trend li").first();
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
      await expect(page.getByRole("button", { name: "Edit Food transaction" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete Food transaction" })).toBeVisible();

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
      await expect(page.getByRole("button", { name: "Update Travel budget" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete Travel budget" })).toBeVisible();

      await page.getByRole("button", { name: "Set budget" }).click();
      const dialog = page.getByRole("dialog", { name: "Set budget" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
    });
  });
}

test.describe("cashflow trend graph rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("scales desktop bars and leaves empty months blank", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Six-month cashflow trend")).toBeVisible();
    const activeBars = await measureTrendBars(page.locator(".cashflow-trend li").first());
    const emptyBars = await measureTrendBars(page.locator(".cashflow-trend li").last());

    expect(activeBars.cash).toBeGreaterThan(activeBars.expenses);
    expect(activeBars.net).toBeGreaterThan(activeBars.expenses);
    expect(emptyBars.cash).toBeLessThanOrEqual(1);
    expect(emptyBars.expenses).toBeLessThanOrEqual(1);
    expect(emptyBars.net).toBeLessThanOrEqual(1);
  });

  test("shows exact values on desktop hover", async ({ page }) => {
    await page.goto("/");

    await page.locator(".cashflow-trend .trend-bar.expenses").first().hover();
    const tooltip = page.locator(".chart-tooltip");

    await expect(tooltip).toContainText("Expenses");
    await expect(tooltip).toContainText("$500.00");
    await expectElementsFitViewport(page, [".chart-tooltip"]);
  });
});

test.describe("interactive trend chart", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("shows exact values on keyboard focus", async ({ page }) => {
    await page.goto("/");

    await page.locator(".line-chart .chart-point.cash").first().focus();
    const tooltip = page.locator(".line-chart .chart-tooltip");

    await expect(tooltip).toContainText("Income");
    await expect(tooltip).toContainText("$2,500.00");
    await expect(tooltip).toContainText("80.0% savings rate");
    await expectElementsFitViewport(page, [".chart-tooltip"]);
  });
});

test.describe("mobile chart interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page);
  });

  test("pins a tapped bar tooltip inside the viewport and dismisses on outside tap", async ({ page }) => {
    await page.goto("/");

    await page.locator(".cashflow-trend .trend-bar.expenses").last().dispatchEvent("pointerdown", {
      pointerType: "touch"
    });
    const tooltip = page.locator(".cashflow-trend .chart-tooltip");

    await expect(tooltip).toContainText("$0.00");
    await expectElementsFitViewport(page, [".chart-tooltip"]);

    await page.getByRole("heading", { name: "Dashboard" }).click();
    await expect(tooltip).toBeHidden();
  });

  test("pins a tapped trend point and dismisses on scroll", async ({ page }) => {
    await page.goto("/");

    await page.locator(".line-chart .chart-point.expenses").first().dispatchEvent("pointerdown", {
      pointerType: "touch"
    });
    const tooltip = page.locator(".line-chart .chart-tooltip");

    await expect(tooltip).toContainText("Expenses");
    await expectElementsFitViewport(page, [".chart-tooltip"]);

    await page.mouse.wheel(0, 320);
    await expect(tooltip).toBeHidden();
  });
});

for (const width of themeViewports) {
  test.describe(`theme preference at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: "light" });
      await mockApi(page);
    });

    test("pins, persists, and clears a manual theme", async ({ page }) => {
      await page.goto("/");

      await expect(page.getByRole("button", { name: "Use dark mode" })).toBeVisible();
      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark"
      });

      await page.getByRole("button", { name: "Use dark mode" }).click();

      await expect(page.getByRole("button", { name: "Use system color setting" })).toBeVisible();
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark"
      });
      await assertNoHorizontalOverflow(page);

      await page.reload();

      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Use system color setting" })).toBeVisible();
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark"
      });

      await page.getByRole("button", { name: "Use system color setting" }).click();

      await expect(page.getByRole("button", { name: "Use dark mode" })).toBeVisible();
      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark"
      });
      await assertNoHorizontalOverflow(page);
    });
  });
}

test.describe("theme system preference", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await mockApi(page);
  });

  test("updates the system-mode action when OS color scheme changes", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Use dark mode" })).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });

    await expect(page.getByRole("button", { name: "Use light mode" })).toBeVisible();
    await expectThemeState(page, {
      dataTheme: null,
      meta: "light dark",
      stored: null,
      colorScheme: "light dark"
    });

    await page.getByRole("button", { name: "Use light mode" }).click();
    await page.emulateMedia({ colorScheme: "light" });

    await expect(page.getByRole("button", { name: "Use system color setting" })).toBeVisible();
    await expectThemeState(page, {
      dataTheme: "light",
      meta: "light",
      stored: "light",
      colorScheme: "light"
    });
  });
});

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function assertCannotPanHorizontally(page: Page) {
  const scrollX = await page.evaluate(() => {
    window.scrollTo({ left: 500, top: 0 });
    return window.scrollX;
  });
  expect(scrollX).toBe(0);
}

async function expectDashboardFitsViewport(page: Page) {
  await expectElementsFitViewport(page, [
    ".app-header",
    ".workspace",
    ".page-heading",
    ".page-actions",
    ".period-control",
    ".period-control > button",
    ".dashboard-summary",
    ".dashboard-lead",
    ".cashflow-trend ol",
    ".theme-toggle"
  ]);
}

async function expectQuickActionsStacked(page: Page) {
  const addEntry = page.getByRole("button", { name: "Add entry" });
  const setBudget = page.getByRole("button", { name: "Set budget" });
  const [addBox, budgetBox] = await Promise.all([addEntry.boundingBox(), setBudget.boundingBox()]);

  expect(addBox).not.toBeNull();
  expect(budgetBox).not.toBeNull();
  expect(budgetBox!.y).toBeGreaterThan(addBox!.y + addBox!.height);
  expect(Math.abs(budgetBox!.x - addBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(budgetBox!.width - addBox!.width)).toBeLessThanOrEqual(1);
}

async function expectElementsFitViewport(page: Page, selectors: string[]) {
  const overflowed = await page.evaluate((selectorList) => {
    const viewportWidth = document.documentElement.clientWidth;

    return selectorList.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector), (node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          return null;
        }
        return {
          selector,
          index,
          left: rect.left,
          right: rect.right,
          viewportWidth
        };
      }).filter((entry) => entry && (entry.left < -1 || entry.right > viewportWidth + 1))
    );
  }, selectors);

  expect(overflowed).toEqual([]);
}

async function expectThemeToggleIconCentered(page: Page) {
  const offset = await page.locator(".theme-toggle").evaluate((button) => {
    const icon = button.querySelector("svg");
    if (!icon) {
      throw new Error("Expected theme toggle icon");
    }

    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      x: Math.abs(buttonRect.left + buttonRect.width / 2 - (iconRect.left + iconRect.width / 2)),
      y: Math.abs(buttonRect.top + buttonRect.height / 2 - (iconRect.top + iconRect.height / 2))
    };
  });

  expect(offset.x).toBeLessThanOrEqual(1);
  expect(offset.y).toBeLessThanOrEqual(1);
}

async function expectThemeState(
  page: Page,
  expected: {
    dataTheme: string | null;
    meta: string | null;
    stored: string | null;
    colorScheme: string;
  }
) {
  const state = await page.evaluate((key) => {
    const root = document.documentElement;
    return {
      colorScheme: getComputedStyle(root).getPropertyValue("color-scheme"),
      dataTheme: root.getAttribute("data-theme"),
      meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? null,
      stored: localStorage.getItem(key)
    };
  }, colorSchemeStorageKey);

  expect(state.dataTheme).toBe(expected.dataTheme);
  expect(state.meta).toBe(expected.meta);
  expect(state.stored).toBe(expected.stored);
  expect(state.colorScheme).toBe(expected.colorScheme);
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

async function expectMobileNavigationIsCompact(page: Page, width: number) {
  if (width > 760) {
    return;
  }
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Transactions" })).toBeVisible();
  const position = await nav.evaluate((node) => getComputedStyle(node).position);
  expect(position).toBe("fixed");
}

async function measureTrendBars(card: ReturnType<Page["locator"]>) {
  return card.evaluate((node) => {
    const barHeight = (selector: string) =>
      node.querySelector(selector)?.getBoundingClientRect().height ?? 0;
    return {
      cash: barHeight(".trend-bars .cash"),
      expenses: barHeight(".trend-bars .expenses"),
      net: barHeight(".trend-bars .net")
    };
  });
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
        trendMonth("2026-06", "0.00", {
          total_income: "0.00",
          total_expenses: "0.00",
          transaction_count: 0
        })
      ],
      total_income: "12500.00",
      total_expenses: "2500.00",
      net_savings: "10842.95",
      transaction_count: 25,
      top_expense_categories: { Food: "386.40", Travel: "185.00" }
    },
    savings_rate: "84.5",
    recent_transactions: [transaction()],
    budget_statuses: [budgetStatus()]
  };
}

function trendMonth(
  label: string,
  netSavings: string,
  overrides: Partial<ReturnType<typeof baseTrendMonth>> = {}
) {
  return {
    ...baseTrendMonth(label, netSavings),
    ...overrides
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
    savings_rate: "80.0"
  };
}
