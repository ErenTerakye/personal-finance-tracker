import { expect, test, type Locator, type Page } from "@playwright/test";

const colorSchemeStorageKey = "finance-tracker-color-scheme";
const viewports = [320, 390, 430, 768, 1024, 1280, 1440, 1800, 1920];
const themeViewports = [390, 1280];

test("formats the supported high-value boundary without losing a cent", async ({
  page,
}) => {
  await mockApi(page, {
    transactionPayload: {
      ...transaction(),
      amount: "90071992547409.91",
      description: "Boundary amount",
    },
  });
  await page.goto("/transactions?month=6&year=2026");

  await expect(
    page.getByText("$90,071,992,547,409.91", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("$90,071,992,547,409.90")).toHaveCount(0);
});

test("uses the full recent transaction card as its hit target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");

  const transactionButton = page.getByRole("button", {
    name: /Food Groceries.*45\.90.*Expense.*Jun 12/i,
  });
  await expect(transactionButton).toBeVisible();

  const hitTarget = await transactionButton.boundingBox();
  expect(hitTarget).not.toBeNull();
  expect(hitTarget!.height).toBeGreaterThanOrEqual(72);

  await transactionButton.click({
    position: { x: 6, y: hitTarget!.height / 2 },
  });
  await expect(page).toHaveURL(
    "/transactions?month=6&year=2026&search=Groceries",
  );
});

test("accepts rapid repeated month navigation without a transition cooldown", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page);
  await page.goto("/?month=6&year=2026");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const nextMonth = page.getByRole("button", { name: /^Next month,/ });
  const bounds = await nextMonth.boundingBox();
  expect(bounds).not.toBeNull();

  for (let index = 0; index < 4; index += 1) {
    await page.mouse.click(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
  }

  await expect(page).toHaveURL(/month=10&year=2026/);
  await expect(page.locator("html")).not.toHaveClass(/period-view-transition/);

  const previousMonth = page.getByRole("button", { name: /^Previous month,/ });
  const previousBounds = await previousMonth.boundingBox();
  expect(previousBounds).not.toBeNull();
  for (let index = 0; index < 6; index += 1) {
    await page.mouse.click(
      previousBounds!.x + previousBounds!.width / 2,
      previousBounds!.y + previousBounds!.height / 2,
    );
  }
  await expect(page).toHaveURL(/month=4&year=2026/);
});

test("opens the compact period backdrop with one continuous fade", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/?month=6&year=2026");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const samplesPromise = page.evaluate(async () => {
    const picker = document.querySelector<HTMLDialogElement>(".period-popover");
    if (!picker) throw new Error("Expected compact period picker");

    const opacitySamples: number[] = [];
    while (!picker.open) await new Promise(requestAnimationFrame);
    const startedAt = performance.now();
    while (performance.now() - startedAt < 500) {
      await new Promise(requestAnimationFrame);
      opacitySamples.push(
        Number.parseFloat(getComputedStyle(picker, "::backdrop").opacity),
      );
    }
    return opacitySamples;
  });
  await page.getByRole("button", { name: /Choose period/ }).click();
  const samples = await samplesPromise;

  expect(samples.at(-1)).toBe(1);
  expect(
    samples.every(
      (sample, index) => index === 0 || sample >= samples[index - 1] - 0.01,
    ),
  ).toBe(true);
});

