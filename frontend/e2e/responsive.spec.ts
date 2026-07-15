import { expect, test, type Page } from "@playwright/test";

const colorSchemeStorageKey = "finance-tracker-color-scheme";
const viewports = [320, 390, 430, 768, 1024, 1280, 1440, 1800, 1920];
const themeViewports = [390, 1280];

test("compact bottom navigation localizes from inline header utilities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");

  const navigation = page.locator(".bottom-navigation");
  await expect(navigation.getByRole("link")).toHaveCount(4);
  await expect(
    navigation.getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("aria-current", "page");

  const compactBar = page.locator(".compact-app-bar");
  await expect(page.locator("#app-drawer")).toHaveCount(0);
  await expect(
    compactBar.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveCount(0);
  await compactBar.locator(".lang-toggle").click();

  await expect(
    navigation.getByRole("link", { name: "Genel Bakış" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Hareketler" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Otomasyonlar" }),
  ).toBeVisible();
});

test("keeps compact navigation live through rapid tab switches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();

  const navigation = page.locator(".compact-primary-navigation");
  for (const path of ["/transactions", "/budgets", "/rules", "/"]) {
    const state = await navigation.evaluate((element, nextPath) => {
      const link = element.querySelector<HTMLAnchorElement>(
        `a[href="${nextPath}"]`,
      );
      if (!link) throw new Error(`Missing compact navigation link ${nextPath}`);

      link.click();
      const current = element.querySelector<HTMLAnchorElement>(
        'a[aria-current="page"]',
      );
      return {
        backdropFilter: getComputedStyle(element).backdropFilter,
        currentPath: current?.getAttribute("href"),
        periodSnapshotActive: document.documentElement.classList.contains(
          "period-view-transition",
        ),
        pathname: window.location.pathname,
      };
    }, path);

    expect(state).toEqual({
      backdropFilter: "blur(16px)",
      currentPath: path,
      periodSnapshotActive: false,
      pathname: path,
    });
  }
});

test("keeps category ranking hover active through row separators", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");

  const ranking = page.locator(".expense-mix-legend");
  await ranking.scrollIntoViewIfNeeded();
  const firstCategory = ranking.locator(".expense-mix-legend-btn").nth(0);
  const secondCategory = ranking.locator(".expense-mix-legend-btn").nth(1);
  const [firstBox, secondBox] = await Promise.all([
    firstCategory.boundingBox(),
    secondCategory.boundingBox(),
  ]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);

  const x = firstBox!.x + firstBox!.width / 2;
  const gapMiddle = (firstBox!.y + firstBox!.height + secondBox!.y) / 2;
  await page.mouse.move(x, gapMiddle);
  await expect(firstCategory).toHaveAttribute("data-active", "true");

  await page.mouse.move(x, secondBox!.y - 0.5);
  await expect(secondCategory).toHaveAttribute("data-active", "true");
});

test("keeps the export menu content-sized and anchored", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "June 2026" })).toBeVisible();

  const trigger = page.getByRole("button", {
    name: "Download dashboard artifacts",
  });
  await trigger.click();

  await expect(page.getByRole("link", { name: "Trend chart" })).toBeVisible();
  await expectExportMenuFitsContent(page);
  await expect
    .poll(() =>
      page
        .locator(".artifact-link")
        .first()
        .evaluate((link) => {
          const style = getComputedStyle(link);
          return `${style.transitionProperty} ${style.transitionDuration}`;
        }),
    )
    .toBe("all 0s");

  const [triggerBox, menuBox] = await Promise.all([
    trigger.boundingBox(),
    page.locator(".artifact-popover").boundingBox(),
  ]);
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(
    Math.abs(triggerBox!.x + triggerBox!.width - (menuBox!.x + menuBox!.width)),
  ).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(page.locator(".artifact-popover")).toBeHidden();
});

