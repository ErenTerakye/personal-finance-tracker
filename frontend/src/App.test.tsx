import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.pushState({}, "", "/");
});

describe("Ledger Workbench", () => {
  it("renders dashboard totals and over-budget pressure", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: [
          {
            budget: budget(),
            actual_expenses: "185.00",
            remaining: "-35.00",
            percent_used: "123.3",
            status: "over budget"
          }
        ]
      })
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "June 2026" })).toBeInTheDocument();
    expect(screen.getByText("Six-month cashflow strip")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("over budget")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /six-month income/i })).toBeInTheDocument();
  });

  it("navigates with browser routes", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] }
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Budgets/i }));

    expect(window.location.pathname).toBe("/budgets");
    expect(await screen.findByRole("heading", { name: "Budgets" })).toBeInTheDocument();
    expect(document.title).toBe("Budgets | Ledger Workbench");
  });

  it("creates a transaction from a dialog and announces success", async () => {
    const fetchMock = mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] }
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/transactions" && init?.method === "POST") {
        return response({
          notice: "Transaction added to the local ledger.",
          transaction: transaction()
        });
      }
      if (url.startsWith("/api/transactions")) {
        return response({ transactions: [] });
      }
      return response(dashboardPayload({}));
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Transactions/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Add entry" }));
    const dialog = screen.getByRole("dialog", { name: "Add transaction" });
    await userEvent.type(within(dialog).getByLabelText("Amount"), "45.90");
    await userEvent.type(within(dialog).getByLabelText("Category"), "Food");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add entry" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Transaction added to the local ledger."
    );
  });

  it("opens and cancels delete confirmation", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] }
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Transactions/i }));
    await screen.findByText("Groceries");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete transaction" });

    expect(dialog).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  });
});

function mockFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((route) => url.startsWith(route));
    return response(key ? routes[key] : {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
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

function dashboardPayload(overrides: Record<string, unknown>) {
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
      expenses_by_category: { Food: "386.40" }
    },
    trend: {
      months: [
        trendMonth("2026-01"),
        trendMonth("2026-02"),
        trendMonth("2026-03"),
        trendMonth("2026-04"),
        trendMonth("2026-05"),
        trendMonth("2026-06")
      ],
      total_income: "15000.00",
      total_expenses: "3000.00",
      net_savings: "12000.00",
      transaction_count: 12,
      top_expense_categories: { Food: "386.40" }
    },
    savings_rate: "84.5",
    recent_transactions: [transaction()],
    budget_statuses: [],
    ...overrides
  };
}

function trendMonth(label: string) {
  const [year, month] = label.split("-").map(Number);
  return {
    month,
    year,
    label,
    total_income: "2500.00",
    total_expenses: "500.00",
    net_savings: "2000.00",
    transaction_count: 2,
    savings_rate: "80.0"
  };
}
