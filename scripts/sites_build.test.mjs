import assert from "node:assert/strict";
import test from "node:test";

import worker from "../dist/server/index.js";

const env = {
  ASSETS: {
    fetch: async () => new Response("not found", { status: 404 }),
  },
};

async function api(path) {
  const response = await worker.fetch(
    new Request(`https://finance.example${path}`),
    env,
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("hosted dashboard includes the current net-worth contract", async () => {
  const dashboard = await api("/api/dashboard?month=7&year=2026");

  assert.equal(dashboard.recent_transactions.length, 5);
  assert.equal(dashboard.budget_statuses.length, 10);
  assert.equal(dashboard.net_worth.active_account_count, 6);
  assert.equal(dashboard.net_worth.total_net_worth, "56280.00");
});

test("hosted Accounts workspace receives seeded histories and analytics", async () => {
  const overview = await api(
    "/api/net-worth/overview?as_of=2026-07-16&months=12",
  );

  assert.equal(overview.accounts.length, 6);
  assert.equal(overview.history.points.length, 12);
  assert.equal(overview.coverage.resolved_account_count, 7);
  assert.equal(overview.summary.total_assets, "64865.00");
  assert.equal(overview.summary.total_liabilities, "8585.00");
  assert.equal(overview.summary.total_net_worth, "56280.00");
});

test("hosted account lists and histories expose the seeded records", async () => {
  const active = await api("/api/accounts?as_of=2026-07-16");
  const all = await api("/api/accounts?as_of=2026-07-16&include_archived=true");
  const snapshots = await api("/api/accounts/1/balance-snapshots");

  assert.equal(active.accounts.length, 6);
  assert.equal(all.accounts.length, 7);
  assert.ok(snapshots.balance_snapshots.length >= 120);
  assert.equal(snapshots.balance_snapshots[0].effective_date, "2026-07-16");
});