test("compact bottom navigation localizes from inline header utilities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 844 });
  await mockApi(page);
  await page.goto("/");

  const navigation = page.locator(".bottom-navigation");
  await expect(navigation.getByRole("link")).toHaveCount(4);
  const activeLink = navigation.getByRole("link", { name: "Overview" });
  await expect(activeLink).toHaveAttribute("aria-current", "page");
  await expect(activeLink.locator("svg")).toHaveAttribute(
    "fill",
    "currentColor",
  );
  await expect(
    navigation.getByRole("link", { name: "Transactions" }).locator("svg"),
  ).toHaveAttribute("fill", "none");

  const activeLinkBounds = await activeLink.boundingBox();
  expect(activeLinkBounds).not.toBeNull();
  await page.mouse.move(
    activeLinkBounds!.x + activeLinkBounds!.width / 2,
    activeLinkBounds!.y + activeLinkBounds!.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(() =>
      activeLink.evaluate((link) => {
        const icon = link.querySelector("svg")!;
        return {
          backgroundColor: getComputedStyle(link).backgroundColor,
          iconTransform: getComputedStyle(icon).transform,
          linkTransform: getComputedStyle(link).transform,
        };
      }),
    )
    .toEqual({
      backgroundColor: "rgba(0, 0, 0, 0)",
      iconTransform: "matrix(0.94, 0, 0, 0.94, 0, 0)",
      linkTransform: "none",
    });
  await page.mouse.up();

  const compactBar = page.locator(".compact-app-bar");
  await expect(page.locator("#app-drawer")).toHaveCount(0);
  await expect(
    compactBar.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveCount(0);
  await expect(compactBar.getByRole("link", { name: "Manage" })).toBeVisible();
  const headerLayout = await captureCompactHeaderLayout(page);

  // Navigate to Manage Preferences page to change language on compact screen widths
  await compactBar.getByRole("link", { name: "Manage" }).click();
  await expect(page).toHaveURL(/\/manage\/automations/);

  const manageNav = page.locator(".manage-navigation");
  await manageNav.getByRole("link", { name: "Preferences" }).click();
  await expect(page).toHaveURL(/\/manage\/preferences/);

  // Under PreferenceChoiceGroups in PreferencesView, choose Turkish
  const prefGroup = page.locator(".preference-choice-groups");
  await prefGroup.getByRole("radio", { name: "Turkish" }).locator("..").click();

  await expect(
    navigation.getByRole("link", { name: "Genel Bakış" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "İşlemler" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Bütçeler" }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Hesaplar" }),
  ).toBeVisible();

  // Return to Overview page to check layout consistency
  await navigation.getByRole("link", { name: "Genel Bakış" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await captureCompactHeaderLayout(page)).toEqual(headerLayout);
});

test("keeps compact navigation live through rapid tab switches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const navigation = page.locator(".compact-primary-navigation");
  for (const path of ["/transactions", "/budgets", "/accounts", "/"]) {
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

test("switches compact tabs without a shared-page route transition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: () => {
        throw new Error("Tab switches must not start a View Transition");
      },
    });
  });

  await page.getByRole("link", { name: "Transactions" }).click();

  await expect(page).toHaveURL(/\/transactions$/);
  await expect(
    page.getByRole("heading", { name: "Transactions" }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/route-view-transition/);
});

test("restores compact tabs to independent remembered scroll positions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const overviewScroll = await page.evaluate(() => {
    window.scrollTo({ top: 700, behavior: "instant" });
    return window.scrollY;
  });
  expect(overviewScroll).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(
    page.getByRole("heading", { name: "Transactions" }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const transactionsScroll = await page.evaluate(() => {
    window.scrollTo({ top: 350, behavior: "instant" });
    return window.scrollY;
  });
  expect(transactionsScroll).toBeGreaterThan(0);

  await page.getByRole("link", { name: "Overview" }).click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(overviewScroll);

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(transactionsScroll);
});

test("scrolls the monthly automation creator in a short viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 600 });
  await mockApi(page);
  await page.goto("/manage/automations");

  await page
    .getByRole("button", { name: "Add recurring entry" })
    .first()
    .click();

  const dialog = page.getByRole("dialog", {
    name: "Add recurring entry",
  });
  const scrollState = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      overflowY: style.overflowY,
      scrollHeight: element.scrollHeight,
    };
  });

  expect(scrollState.overflowY).toBe("auto");
  expect(scrollState.scrollHeight).toBeGreaterThanOrEqual(
    scrollState.clientHeight,
  );

  const submit = dialog.getByRole("button", { name: "Add recurring entry" });
  await submit.scrollIntoViewIfNeeded();
  const [dialogBox, submitBox] = await Promise.all([
    dialog.boundingBox(),
    submit.boundingBox(),
  ]);
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(
    dialogBox!.y + dialogBox!.height,
  );
});

