import { expect, test } from "@playwright/test";

test("built SPA reads and writes through the real FastAPI and SQLite stack", async ({
  page,
}) => {
  const description = `Full-stack check ${Date.now()}`;
  const created = await page.request.post("/api/transactions", {
    data: {
      type: "expense",
      amount: "12.34",
      category: "Food",
      description,
      date: "2026-07-10",
    },
  });
  expect(created.status()).toBe(201);
  expect((await created.json()).notice_code).toBe("transaction.created");

  await page.goto("/transactions?month=7&year=2026");
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();

  const response = await page.request.get("/api/transactions?limit=1");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.json()).page.total).toBeGreaterThanOrEqual(1);
});

test("net worth history and archive persist through FastAPI, SQLite, and reload", async ({
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
      initial_balance: "1000.00",
      initial_balance_date: "2026-07-10",
    },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  expect(created.notice_code).toBe("account.created");
  const accountId = created.account.id;

  const snapshotResponse = await page.request.put(
    `/api/accounts/${accountId}/balance-snapshots/2026-07-12`,
    { data: { amount: "1250.00" } },
  );
  expect(snapshotResponse.ok()).toBe(true);
  expect((await snapshotResponse.json()).notice_code).toBe(
    "balance_snapshot.created",
  );

  const historicalAccountsResponse = await page.request.get(
    "/api/accounts?as_of=2026-07-11",
  );
  const historicalAccounts = await historicalAccountsResponse.json();
  const historicalAccount = historicalAccounts.accounts.find(
    (account: { id: number }) => account.id === accountId,
  );
  expect(historicalAccount?.resolved_balance).toBe("1000.00");

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

  const archiveResponse = await page.request.post(
    `/api/accounts/${accountId}/archive`,
    {
      data: {
        closing_date: "2026-07-15",
        confirm_zero_balance: true,
      },
    },
  );
  expect(archiveResponse.ok()).toBe(true);
  expect((await archiveResponse.json()).notice_code).toBe("account.archived");

  await page.goto("/net-worth?as_of=2026-07-14&months=6");
  await expect(page).toHaveURL("/accounts?as_of=2026-07-14&months=6");
  await expect(
    page.getByRole("heading", { name: "Accounts", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Show archived accounts" }).check();
  await expect(
    page
      .getByRole("region", {
        name: "Accounts behind the number",
        exact: true,
      })
      .getByText(name, { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("checkbox", { name: "Show archived accounts" }).check();
  await expect(
    page
      .getByRole("region", {
        name: "Accounts behind the number",
        exact: true,
      })
      .getByText(name, { exact: true }),
  ).toBeVisible();

  const archivedAccountsResponse = await page.request.get(
    "/api/accounts?as_of=2026-07-16&include_archived=true",
  );
  const archivedAccounts = await archivedAccountsResponse.json();
  const archivedAccount = archivedAccounts.accounts.find(
    (account: { id: number }) => account.id === accountId,
  );
  expect(archivedAccount?.archived_on).toBe("2026-07-15");
});

test("packaged SPA renders a client-side not-found view", async ({ page }) => {
  await page.goto("/definitely-unknown");
  await expect(
    page.getByRole("heading", { name: "Nothing lives here" }),
  ).toBeVisible();
});
