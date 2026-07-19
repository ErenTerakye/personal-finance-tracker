import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const project = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(project, "dist");
const client = resolve(output, "client");
const spa = resolve(project, "src/finance_tracker/web/static/spa");
const server = resolve(output, "server/index.js");

const explicitPython = process.env.FINANCE_TRACKER_PYTHON;
const pythonCandidates = explicitPython
  ? [explicitPython]
  : [".venv/bin/python", ".venv/Scripts/python.exe", "python3"];
const python = pythonCandidates.find(
  (candidate) =>
    candidate === "python3" || existsSync(resolve(project, candidate)),
);
if (!python) {
  throw new Error(
    "Sites demo export needs Python 3.14+; create .venv or set FINANCE_TRACKER_PYTHON.",
  );
}
const accountDemo = JSON.parse(
  execFileSync(python, ["-m", "scripts.export_sites_demo"], {
    cwd: project,
    encoding: "utf8",
  }),
);

const transactionCsv = await readFile(
  resolve(project, "examples/sample_transactions.csv"),
  "utf8",
);
const normalizedCategories = new Map([
  ["groceries", "Food"],
  ["supermarket", "Food"],
  ["metro", "Transport"],
  ["rideshare", "Transport"],
  ["streaming", "Subscriptions"],
]);
const csvTransactions = transactionCsv
  .trim()
  .split("\n")
  .slice(1)
  .map((line, index) => {
    const [type, amount, sourceCategory, description, date] = line.split(",");
    return {
      id: index + 1,
      type,
      amount,
      category: normalizedCategories.get(sourceCategory) ?? sourceCategory,
      description,
      date,
      created_at: `${date}T09:00:00`,
    };
  });
const recurringTransactions = [
  ["income", "4200.00", "Salary", "Monthly salary deposit", "2026-07-01"],
  ["expense", "1500.00", "Rent", "Apartment rent", "2026-07-02"],
  [
    "expense",
    "44.99",
    "Subscriptions",
    "Streaming and cloud storage",
    "2026-07-20",
  ],
  ["expense", "35.00", "Fitness", "Community gym membership", "2026-07-24"],
].map(([type, amount, category, description, date], index) => ({
  id: csvTransactions.length + index + 1,
  type,
  amount,
  category,
  description,
  date,
  created_at: `${date}T09:00:00`,
}));
const hostedTransactions = [...csvTransactions, ...recurringTransactions].sort(
  (left, right) => right.date.localeCompare(left.date) || right.id - left.id,
);
const budgetCsv = await readFile(
  resolve(project, "examples/sample_budgets.csv"),
  "utf8",
);
const hostedBudgets = budgetCsv
  .trim()
  .split("\n")
  .slice(1)
  .map((line, index) => {
    const [category, amount, month, year] = line.split(",");
    return {
      id: index + 1,
      category,
      amount,
      month: Number(month),
      year: Number(year),
      created_at: `${year}-${month.padStart(2, "0")}-01T09:00:00`,
    };
  });

