import { expect, test } from "@playwright/test";

test("built SPA reads and writes account-aware activity through FastAPI and SQLite", async ({
  page,
}) => {
  const suffix = Date.now();
  const accountName = `Full-stack checking ${suffix}`;
  const description = `Full-stack expense ${suffix}`;
  const accountResponse = await page.request.post("/api/accounts", {
    data: {
      name: accountName,
      type: "asset",
      subtype: "cash",
      opening_balance: "100.00",
      opening_date: "2026-07-01",
    },
  });
  expect(accountResponse.status()).toBe(201);
  const accountId = (await accountResponse.json()).account.id;

  const created = await page.request.post("/api/activities", {
    data: {
      kind: "expense",
      amount: "12.34",
      category: "Food",
      description,
      date: "2026-07-10",
      account_id: accountId,
    },
  });
  expect(created.status()).toBe(201);
  const createdBody = await created.json();
  expect(createdBody.notice_code).toBe("activity.created");
  expect(createdBody.activity.account.after_balance).toBe("87.66");

  await page.goto(
    `/activity?month=7&year=2026&account_id=${accountId}&search=${encodeURIComponent(description)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Activity", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  const response = await page.request.get(
    `/api/activities?account_id=${accountId}`,
  );
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.json()).page.total).toBe(2);
});

test("adjustments, history, and zero-balance archive persist through reload", async ({
  page,
}) => {
  const name = `Full-stack asset ${Date.now()}`;
  const baselineResponse = await page.request.get(
    "/api/net-worth?as_of=2026-07-12",
  );
  expect(baselineResponse.ok()).toBe(true);
  const baseline = await baselineResponse.json();

  const createdResponse = await page.request.post("/api/accounts", {
    data: {
      name,
      type: "asset",
      subtype: "investment",
      opening_balance: "1000.00",
      opening_date: "2026-07-10",
    },
  });
  expect(createdResponse.status()).toBe(201);
  const accountId = (await createdResponse.json()).account.id;

  const adjustmentResponse = await page.request.post("/api/activities", {
    data: {
      kind: "adjustment",
      amount: "1250.00",
      description: "Observed investment value",
      date: "2026-07-12",
      account_id: accountId,
    },
  });
  expect(adjustmentResponse.status()).toBe(201);
  const adjustment = await adjustmentResponse.json();
  expect(adjustment.notice_code).toBe("activity.created");
  expect(adjustment.activity.account.balance_effect).toBe("250.00");

  const historicalAccountsResponse = await page.request.get(
    "/api/accounts?as_of=2026-07-11",
  );
  const historicalAccounts = await historicalAccountsResponse.json();
  const historicalAccount = historicalAccounts.accounts.find(
    (account: { id: number }) => account.id === accountId,
  );
  expect(historicalAccount?.balance).toBe("1000.00");

  const currentResponse = await page.request.get(
    "/api/net-worth?as_of=2026-07-12",
  );
  const current = await currentResponse.json();
  expect(
    Number(current.total_net_worth) - Number(baseline.total_net_worth),
  ).toBe(1250);

  const historyResponse = await page.request.get(
    "/api/net-worth/history?as_of=2026-07-12&months=2",
  );
  const history = await historyResponse.json();
  expect(history.points).toHaveLength(2);
  expect(history.points.at(-1).total_net_worth).toBe(current.total_net_worth);

  const closingAdjustment = await page.request.post("/api/activities", {
    data: {
      kind: "adjustment",
      amount: "0.00",
      description: "Account closed",
      date: "2026-07-15",
      account_id: accountId,
    },
  });
  expect(closingAdjustment.status()).toBe(201);

  const archiveResponse = await page.request.post(
    `/api/accounts/${accountId}/archive`,
    { data: { closing_date: "2026-07-15" } },
  );
  expect(archiveResponse.ok()).toBe(true);
  expect((await archiveResponse.json()).notice_code).toBe("account.archived");

  await page.goto("/net-worth?as_of=2026-07-16&months=6");
  await expect(page).toHaveURL("/accounts?as_of=2026-07-16&months=6");
  await expect(
    page.getByRole("heading", { name: "Accounts", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  const archivedAccountsResponse = await page.request.get(
    "/api/accounts?as_of=2026-07-16&include_archived=true",
  );
  const archivedAccounts = await archivedAccountsResponse.json();
  const archivedAccount = archivedAccounts.accounts.find(
    (account: { id: number }) => account.id === accountId,
  );
  expect(archivedAccount?.archived_on).toBe("2026-07-15");
  expect(archivedAccount?.balance).toBe("0.00");
});

test("packaged SPA renders a client-side not-found view", async ({ page }) => {
  await page.goto("/definitely-unknown");
  await expect(
    page.getByRole("heading", { name: "Nothing lives here" }),
  ).toBeVisible();
});