test("aligns compact page actions with their heading content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockApi(page, {
    netWorthOverviewPayload: populatedNetWorthOverview(),
  });

  for (const path of ["/transactions", "/accounts", "/manage/automations"]) {
    await page.goto(path);
    await expect(page.locator(".page-heading")).toBeVisible();
    await expectPageActionsAlignedWithHeading(page);
  }
});

test("adapts the dashboard toolbar only at the wide layout breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockApi(page);
  await page.goto("/");

  const actions = page.getByLabel("Next actions");
  const toolbar = page.locator(".dashboard-toolbar");
  const [compactActionsBox, compactToolbarBox] = await Promise.all([
    actions.boundingBox(),
    toolbar.boundingBox(),
  ]);

  expect(compactActionsBox).not.toBeNull();
  expect(compactToolbarBox).not.toBeNull();
  expect(
    Math.abs(compactActionsBox!.width - compactToolbarBox!.width),
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1280, height: 900 });

  const exportButton = page.getByRole("button", {
    name: "Download dashboard artifacts",
  });
  const addButton = actions.getByRole("button", {
    name: "Add transaction",
  });
  const budgetButton = actions.getByRole("button", { name: "Set budget" });
  const [wideActionsBox, wideToolbarBox, exportBox, addBox, budgetBox] =
    await Promise.all([
      actions.boundingBox(),
      toolbar.boundingBox(),
      exportButton.boundingBox(),
      addButton.boundingBox(),
      budgetButton.boundingBox(),
    ]);

  expect(wideActionsBox).not.toBeNull();
  expect(wideToolbarBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(addBox).not.toBeNull();
  expect(budgetBox).not.toBeNull();
  expect(wideActionsBox!.width).toBeLessThan(wideToolbarBox!.width * 0.5);
  expect(addBox!.x - (exportBox!.x + exportBox!.width)).toBeLessThanOrEqual(10);
  expect(Math.abs(addBox!.y - exportBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(budgetBox!.y - exportBox!.y)).toBeLessThanOrEqual(1);
});

test("opens category guardrails without covering or rearranging cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockApi(page);
  await page.goto("/budgets");

  const cards = page.locator(".plan-category-card");
  const grid = page.locator(".plan-category-grid");
  await expect(cards.first()).toBeVisible();
  const readCardGeometry = () =>
    grid.evaluate((gridElement) => {
      const geometry = Array.from(
        gridElement.querySelectorAll<HTMLElement>(".plan-category-card"),
      )
        .slice(0, 6)
        .map((element) => ({
          height: element.offsetHeight,
          width: element.offsetWidth,
          x: element.offsetLeft,
          y: element.offsetTop,
        }));
      const firstY = geometry[0]?.y ?? 0;
      return geometry.map((card) => ({ ...card, y: card.y - firstY }));
    });
  const before = await readCardGeometry();

  const trigger = page.getByRole("button", { name: /Travel, .* used/ });
  await trigger.click();

  const inspector = page.locator(".plan-inspector");
  await expect(inspector).toHaveClass(/is-open/);
  await expect(
    page.getByRole("button", { name: "Edit Travel budget" }),
  ).toBeVisible();
  await inspector.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  expect(await readCardGeometry()).toEqual(before);
  const [inspectorBox, gridBox] = await Promise.all([
    inspector.boundingBox(),
    grid.boundingBox(),
  ]);
  expect(inspectorBox!.y + inspectorBox!.height).toBeLessThanOrEqual(
    gridBox!.y,
  );
  expect(
    await inspector.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).not.toBe("0s");

  await page.getByRole("button", { name: "Close category details" }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(inspector).toBeHidden();
  expect(await readCardGeometry()).toEqual(before);
});

test("keeps the compact app bar configured above period snapshots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  const transitionChrome = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".compact-app-bar");
    if (!header) throw new Error("Expected compact app bar");
    return {
      headerTransitionName: getComputedStyle(header).viewTransitionName,
      headerGroupZIndex: getComputedStyle(
        document.documentElement,
        "::view-transition-group(period-header)",
      ).zIndex,
    };
  });

  expect(transitionChrome).toEqual({
    headerTransitionName: "period-header",
    headerGroupZIndex: "1",
  });
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
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

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