const workerSource = String.raw`const transactions = ${JSON.stringify(hostedTransactions)};

const budgets = ${JSON.stringify(hostedBudgets)};

const accounts = ${JSON.stringify(accountDemo.accounts)};

const DEMO_AS_OF = "2026-07-16";

const rules = [
  { id: 1, alias: "groceries", category: "Food", created_at: "2026-01-01T09:00:00" },
  { id: 2, alias: "supermarket", category: "Food", created_at: "2026-01-01T09:00:00" },
  { id: 3, alias: "metro", category: "Transport", created_at: "2026-01-01T09:00:00" },
  { id: 4, alias: "rideshare", category: "Transport", created_at: "2026-01-01T09:00:00" },
  { id: 5, alias: "streaming", category: "Subscriptions", created_at: "2026-01-01T09:00:00" },
];

const templates = [
  { id: 1, type: "income", amount: "4200.00", category: "Salary", description: "Monthly salary deposit", day_of_month: 1, active: true, created_at: "2026-01-01T09:00:00" },
  { id: 2, type: "expense", amount: "1500.00", category: "Rent", description: "Apartment rent", day_of_month: 2, active: true, created_at: "2026-01-01T09:00:00" },
  { id: 3, type: "expense", amount: "44.99", category: "Subscriptions", description: "Streaming and cloud storage", day_of_month: 20, active: true, created_at: "2026-01-01T09:00:00" },
  { id: 4, type: "expense", amount: "35.00", category: "Fitness", description: "Community gym membership", day_of_month: 24, active: true, created_at: "2026-01-01T09:00:00" },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return apiResponse(request, url);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404 || request.method !== "GET") return asset;
    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  },
};

function apiResponse(request, url) {
  const path = url.pathname;
  if (path === "/api/settings") return json({ currency: "USD" });
  if (path === "/api/dashboard") return json(dashboard(url));
  if (path === "/api/accounts" && request.method === "GET") {
    return json({ accounts: accountRecords(url) });
  }
  const snapshotMatch = path.match(/^\/api\/accounts\/(\d+)\/balance-snapshots$/);
  if (snapshotMatch && request.method === "GET") {
    const account = accounts.find((item) => item.id === Number(snapshotMatch[1]));
    return account
      ? json({ balance_snapshots: [...account.snapshots].reverse().map(snapshotResponse) })
      : json({ error: "Hosted demo account not found." }, 404);
  }
  if (path === "/api/net-worth/overview") return json(netWorthOverview(url));
  if (path === "/api/net-worth/history") return json(netWorthHistory(url));
  if (path === "/api/net-worth") return json(netWorthSummary(url.searchParams.get("as_of") || DEMO_AS_OF));
  if (path === "/api/transactions" && request.method === "GET") {
    const filtered = filterTransactions(url);
    return json({ transactions: filtered, page: page(filtered.length) });
  }
  if (path === "/api/budgets" && request.method === "GET") {
    const filtered = filterBudgets(url);
    return json({ budgets: filtered, page: page(filtered.length) });
  }
  if (path === "/api/budgets/status") return json({ statuses: budgetStatuses(url) });
  if (path === "/api/category-rules") return json({ rules });
  if (path === "/api/recurring-templates") return json({ templates });
  if (path.endsWith("/export-csv")) return new Response("Hosted demo export\\n", { headers: { "Content-Type": "text/csv" } });
  if (path.includes("/reports/")) return new Response("Personal Finance Tracker hosted demo report\\n", { headers: { "Content-Type": "text/plain" } });
  if (path.includes("/charts/")) return new Response(TRANSPARENT_PNG, { headers: { "Content-Type": "image/png" } });
  if (request.method === "POST" || request.method === "PATCH" || request.method === "PUT" || request.method === "DELETE") {
    return json({ notice: "Hosted demo changes are for this session only.", notice_code: "demo" });
  }
  return json({ error: "Hosted demo endpoint not found." }, 404);
}

function dashboard(url) {
  const month = Number(url.searchParams.get("month")) || 7;
  const year = Number(url.searchParams.get("year")) || 2026;
  const monthTransactions = transactions.filter((item) => monthKey(item.date) === key(month, year));
  const report = reportFor(monthTransactions, month, year);
  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const offset = index - 5;
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    const trendTransactions = transactions.filter((item) => monthKey(item.date) === key(date.getUTCMonth() + 1, date.getUTCFullYear()));
    return trendFor(trendTransactions, date.getUTCMonth() + 1, date.getUTCFullYear());
  });
  const income = Number(report.total_income);
  return {
    month, year, period_label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    report, trend: { months: trendMonths, total_income: sum(trendMonths, "total_income"), total_expenses: sum(trendMonths, "total_expenses"), net_savings: sum(trendMonths, "net_savings"), transaction_count: trendMonths.reduce((total, item) => total + item.transaction_count, 0), top_expense_categories: report.expenses_by_category },
    savings_rate: income ? fixed((Number(report.net_savings) / income) * 100) : "0.00",
    recent_transactions: monthTransactions.slice(0, 5), budget_statuses: budgetStatuses(url), net_worth: netWorthSummary(DEMO_AS_OF), currency: "USD",
  };
}

function accountRecords(url) {
  const asOf = url.searchParams.get("as_of") || DEMO_AS_OF;
  const includeArchived = url.searchParams.get("include_archived") === "true";
  return accounts.filter((account) => includeArchived || !account.archived_on).map((account) => {
    const snapshot = latestSnapshot(account, asOf);
    return {
      id: account.id, name: account.name, type: account.type, archived_on: account.archived_on,
      created_at: account.created_at, as_of: asOf,
      resolved_balance: snapshot?.amount ?? null,
      resolved_balance_date: snapshot?.effective_date ?? null,
      currency: "USD",
    };
  });
}

function snapshotResponse(snapshot) {
  return { ...snapshot, currency: "USD" };
}

function latestSnapshot(account, asOf) {
  let latest = null;
  for (const snapshot of account.snapshots) {
    if (snapshot.effective_date <= asOf && (!latest || snapshot.effective_date >= latest.effective_date)) latest = snapshot;
  }
  return latest;
}

function netWorthSummary(asOf) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let resolvedAssetCount = 0;
  let resolvedLiabilityCount = 0;
  let unresolvedAccountCount = 0;
  for (const account of accounts) {
    const snapshot = latestSnapshot(account, asOf);
    if (!snapshot) {
      unresolvedAccountCount += 1;
    } else if (account.type === "asset") {
      totalAssets += Number(snapshot.amount);
      resolvedAssetCount += 1;
    } else {
      totalLiabilities += Number(snapshot.amount);
      resolvedLiabilityCount += 1;
    }
  }
  return {
    as_of: asOf, total_assets: fixed(totalAssets), total_liabilities: fixed(totalLiabilities),
    total_net_worth: fixed(totalAssets - totalLiabilities),
    active_account_count: accounts.filter((account) => !account.archived_on).length,
    archived_account_count: accounts.filter((account) => account.archived_on).length,
    resolved_asset_count: resolvedAssetCount, resolved_liability_count: resolvedLiabilityCount,
    unresolved_account_count: unresolvedAccountCount, currency: "USD",
  };
}

function netWorthHistory(url) {
  const asOf = url.searchParams.get("as_of") || DEMO_AS_OF;
  const months = Math.min(120, Math.max(1, Number(url.searchParams.get("months")) || 12));
  const points = Array.from({ length: months }, (_, index) => netWorthSummary(historyDate(asOf, months - index - 1)));
  const previous = points.at(-2);
  const current = points.at(-1);
  const change = previous ? Number(current.total_net_worth) - Number(previous.total_net_worth) : null;
  return {
    as_of: asOf, months, points,
    change_amount: change === null ? null : fixed(change),
    change_percent: change === null || Number(previous.total_net_worth) === 0 ? null : (change / Math.abs(Number(previous.total_net_worth)) * 100).toFixed(1),
    currency: "USD",
  };
}

function netWorthOverview(url) {
  const history = netWorthHistory(url);
  const asOf = history.as_of;
  const startDate = history.points[0].as_of;
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const visibleAccounts = accounts.filter((account) => includeArchived || !account.archived_on);
  const analytics = visibleAccounts.map((account) => {
    const start = latestSnapshot(account, startDate);
    const end = latestSnapshot(account, asOf);
    const typeTotal = Number(account.type === "asset" ? history.points.at(-1).total_assets : history.points.at(-1).total_liabilities);
    const contribution = start && end ? (Number(end.amount) - Number(start.amount)) * (account.type === "asset" ? 1 : -1) : null;
    return {
      account_id: account.id, name: account.name, type: account.type, archived_on: account.archived_on,
      current_balance: end?.amount ?? null, current_balance_date: end?.effective_date ?? null,
      comparison_balance: start?.amount ?? null, comparison_balance_date: start?.effective_date ?? null,
      contribution_change: contribution === null ? null : fixed(contribution),
      composition_percent: end && typeTotal !== 0 ? (Number(end.amount) / typeTotal * 100).toFixed(1) : null,
      currency: "USD",
    };
  }).sort((left, right) => {
    if (left.contribution_change === null) return right.contribution_change === null ? left.name.localeCompare(right.name) : 1;
    if (right.contribution_change === null) return -1;
    return Math.abs(Number(right.contribution_change)) - Math.abs(Number(left.contribution_change)) || left.type.localeCompare(right.type) || left.name.localeCompare(right.name);
  });
  const comparisonAvailable = visibleAccounts.length > 0 && visibleAccounts.every((account) => latestSnapshot(account, startDate) && latestSnapshot(account, asOf));
  const startValue = Number(history.points[0].total_net_worth);
  const endValue = Number(history.points.at(-1).total_net_worth);
  const change = comparisonAvailable ? endValue - startValue : null;
  const resolvedDates = analytics.map((account) => account.current_balance_date).filter(Boolean).sort();
  return {
    summary: history.points.at(-1), history,
    comparison: {
      start_date: startDate, end_date: asOf, available: comparisonAvailable,
      start_value: comparisonAvailable ? fixed(startValue) : null,
      end_value: comparisonAvailable ? fixed(endValue) : null,
      change_amount: change === null ? null : fixed(change),
      change_percent: change === null || startValue === 0 ? null : (change / Math.abs(startValue) * 100).toFixed(1),
    },
    accounts: analytics,
    coverage: {
      resolved_account_count: history.points.at(-1).resolved_asset_count + history.points.at(-1).resolved_liability_count,
      unresolved_account_count: history.points.at(-1).unresolved_account_count,
      oldest_balance_date: resolvedDates[0] ?? null,
    },
    currency: "USD",
  };
}

function historyDate(asOf, monthsBefore) {
  if (monthsBefore === 0) return asOf;
  const current = new Date(asOf + "T00:00:00Z");
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - monthsBefore + 1, 0)).toISOString().slice(0, 10);
}

function reportFor(items, month, year) {
  const total_income = items.filter((item) => item.type === "income").reduce((total, item) => total + Number(item.amount), 0);
  const total_expenses = items.filter((item) => item.type === "expense").reduce((total, item) => total + Number(item.amount), 0);
  return { month, year, total_income: fixed(total_income), total_expenses: fixed(total_expenses), net_savings: fixed(total_income - total_expenses), transaction_count: items.length, income_by_category: grouped(items, "income"), expenses_by_category: grouped(items, "expense"), ytd_income: fixed(total_income), ytd_expenses: fixed(total_expenses), ytd_net_savings: fixed(total_income - total_expenses), income_delta: "0.00", expenses_delta: "0.00", net_savings_delta: "0.00" };
}

function trendFor(items, month, year) {
  const report = reportFor(items, month, year);
  return { month, year, label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }), total_income: report.total_income, total_expenses: report.total_expenses, net_savings: report.net_savings, transaction_count: report.transaction_count, savings_rate: Number(report.total_income) ? fixed((Number(report.net_savings) / Number(report.total_income)) * 100) : "0.00", income_delta: "0.00", expenses_delta: "0.00", net_savings_delta: "0.00" };
}

function budgetStatuses(url) {
  const month = Number(url.searchParams.get("month")) || 7;
  const year = Number(url.searchParams.get("year")) || 2026;
  return budgets.filter((item) => item.month === month && item.year === year).map((budget) => {
    const actual = transactions.filter((item) => item.type === "expense" && item.category === budget.category && monthKey(item.date) === key(month, year)).reduce((total, item) => total + Number(item.amount), 0);
    const percent = (actual / Number(budget.amount)) * 100;
    return { budget, actual_expenses: fixed(actual), remaining: fixed(Number(budget.amount) - actual), percent_used: fixed(percent), status: percent > 100 ? "over budget" : percent >= 80 ? "near limit" : "on track" };
  });
}

function filterTransactions(url) {
  return transactions.filter((item) => (!url.searchParams.get("month") || Number(item.date.slice(5, 7)) === Number(url.searchParams.get("month"))) && (!url.searchParams.get("year") || Number(item.date.slice(0, 4)) === Number(url.searchParams.get("year"))) && (!url.searchParams.get("category") || item.category === url.searchParams.get("category")) && (!url.searchParams.get("transaction_type") || item.type === url.searchParams.get("transaction_type")));
}

function filterBudgets(url) {
  return budgets.filter((item) => (!url.searchParams.get("month") || item.month === Number(url.searchParams.get("month"))) && (!url.searchParams.get("year") || item.year === Number(url.searchParams.get("year"))));
}

function grouped(items, type) {
  return items.filter((item) => item.type === type).reduce((result, item) => { result[item.category] = fixed(Number(result[item.category] || 0) + Number(item.amount)); return result; }, {});
}

function monthKey(date) { return date.slice(0, 7); }
function key(month, year) { return year + "-" + String(month).padStart(2, "0"); }
function fixed(value) { return Number(value).toFixed(2); }
function sum(items, field) { return fixed(items.reduce((total, item) => total + Number(item[field]), 0)); }
function page(total) { return { limit: 100, offset: 0, total }; }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }

const TRANSPARENT_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
`;

execFileSync("npm", ["run", "build"], { cwd: project, stdio: "inherit" });

await rm(output, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(dirname(server), { recursive: true });
await cp(spa, client, { recursive: true });
await writeFile(server, workerSource, "utf8");

console.log(`Sites build ready at ${output}`);
