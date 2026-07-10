import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const project = resolve(new URL("..", import.meta.url).pathname);
const output = resolve(project, "dist");
const client = resolve(output, "client");
const spa = resolve(project, "src/finance_tracker/web/static/spa");
const server = resolve(output, "server/index.js");

const workerSource = String.raw`const transactions = [
  { id: 1, type: "income", amount: "4200.00", category: "Salary", description: "July salary", date: "2026-07-01", created_at: "2026-07-01T09:00:00" },
  { id: 2, type: "expense", amount: "1500.00", category: "Rent", description: "Apartment rent", date: "2026-07-02", created_at: "2026-07-02T09:00:00" },
  { id: 3, type: "expense", amount: "205.20", category: "Utilities", description: "Electric and internet", date: "2026-07-06", created_at: "2026-07-06T09:00:00" },
  { id: 4, type: "expense", amount: "428.75", category: "Food", description: "Groceries and summer market", date: "2026-07-09", created_at: "2026-07-09T09:00:00" },
  { id: 5, type: "income", amount: "450.00", category: "Freelance", description: "Landing page update", date: "2026-06-26", created_at: "2026-06-26T09:00:00" },
  { id: 6, type: "expense", amount: "486.40", category: "Food", description: "Groceries and farmers market", date: "2026-06-10", created_at: "2026-06-10T09:00:00" },
  { id: 7, type: "expense", amount: "185.00", category: "Travel", description: "Family visit fuel", date: "2026-06-24", created_at: "2026-06-24T09:00:00" },
  { id: 8, type: "income", amount: "4200.00", category: "Salary", description: "May salary", date: "2026-05-01", created_at: "2026-05-01T09:00:00" },
  { id: 9, type: "expense", amount: "1500.00", category: "Rent", description: "Apartment rent", date: "2026-05-02", created_at: "2026-05-02T09:00:00" },
  { id: 10, type: "expense", amount: "355.25", category: "Food", description: "Groceries and farmers market", date: "2026-05-09", created_at: "2026-05-09T09:00:00" },
  { id: 11, type: "income", amount: "4200.00", category: "Salary", description: "April salary", date: "2026-04-01", created_at: "2026-04-01T09:00:00" },
  { id: 12, type: "expense", amount: "1500.00", category: "Rent", description: "Apartment rent", date: "2026-04-02", created_at: "2026-04-02T09:00:00" },
];

const budgets = [
  { id: 1, category: "Rent", amount: "1600.00", month: 7, year: 2026, created_at: "2026-07-01T09:00:00" },
  { id: 2, category: "Food", amount: "480.00", month: 7, year: 2026, created_at: "2026-07-01T09:00:00" },
  { id: 3, category: "Utilities", amount: "225.00", month: 7, year: 2026, created_at: "2026-07-01T09:00:00" },
  { id: 4, category: "Travel", amount: "550.00", month: 7, year: 2026, created_at: "2026-07-01T09:00:00" },
];

const rules = [
  { id: 1, alias: "groceries", category: "Food", created_at: "2026-01-01T09:00:00" },
  { id: 2, alias: "metro", category: "Transport", created_at: "2026-01-01T09:00:00" },
];

const templates = [
  { id: 1, type: "expense", amount: "1600.00", category: "Rent", description: "Monthly rent", day_of_month: 2, active: true, created_at: "2026-01-01T09:00:00" },
  { id: 2, type: "income", amount: "4200.00", category: "Salary", description: "Monthly salary", day_of_month: 1, active: true, created_at: "2026-01-01T09:00:00" },
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
  if (path === "/api/transactions" && request.method === "GET") {
    const filtered = filterTransactions(url);
    return json({ transactions: filtered, page: page(filtered.length) });
  }
  if (path === "/api/budgets" && request.method === "GET") {
    return json({ budgets, page: page(budgets.length) });
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
    recent_transactions: monthTransactions.slice(-5).reverse(), budget_statuses: budgetStatuses(url), currency: "USD",
  };
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