test("shows transaction data options beyond the hero card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockApi(page);
  await page.goto("/transactions");

  const hero = page.locator(".activity-hero");
  const menu = page.locator(".data-menu-popover");
  const exportLink = menu.getByRole("link", { name: "Export CSV" });

  await page.locator(".data-menu > summary").click();
  await expect(exportLink).toBeVisible();

  const [heroBox, menuBox] = await Promise.all([
    hero.boundingBox(),
    menu.boundingBox(),
  ]);
  expect(heroBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.y + menuBox!.height).toBeGreaterThan(
    heroBox!.y + heroBox!.height,
  );

  await expect
    .poll(() =>
      exportLink.evaluate((link) => {
        const rect = link.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return target !== null && link.contains(target);
      }),
    )
    .toBe(true);
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
        page.getByRole("heading", { name: "Overview" }),
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
      await expectRailPreferenceControls(page);
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
        page.getByRole("heading", { name: "Transactions", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Groceries")).toBeVisible();
      await page.locator(".data-menu > summary").click();
      await expect(
        page.getByRole("button", { name: "Import CSV" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Export CSV" }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await expectElementsFitViewport(page, [
        ".activity-hero",
        ".activity-snapshot",
        ".activity-command-bar",
        ".activity-ledger",
        ".ledger-entry",
      ]);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(
        page.getByRole("button", { name: "Edit", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Delete", exact: true }),
      ).toBeVisible();

      await page
        .locator(".activity-hero")
        .getByRole("button", { name: "Add transaction" })
        .click();
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
      await page.locator(".data-menu > summary").click();
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

    test("adapts the automation list and guided creator", async ({ page }) => {
      await page.goto("/manage/automations");

      await expect(
        page.getByRole("heading", { name: "Automations", exact: true }),
      ).toBeVisible();
      const manageNavigation = page.locator(".manage-navigation");
      await expect(manageNavigation.getByRole("link")).toHaveCount(4);
      await expect(
        manageNavigation.getByRole("link", { name: "Preferences" }),
      ).toBeVisible();
      await expect(page.locator(".manage-record-list")).toContainText("Rent");
      await expect(
        page.getByRole("button", { name: "Review entries" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Add recurring entry" }).click();
      const dialog = page.getByRole("dialog", { name: "Add recurring entry" });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
      await assertNoHorizontalOverflow(page);
      await expectElementsFitViewport(page, [
        ".manage-navigation",
        ".manage-callout",
        ".manage-record-list li",
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

    await page.getByRole("heading", { name: "Overview" }).click();
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

    test("pins and persists explicit light and dark themes", async ({
      page,
    }) => {
      const route = width < 576 ? "/manage/preferences" : "/";
      await page.goto(route);

      await expectThemeChoice(page, width, "dark");
      await expectThemeState(page, {
        dataTheme: null,
        meta: "light dark",
        stored: null,
        colorScheme: "light dark",
      });

      await chooseTheme(page, width, "dark");

      await expectThemeChoice(page, width, "light");
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark",
      });
      await assertNoHorizontalOverflow(page);

      await page.reload();

      await expect(
        page.getByRole("heading", {
          name: width < 576 ? "Preferences" : "Overview",
        }),
      ).toBeVisible();
      await expectThemeChoice(page, width, "light");
      await expectThemeState(page, {
        dataTheme: "dark",
        meta: "dark",
        stored: "dark",
        colorScheme: "dark",
      });

      await chooseTheme(page, width, "light");

      await expectThemeChoice(page, width, "dark");
      await expectThemeState(page, {
        dataTheme: "light",
        meta: "light",
        stored: "light",
        colorScheme: "light",
      });
      await assertNoHorizontalOverflow(page);
    });

    test("switches repeatedly without a transition or layout shift", async ({
      page,
    }) => {
      await page.goto(width < 576 ? "/manage/preferences" : "/");
      await expect(
        page.getByRole("heading", {
          name: width < 576 ? "Preferences" : "Overview",
        }),
      ).toBeVisible();
      await themeChoiceTarget(page, width, "dark").scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const initialScrollY = await page.evaluate(() => window.scrollY);
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

      await chooseTheme(page, width, "dark");
      await chooseTheme(page, width, "light");

      await expectThemeState(page, {
        dataTheme: "light",
        meta: "light",
        stored: "light",
        colorScheme: "light",
      });
      await page.evaluate(
        (scrollY) => window.scrollTo(0, scrollY),
        initialScrollY,
      );
      expect(await captureThemeLayout(page)).toEqual(initialLayout);
      expect(await transitionObserved).toBe(false);
    });
  });
}

test("groups desktop sidebar utilities in one clean row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page);
  await page.goto("/");

  const utilities = page.locator(".rail-utilities");
  const controls = [
    utilities.getByRole("link", { name: "Manage" }),
    utilities.getByRole("button", { name: "Use dark mode" }),
    utilities.getByRole("button", { name: "Switch to Turkish" }),
  ];

  await expect(page.getByText("Local SQLite")).toHaveCount(0);
  await expect(utilities).toHaveCSS("border-top-style", "none");

  const utilityBounds = await utilities.boundingBox();
  expect(utilityBounds).not.toBeNull();
  for (const control of controls) {
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(utilityBounds!.x);
    expect(bounds!.y).toBe(utilityBounds!.y);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      utilityBounds!.x + utilityBounds!.width,
    );
  }
});

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

    const themeToggle = page.locator(".theme-toggle");
    await expect(themeToggle).toHaveAttribute("aria-label", "Use dark mode");
    await page.emulateMedia({ colorScheme: "dark" });

    await expect(themeToggle).toHaveAttribute("aria-label", "Use light mode");
    await expectThemeState(page, {
      dataTheme: null,
      meta: "light dark",
      stored: null,
      colorScheme: "light dark",
    });

    await themeToggle.click();
    await page.emulateMedia({ colorScheme: "light" });

    await expect(themeToggle).toHaveAttribute("aria-label", "Use dark mode");
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
    await page.locator(".theme-toggle").click();
    const darkColors = await rail.evaluate(readElementColors);

    expect(darkColors.backgroundColor).not.toBe(lightColors.backgroundColor);
    expect(darkColors.color).not.toBe(lightColors.color);
    expect(darkColors.borderInlineEndColor).not.toBe(
      lightColors.borderInlineEndColor,
    );
  });
});

test.describe("accounts scoreboard theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await mockApi(page, {
      netWorthOverviewPayload: populatedNetWorthOverview(),
    });
  });

  test("uses the active theme tokens for summary information", async ({
    page,
  }) => {
    await page.goto("/accounts");

    const header = page.locator(".wealth-metric-card.assets");
    await expect(header).toBeVisible();
    const lightAppearance = await readNetWorthHeaderAppearance(header);

    expect(lightAppearance.backgroundColor).toBe(lightAppearance.surface);
    expect(lightAppearance.color).toBe(lightAppearance.ink);

    await page.locator(".theme-toggle").click();
    const darkAppearance = await readNetWorthHeaderAppearance(header);

    expect(darkAppearance.backgroundColor).toBe(darkAppearance.surface);
    expect(darkAppearance.color).toBe(darkAppearance.ink);
    expect(darkAppearance.backgroundColor).not.toBe(
      lightAppearance.backgroundColor,
    );
    expect(darkAppearance.color).not.toBe(lightAppearance.color);
  });

  test("tracks the nearest net worth date across the full plot", async ({
    page,
  }) => {
    await page.goto("/accounts");

    const chart = page.getByRole("img", { name: "Net worth over time" });
    await expect(chart).toBeVisible();
    await expect(chart.getByText("0", { exact: true })).toBeVisible();
    await chart.scrollIntoViewIfNeeded();
    const chartBox = await chart.boundingBox();
    expect(chartBox).not.toBeNull();

    await page.mouse.move(
      (chartBox?.x ?? 0) + (chartBox?.width ?? 0) * 0.2,
      (chartBox?.y ?? 0) + (chartBox?.height ?? 0) * 0.5,
    );
    const tooltip = page.locator(".wealth-chart-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("Jun 30, 2026");
    await expect(tooltip).toContainText("+$9,500.00");
    await expect(tooltip).toHaveCSS("pointer-events", "none");

    const firstPosition = await tooltip.getAttribute("style");
    await page.mouse.move(
      (chartBox?.x ?? 0) + (chartBox?.width ?? 0) * 0.3,
      (chartBox?.y ?? 0) + (chartBox?.height ?? 0) * 0.7,
    );
    await expect(tooltip).toHaveAttribute("style", firstPosition ?? "");

    await page.mouse.move(
      (chartBox?.x ?? 0) + (chartBox?.width ?? 0) * 0.85,
      (chartBox?.y ?? 0) + (chartBox?.height ?? 0) * 0.5,
    );
    await expect(tooltip).toContainText("Jul 16, 2026");
    await expect(tooltip).toContainText("+$10,000.00");
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

async function expectPageActionsAlignedWithHeading(page: Page) {
  const heading = page.locator(".page-heading");
  const copy = heading.locator(":scope > div:first-child");
  const firstAction = heading.locator(".page-actions .button").first();
  const [copyBox, actionBox] = await Promise.all([
    copy.boundingBox(),
    firstAction.boundingBox(),
  ]);

  expect(copyBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(Math.abs(actionBox!.x - copyBox!.x)).toBeLessThanOrEqual(1);
  expect(actionBox!.y).toBeGreaterThanOrEqual(copyBox!.y + copyBox!.height);
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
  const bars = await page.locator(".plan-card-progress").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const card = node.closest("button")?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        cardLeft: card?.left ?? 0,
        cardRight: card?.right ?? 0,
      };
    }),
  );

  expect(bars.length).toBeGreaterThanOrEqual(3);
  for (const bar of bars) {
    expect(bar.left).toBeGreaterThanOrEqual(bar.cardLeft);
    expect(bar.right).toBeLessThanOrEqual(bar.cardRight);
    expect(bar.width).toBeGreaterThan(40);
    expect(bar.height).toBeGreaterThanOrEqual(6);
  }
}