for (const width of viewports) {
  test.describe(`responsive layout at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
    });

    test("keeps the dashboard readable without horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/");

      await expect(
        page.getByRole("heading", { name: "June 2026" }),
      ).toBeVisible();
      await expect(page.getByText("Six-month cashflow trend")).toBeVisible();
      const attentionPanel = page.locator(".attention-panel");
      await expect(attentionPanel.getByRole("listitem")).toHaveCount(3);
      await expect(
        attentionPanel.getByRole("button", { name: "Show 4 more" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Choose period/ }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Download dashboard artifacts" })
        .click();
      await expect(
        page.getByRole("link", { name: "Month report" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Trend chart" }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await assertCannotPanHorizontally(page);
      await expectDashboardFitsViewport(page);
      await expectElementsFitViewport(page, [
        ".dashboard-actions",
        ".artifact-actions .button",
        ".attention-panel",
        ".pressure-row",
        ".pressure-review",
      ]);
      await expectThemeToggleIconCentered(page);
      await expectMobileNavigationIsCompact(page, width);
      await expectAdaptiveCompactCommandBar(page, width);
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

      await expect(
        page.getByRole("heading", { name: "Transactions" }),
      ).toBeVisible();
      await expect(page.getByText("Groceries")).toBeVisible();
      await page.getByText("Data options", { exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Import CSV" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Export CSV" }),
      ).toBeVisible();
      await page.getByText("Data options", { exact: true }).click();
      await assertNoHorizontalOverflow(page);
      await expectElementsFitViewport(page, [
        ".action-cluster",
        ".panel-actions",
      ]);
      await expectTableModeMatchesContainer(page);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

      await page.getByRole("button", { name: "Add entry" }).click();
      const dialog = page.getByRole("dialog", { name: "Add transaction" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
    });

    test("adapts budget records and dialogs", async ({ page }) => {
      await page.goto("/budgets");

      await expect(
        page.getByRole("heading", { name: "Budgets" }),
      ).toBeVisible();
      await expect(
        page.getByText("Travel", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Import CSV" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Export CSV" }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await expectBudgetPressureBarsAligned(page);
      await expectElementsFitViewport(page, [
        ".action-cluster",
        ".panel-actions",
      ]);
      await page.getByRole("button", { name: /Travel, .* used/ }).click();
      await expect(
        page.getByRole("button", { name: "Edit Travel budget" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Delete budget" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Set budget" }).click();
      const dialog = page.getByRole("dialog", { name: "Set budget" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
    });

    test("adapts rules and recurring template controls", async ({ page }) => {
      await page.goto("/rules");

      await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
      await expect(
        page.locator(".rule-list strong", { hasText: "groceries" }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "Recurring" }).click();
      await expect(page.locator("#rules-panel-categories")).toBeHidden();
      await expect(page.locator("#rules-panel-recurring")).toBeVisible();
      await expect(page.getByText("Rent $1,200.00")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Apply for/ }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await expectElementsFitViewport(page, [
        ".rules-layout",
        ".template-form",
        ".rule-list li",
      ]);
    });
  });
}

test.describe("cashflow trend graph rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("scales desktop bars and leaves empty months blank", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("Six-month cashflow trend")).toBeVisible();
    const activeBars = await measureTrendBars(
      page.locator(".cashflow-trend li").first(),
    );
    const emptyBars = await measureTrendBars(
      page.locator(".cashflow-trend li").last(),
    );

    expect(activeBars.cash).toBeGreaterThan(activeBars.expenses);
    expect(activeBars.net).toBeGreaterThan(activeBars.expenses);
    expect(emptyBars.cash).toBeLessThanOrEqual(1);
    expect(emptyBars.expenses).toBeLessThanOrEqual(1);
    expect(emptyBars.net).toBeLessThanOrEqual(1);
  });

  test("shows exact values on desktop hover", async ({ page }) => {
    await page.goto("/");

    const hoveredBarSlot = page
      .locator(".cashflow-trend .trend-bar.expenses")
      .nth(3);
    const hoveredBar = hoveredBarSlot.locator("span");
    const tooltip = page.locator(".chart-tooltip");

    await expect(hoveredBarSlot).toHaveCSS("cursor", "default");

    const slotBox = await hoveredBarSlot.boundingBox();
    const barBox = await hoveredBar.boundingBox();
    expect(slotBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect(barBox!.height).toBeLessThan(slotBox!.height);

    await page.mouse.move(barBox!.x - 2, barBox!.y + barBox!.height / 2);
    await expect(tooltip).toBeVisible();

    await hoveredBar.hover();

    await expect(tooltip).toContainText("Expenses");
    await expect(tooltip).toContainText("$500.00");
    await expectElementsFitViewport(page, [".chart-tooltip"]);
    await expectTooltipPointerAligned(hoveredBar, tooltip);
  });
});

test.describe("keyboard chart interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApi(page);
  });

  test("shows exact values on keyboard focus", async ({ page }) => {
    await page.goto("/");

    await page.locator(".cashflow-trend .trend-bar.cash").first().focus();
    const tooltip = page.locator(".cashflow-trend .chart-tooltip");

    await expect(tooltip).toContainText("Income");
    await expect(tooltip).toContainText("$2,500.00");
    await expectElementsFitViewport(page, [".chart-tooltip"]);
  });
});

test.describe("mobile chart interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page);
  });

  test("pins a tapped bar tooltip inside the viewport and dismisses on outside tap", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .locator(".cashflow-trend .trend-bar.expenses")
      .last()
      .evaluate((element) =>
        element.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        ),
      );
    const tooltip = page.locator(".cashflow-trend .chart-tooltip");

    await expect(tooltip).toContainText("$0.00");
    await expectElementsFitViewport(page, [".chart-tooltip"]);

    await page.getByRole("heading", { name: "June 2026" }).click();
    await expect(tooltip).toBeHidden();
  });

  test("pins a tapped income bar and dismisses on scroll", async ({ page }) => {
    await page.goto("/");

    await page
      .locator(".cashflow-trend .trend-bar.cash")
      .last()
      .evaluate((element) =>
        element.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
          }),
        ),
      );
    const tooltip = page.locator(".cashflow-trend .chart-tooltip");

    await expect(tooltip).toContainText("Income");
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

      await expect(
        page.getByRole("button", { name: "Use dark mode" }),
      ).toBeVisible();
      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark",
      });

      await page.getByRole("button", { name: "Use dark mode" }).click();

      await expect(
        page.getByRole("button", { name: "Use system color setting" }),
      ).toBeVisible();
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark",
      });
      await assertNoHorizontalOverflow(page);

      await page.reload();

      await expect(
        page.getByRole("heading", { name: "June 2026" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Use system color setting" }),
      ).toBeVisible();
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark",
      });

      await page
        .getByRole("button", { name: "Use system color setting" })
        .click();

      await expect(
        page.getByRole("button", { name: "Use dark mode" }),
      ).toBeVisible();
      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark",
      });
      await assertNoHorizontalOverflow(page);
    });

    test("switches repeatedly without a transition or layout shift", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "June 2026" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const initialLayout = await captureThemeLayout(page);
      const transitionObserved = page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            let observed = false;
            const timeout = window.setTimeout(() => {
              observer.disconnect();
              resolve(observed);
            }, 100);
            const observer = new MutationObserver(() => {
              if (document.documentElement.matches(":active-view-transition")) {
                observed = true;
                window.clearTimeout(timeout);
                observer.disconnect();
                resolve(observed);
              }
            });
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ["style", "class", "data-theme"],
            });
          }),
      );

      await page.getByRole("button", { name: "Use dark mode" }).click();
      await page
        .getByRole("button", { name: "Use system color setting" })
        .click();

      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark",
      });
      expect(await captureThemeLayout(page)).toEqual(initialLayout);
      expect(await transitionObserved).toBe(false);
    });
  });
}

test.describe("theme system preference", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await mockApi(page);
  });

  test("updates the system-mode action when OS color scheme changes", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Use dark mode" }),
    ).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });

    await expect(
      page.getByRole("button", { name: "Use light mode" }),
    ).toBeVisible();
    await expectThemeState(page, {
      dataTheme: null,
      meta: "light dark",
      stored: null,
      colorScheme: "light dark",
    });

    await page.getByRole("button", { name: "Use light mode" }).click();
    await page.emulateMedia({ colorScheme: "light" });

    await expect(
      page.getByRole("button", { name: "Use system color setting" }),
    ).toBeVisible();
    await expectThemeState(page, {
      dataTheme: "light",
      meta: "light",
      stored: "light",
      colorScheme: "light",
    });
  });

  test("updates the desktop navigation rail colors with the theme", async ({
    page,
  }) => {
    await page.goto("/");
    const rail = page.locator(".app-rail");
    await expect(rail).toBeVisible();

    const lightColors = await rail.evaluate(readElementColors);
    await page.getByRole("button", { name: "Use dark mode" }).click();
    const darkColors = await rail.evaluate(readElementColors);

    expect(darkColors.backgroundColor).not.toBe(lightColors.backgroundColor);
    expect(darkColors.color).not.toBe(lightColors.color);
    expect(darkColors.borderInlineEndColor).not.toBe(
      lightColors.borderInlineEndColor,
    );
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

async function expectExportMenuFitsContent(page: Page) {
  const menu = page.locator(".artifact-popover");
  const links = menu.locator(".artifact-link");
  const [menuBox, linkBoxes, viewportHeight] = await Promise.all([
    menu.boundingBox(),
    links.evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      }),
    ),
    page.evaluate(() => document.documentElement.clientHeight),
  ]);

  expect(menuBox).not.toBeNull();
  expect(linkBoxes).toHaveLength(4);
  expect(menuBox!.height).toBeLessThanOrEqual(320);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewportHeight);

  for (let index = 1; index < linkBoxes.length; index += 1) {
    expect(linkBoxes[index].top - linkBoxes[index - 1].bottom).toBeLessThan(8);
  }
}

async function expectDashboardFitsViewport(page: Page) {
  await expectElementsFitViewport(page, [
    ".app-header",
    ".workspace",
    ".page-heading",
    ".page-actions",
    ".dashboard-heading-tools",
    ".period-control",
    ".period-control > button",
    ".dashboard-summary",
    ".dashboard-lead",
    ".cashflow-trend ol",
    ".theme-toggle",
  ]);
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
          viewportWidth,
        };
      }).filter(
        (entry) =>
          entry && (entry.left < -1 || entry.right > viewportWidth + 1),
      ),
    );
  }, selectors);

  expect(overflowed).toEqual([]);
}

async function expectBudgetPressureBarsAligned(page: Page) {
  const bars = await page
    .locator(".budget-category-row progress")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      }),
    );

  expect(bars.length).toBeGreaterThanOrEqual(3);
  const [first] = bars;
  for (const bar of bars.slice(1)) {
    expect(Math.abs(bar.left - first.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(bar.right - first.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(bar.width - first.width)).toBeLessThanOrEqual(1);
  }
}

async function captureThemeLayout(page: Page) {
  return page
    .locator(
      "main:visible, .theme-toggle:visible, .app-rail:visible, .compact-app-bar:visible, .compact-primary-navigation:visible",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
}

async function expectThemeToggleIconCentered(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 1023) return;
  const offset = await page
    .locator(".theme-toggle:visible")
    .first()
    .evaluate((button) => {
      const icon = button.querySelector("svg");
      if (!icon) {
        throw new Error("Expected theme toggle icon");
      }

      const buttonRect = button.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        x: Math.abs(
          buttonRect.left +
            buttonRect.width / 2 -
            (iconRect.left + iconRect.width / 2),
        ),
        y: Math.abs(
          buttonRect.top +
            buttonRect.height / 2 -
            (iconRect.top + iconRect.height / 2),
        ),
      };
    });

  expect(offset.x).toBeLessThanOrEqual(1);
  expect(offset.y).toBeLessThanOrEqual(1);
}

async function expectAdaptiveCompactCommandBar(page: Page, width: number) {
  const compactBar = page.locator(".compact-app-bar");
  const rail = page.locator(".app-rail");

  if (width >= 1024) {
    await expect(compactBar).toBeHidden();
    await expect(rail).toBeVisible();
    return;
  }

  await expect(compactBar).toBeVisible();
  await expect(rail).toBeHidden();
  const brand = compactBar.getByRole("link", { name: "Finance Tracker" });
  const language = compactBar.getByRole("button", {
    name: "Switch language",
  });
  const theme = compactBar.locator(".theme-toggle");
  const create = compactBar.getByRole("button", { name: "Add entry" });
  const label = compactBar.locator(".compact-create-label");
  const brandName = brand.locator("strong");

  await expect(page.locator("#app-drawer")).toHaveCount(0);
  await expect(
    compactBar.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveCount(0);

  for (const control of [brand, language, theme, create]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(47.9);
    expect(box!.height).toBeGreaterThanOrEqual(47.9);
  }

  if (width < 576) {
    await expect(label).toBeHidden();
    await expect(brandName).toBeHidden();
  } else {
    await expect(label).toBeVisible();
    await expect(brandName).toBeVisible();
  }

  await expectElementsFitViewport(page, [
    ".compact-app-bar .brand",
    ".compact-utilities",
    ".compact-create",
  ]);
}

async function expectThemeState(
  page: Page,
  expected: {
    dataTheme: string | null;
    meta: string | null;
    stored: string | null;
    colorScheme: string;
  },
) {
  const state = await page.evaluate((key) => {
    const root = document.documentElement;
    return {
      colorScheme: getComputedStyle(root).getPropertyValue("color-scheme"),
      dataTheme: root.getAttribute("data-theme"),
      meta:
        document
          .querySelector('meta[name="color-scheme"]')
          ?.getAttribute("content") ?? null,
      stored: localStorage.getItem(key),
    };
  }, colorSchemeStorageKey);

  expect(state.dataTheme).toBe(expected.dataTheme);
  expect(state.meta).toBe(expected.meta);
  expect(state.stored).toBe(expected.stored);
  expect(state.colorScheme).toBe(expected.colorScheme);
}

function readElementColors(element: HTMLElement) {
  const styles = getComputedStyle(element);
  return {
    backgroundColor: styles.backgroundColor,
    borderInlineEndColor: styles.borderInlineEndColor,
    color: styles.color,
  };
}

async function expectTableModeMatchesContainer(page: Page) {
  const { headerDisplay, wrapWidth, rootFontSize } = await page
    .locator(".table-wrap")
    .first()
    .evaluate((node) => {
      const tableHeader = node.querySelector(".data-table thead");
      if (!tableHeader) {
        throw new Error("Expected data table header inside table wrapper");
      }
      return {
        headerDisplay: getComputedStyle(tableHeader).display,
        wrapWidth: node.getBoundingClientRect().width,
        rootFontSize: Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        ),
      };
    });

  if (wrapWidth < rootFontSize * 48) {
    expect(headerDisplay).toBe("none");
    return;
  }
  expect(headerDisplay).not.toBe("none");
}

async function expectMobileNavigationIsCompact(page: Page, width: number) {
  const navigation = page.locator(".bottom-navigation");
  if (width >= 1024) {
    await expect(navigation).toHaveCount(0);
    return;
  }
  await expect(
    navigation.getByRole("link", { name: "Activity" }),
  ).toBeVisible();

  const layout = await navigation.evaluate((node) => {
    const links = [...node.querySelectorAll("a")].map((link) => {
      const rect = link.getBoundingClientRect();
      return { bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    return {
      links,
    };
  });

  expect(layout.links).toHaveLength(4);
  expect(layout.links.every(({ height }) => height >= 48)).toBe(true);
  expect(
    Math.max(...layout.links.map(({ width }) => width)) -
      Math.min(...layout.links.map(({ width }) => width)),
  ).toBeLessThanOrEqual(1);
  expect(
    new Set(layout.links.map(({ bottom }) => Math.round(bottom))).size,
  ).toBe(1);
}

async function measureTrendBars(card: ReturnType<Page["locator"]>) {
  return card.evaluate((node) => {
    const barHeight = (selector: string) =>
      node.querySelector(selector)?.getBoundingClientRect().height ?? 0;
    return {
      cash: barHeight(".trend-bars .cash span"),
      expenses: barHeight(".trend-bars .expenses span"),
      net: barHeight(".trend-bars .net span"),
    };
  });
}

async function expectTooltipPointerAligned(
  trigger: ReturnType<Page["locator"]>,
  tooltip: ReturnType<Page["locator"]>,
) {
  const [triggerBox, tooltipBox, pointer] = await Promise.all([
    trigger.boundingBox(),
    tooltip.boundingBox(),
    tooltip.evaluate((node) => {
      const style = getComputedStyle(node, "::after");
      return {
        insetInlineStart: Number.parseFloat(style.insetInlineStart),
      };
    }),
  ]);

  const triggerCenter = triggerBox!.x + triggerBox!.width / 2;
  const pointerCenter = tooltipBox!.x + pointer.insetInlineStart;
  expect(Math.abs(triggerCenter - pointerCenter)).toBeLessThanOrEqual(1);
}

async function expectDialogFitsViewport(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
) {
  const [box, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    })),
  ]);

  expect(box?.width).toBeLessThanOrEqual(viewport.width);
  expect(box?.height).toBeLessThanOrEqual(viewport.height);
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
    budget_statuses: attentionQueueStatuses(),
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
