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
    page.getByRole("heading", { name: "Transactions" }),
  ).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();

  const response = await page.request.get("/api/transactions?limit=1");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.json()).page.total).toBeGreaterThanOrEqual(1);
});

test("packaged SPA renders a client-side not-found view", async ({ page }) => {
  await page.goto("/definitely-unknown");
  await expect(
    page.getByRole("heading", { name: "Nothing lives here" }),
  ).toBeVisible();
});