async function captureThemeLayout(page: Page) {
  return page
    .locator(
      "main:visible, .theme-toggle:visible, .app-rail:visible, .compact-app-bar:visible, .compact-primary-navigation:visible",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width } = element.getBoundingClientRect();
        return { x, y, width };
      }),
    );
}

async function expectRailPreferenceControls(page: Page) {
  const compactLayout = (page.viewportSize()?.width ?? 0) <= 1023;
  const container = page.locator(
    compactLayout ? ".compact-app-bar" : ".app-rail",
  );

  await expect(container.locator(".theme-toggle")).toBeVisible();
  await expect(container.locator(".lang-toggle")).toBeVisible();
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
  const create = compactBar.getByRole("button", { name: "Add transaction" });
  const brandName = brand.locator("strong");

  await expect(page.locator("#app-drawer")).toHaveCount(0);
  await expect(
    compactBar.getByRole("button", { name: "Open navigation menu" }),
  ).toHaveCount(0);

  const manage = compactBar.getByRole("link", { name: "Manage" });

  for (const control of [brand, manage, create]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(47.9);
    expect(box!.height).toBeGreaterThanOrEqual(47.9);
  }

  await expect(brandName).toBeHidden();

  await expectElementsFitViewport(page, [
    ".compact-app-bar .brand",
    ".compact-utilities",
    ".compact-create",
  ]);
}

function themeChoice(page: Page, width: number, scheme: "light" | "dark") {
  const label = `${scheme[0].toUpperCase()}${scheme.slice(1)}`;
  return width < 576
    ? page.getByRole("radio", { name: label, exact: true })
    : page.locator(".theme-toggle");
}

async function expectThemeChoice(
  page: Page,
  width: number,
  scheme: "light" | "dark",
) {
  const control = themeChoice(page, width, scheme);
  await expect(control).toBeVisible();
}

async function chooseTheme(
  page: Page,
  width: number,
  scheme: "light" | "dark",
) {
  const control = themeChoice(page, width, scheme);
  if (width < 576) {
    await control.locator("..").click();
  } else {
    const currentTheme = await page.locator("html").getAttribute("data-theme");
    if (scheme === "dark" && currentTheme !== "dark") {
      await control.click();
    } else if (scheme === "light" && currentTheme === "dark") {
      await control.click();
    }
  }
}

function themeChoiceTarget(
  page: Page,
  width: number,
  scheme: "light" | "dark",
) {
  const control = themeChoice(page, width, scheme);
  return width < 576 ? control.locator("..") : control;
}

async function captureCompactHeaderLayout(page: Page) {
  return page
    .locator(".compact-app-bar .brand, .compact-manage, .compact-create")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
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

async function readNetWorthHeaderAppearance(header: Locator) {
  return header.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;background-color:var(--surface);color:var(--ink);outline-color:var(--muted)";
    element.append(probe);

    const styles = getComputedStyle(element);
    const secondary = element.querySelector("span");
    const secondaryStyles = secondary ? getComputedStyle(secondary) : null;
    const probeStyles = getComputedStyle(probe);
    const appearance = {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      secondaryColor: secondaryStyles?.color ?? "",
      surface: probeStyles.backgroundColor,
      ink: probeStyles.color,
      muted: probeStyles.outlineColor,
    };
    probe.remove();
    return appearance;
  });
}

async function expectMobileNavigationIsCompact(page: Page, width: number) {
  const navigation = page.locator(".bottom-navigation");
  if (width >= 1024) {
    await expect(navigation).toHaveCount(0);
    return;
  }
  await expect(
    navigation.getByRole("link", { name: "Transactions" }),
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

async function mockApi(
  page: Page,
  {
    netWorthOverviewPayload = netWorthOverview(),
    transactionPayload = transaction(),
  }: {
    netWorthOverviewPayload?:
      | ReturnType<typeof netWorthOverview>
      | ReturnType<typeof populatedNetWorthOverview>;
    transactionPayload?: ReturnType<typeof transaction>;
  } = {},
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
      await route.fulfill({ json: netWorthOverviewPayload });
      return;
    }
    if (url.pathname === "/api/net-worth") {
      await route.fulfill({ json: netWorthSummary() });
      return;
    }
    if (url.pathname === "/api/transactions") {
      await route.fulfill({ json: { transactions: [transactionPayload] } });
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

function populatedNetWorthOverview() {
  return {
    summary: {
      ...netWorthSummary(),
      total_assets: "12500.00",
      total_liabilities: "2500.00",
      total_net_worth: "10000.00",
      active_account_count: 2,
      resolved_asset_count: 1,
      resolved_liability_count: 1,
    },
    history: {
      as_of: "2026-07-16",
      months: 12,
      points: [
        {
          as_of: "2026-06-30",
          total_assets: "12000.00",
          total_liabilities: "2500.00",
          total_net_worth: "9500.00",
          resolved_asset_count: 1,
          resolved_liability_count: 1,
          unresolved_account_count: 0,
        },
        {
          as_of: "2026-07-16",
          total_assets: "12500.00",
          total_liabilities: "2500.00",
          total_net_worth: "10000.00",
          resolved_asset_count: 1,
          resolved_liability_count: 1,
          unresolved_account_count: 0,
        },
      ],
      change_amount: "500.00",
      change_percent: "5.3",
      currency: "USD",
    },
    comparison: {
      start_date: "2026-06-30",
      end_date: "2026-07-16",
      available: true,
      start_value: "9500.00",
      end_value: "10000.00",
      change_amount: "500.00",
      change_percent: "5.3",
    },
    accounts: [
      {
        account_id: 1,
        name: "Savings",
        type: "asset",
        archived_on: null,
        current_balance: "12500.00",
        current_balance_date: "2026-07-16",
        comparison_balance: "12000.00",
        comparison_balance_date: "2026-06-30",
        contribution_change: "500.00",
        composition_percent: "100.0",
        currency: "USD",
      },
      {
        account_id: 2,
        name: "Loan",
        type: "liability",
        archived_on: null,
        current_balance: "2500.00",
        current_balance_date: "2026-07-16",
        comparison_balance: "2500.00",
        comparison_balance_date: "2026-06-30",
        contribution_change: "0.00",
        composition_percent: "100.0",
        currency: "USD",
      },
    ],
    coverage: {
      resolved_account_count: 2,
      unresolved_account_count: 0,
      oldest_balance_date: "2026-06-30",
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
