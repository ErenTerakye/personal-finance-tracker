import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { COLOR_SCHEME_STORAGE_KEY } from "./theme";

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  window.localStorage?.clear();
  document.documentElement.removeAttribute("data-theme");
  Reflect.deleteProperty(document, "startViewTransition");
  colorSchemeMeta().content = "light dark";
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Personal Finance Tracker", () => {
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

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose period/ })).toBeInTheDocument();
    expect(screen.getByText("Six-month cashflow trend")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("over budget")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /six-month income/i })).toBeInTheDocument();
  });

  it("exposes downloadable dashboard artifacts for the selected period", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Month report" })).toHaveAttribute(
      "href",
      "/api/reports/monthly.txt?month=7&year=2026"
    );
    expect(screen.getByRole("link", { name: "Month chart" })).toHaveAttribute(
      "href",
      "/api/charts/monthly.png?month=7&year=2026"
    );
    expect(screen.getByRole("link", { name: "Trend report" })).toHaveAttribute(
      "href",
      "/api/reports/trends.txt?months=6&end_month=7&end_year=2026"
    );
    expect(screen.getByRole("link", { name: "Trend chart" })).toHaveAttribute(
      "href",
      "/api/charts/trends.png?months=6&end_month=7&end_year=2026"
    );
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
    expect(document.title).toBe("Budgets | Personal Finance Tracker");
  });

  it("changes the dashboard period from the compact period control", async () => {
    const fetchMock = mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Next month,/ }));

    await waitFor(() => {
      const dashboardCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).startsWith("/api/dashboard")
      );
      expect(dashboardCalls.length).toBeGreaterThan(1);
    });
  });

  it("uses view transitions for route changes when motion is allowed", async () => {
    mockColorScheme("light");
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] }
    });
    const startViewTransition = vi.fn(({ update }: { update: () => void }) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Budgets" }));

    expect(startViewTransition).toHaveBeenCalledWith({
      update: expect.any(Function),
      types: ["forward"]
    });
    expect(window.location.pathname).toBe("/budgets");
  });

  it("skips view transitions when reduced motion is preferred", async () => {
    mockReducedMotion();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] }
    });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Budgets" }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/budgets");
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

  it("imports transaction CSV from a dialog and shows row results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/transactions/import-csv/preview" && init?.method === "POST") {
        return response({
          valid_count: 2,
          duplicate_count: 0,
          invalid_count: 1,
          rows: [
            {
              line_number: 2,
              status: "valid",
              transaction: {
                type: "income",
                amount: "1000.00",
                category: "Salary",
                description: "Paycheck",
                date: "2026-06-01"
              },
              original_category: "Salary",
              error: null
            },
            {
              line_number: 3,
              status: "invalid",
              transaction: null,
              original_category: null,
              error: "Amount must be greater than zero."
            }
          ]
        });
      }
      if (url.startsWith("/api/transactions/import-csv?") && init?.method === "POST") {
        return response({
          notice: "Transaction CSV import finished.",
          imported_count: 2,
          skipped_count: 1,
          errors: ["Line 3: Amount must be greater than zero."]
        });
      }
      if (url.startsWith("/api/transactions")) {
        return response({ transactions: [] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Transactions/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dialog = screen.getByRole("dialog", { name: "Import transaction CSV" });
    const file = new File(
      ["type,amount,category,description,date\nincome,1000,Salary,Paycheck,2026-06-01\n"],
      "transactions.csv",
      { type: "text/csv" }
    );

    await userEvent.upload(within(dialog).getByLabelText("CSV file"), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Preview CSV" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "2 valid, 0 duplicate, 1 invalid."
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Import CSV" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Imported 2, skipped 1."
    );
    expect(within(dialog).getByText("Line 3: Amount must be greater than zero.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/import-csv?allow_duplicates=false",
      expect.objectContaining({ body: expect.stringContaining("income,1000") })
    );
  });

  it("manages category rules and recurring templates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/category-rules" && init?.method === "POST") {
        return response({
          notice: "Category rule saved.",
          rule: { id: 1, alias: "groceries", category: "Food", created_at: null }
        });
      }
      if (url === "/api/recurring-templates" && init?.method === "POST") {
        return response({
          notice: "Recurring template saved.",
          template: {
            id: 1,
            type: "expense",
            amount: "1200.00",
            category: "Rent",
            description: "",
            day_of_month: 1,
            active: true,
            created_at: null
          }
        });
      }
      if (url.startsWith("/api/category-rules")) {
        return response({ rules: [] });
      }
      if (url.startsWith("/api/recurring-templates")) {
        return response({ templates: [] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));
    await userEvent.type(await screen.findByLabelText("Alias"), "groceries");
    await userEvent.type(document.querySelector("#rule-category") as HTMLInputElement, "Food");
    await userEvent.click(screen.getByRole("button", { name: "Save rule" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Category rule saved.");
  });

  it("imports budget CSV from a dialog and shows row results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/budgets/import-csv" && init?.method === "POST") {
        return response({
          notice: "Budget CSV import finished.",
          imported_count: 1,
          skipped_count: 0,
          errors: []
        });
      }
      if (url.startsWith("/api/budgets/status")) {
        return response({ statuses: [] });
      }
      if (url.startsWith("/api/budgets")) {
        return response({ budgets: [] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Budgets/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Import CSV" }));
    const dialog = screen.getByRole("dialog", { name: "Import budget CSV" });
    const file = new File(["category,amount,month,year\nFood,400,6,2026\n"], "budgets.csv", {
      type: "text/csv"
    });

    await userEvent.upload(within(dialog).getByLabelText("CSV file"), file);
    await userEvent.click(within(dialog).getByRole("button", { name: "Import CSV" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Imported 1, skipped 0."
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/import-csv",
      expect.objectContaining({ body: expect.stringContaining("Food,400") })
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
    await userEvent.click(screen.getByRole("button", { name: "Delete Food transaction" }));
    const dialog = screen.getByRole("dialog", { name: "Delete transaction" });

    expect(dialog).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  });

  it("defaults to system color mode with no stored preference", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Use dark mode" })).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });

  it("pins the opposite system mode and restores system mode", async () => {
    mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Use dark mode" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
    });

    await userEvent.click(screen.getByRole("button", { name: "Use system color setting" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement).not.toHaveAttribute("data-theme");
      expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
    });
  });

  it("applies a stored manual mode on render", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "dark");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Use system color setting" })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(colorSchemeMeta()).toHaveAttribute("content", "dark");
  });

  it("updates the system-mode action when the OS color mode changes", async () => {
    const colorScheme = mockColorScheme("light");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Use dark mode" })).toBeInTheDocument();
    colorScheme.set("dark");

    expect(await screen.findByRole("button", { name: "Use light mode" })).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    await userEvent.click(screen.getByRole("button", { name: "Use light mode" }));
    colorScheme.set("light");

    expect(await screen.findByRole("button", { name: "Use system color setting" })).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("falls back to system mode when stored theme data is invalid or unavailable", async () => {
    mockColorScheme("light");
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    const { unmount } = render(<App />);

    expect(await screen.findByRole("button", { name: "Use dark mode" })).toBeInTheDocument();
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
    unmount();

    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    expect(await screen.findByRole("button", { name: "Use dark mode" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(colorSchemeMeta()).toHaveAttribute("content", "light dark");
  });

  it("renders rules info cards, presets, and playground correctly", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/category-rules")) {
        return response({ rules: [{ id: 1, alias: "uber", category: "Transport", created_at: null }] });
      }
      if (url.startsWith("/api/recurring-templates")) {
        return response({ templates: [] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));

    // Verifies info cards
    expect(screen.getByText("Category Aliases")).toBeInTheDocument();
    expect(screen.getByText("Recurring Templates")).toBeInTheDocument();

    // Verifies template presets show by default (since templates is empty)
    expect(screen.getByText(/Quick-add standard templates:/i)).toBeInTheDocument();

    // Verifies alias presets do not show by default (since rules is not empty), but toggle button shows
    expect(screen.queryByText(/Quick-add popular aliases:/i)).not.toBeInTheDocument();
    const toggleButton = screen.getByRole("button", { name: /Show Quick-Add Presets/i });
    await userEvent.click(toggleButton);
    expect(screen.getByText(/Quick-add popular aliases:/i)).toBeInTheDocument();

    // Verifies playground sandbox behaves correctly
    const sandboxInput = screen.getByPlaceholderText(/Type a CSV category/i);
    expect(sandboxInput).toBeInTheDocument();

    // Typing mismatch
    await userEvent.type(sandboxInput, "lyft");
    expect(await screen.findByText(/No active alias matches/i)).toBeInTheDocument();

    // Typing match
    await userEvent.clear(sandboxInput);
    await userEvent.type(sandboxInput, "uber");
    expect(await screen.findByText(/Maps/i)).toBeInTheDocument();
  });

  it("supports language toggling between English and Turkish", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    // Verify it renders in English by default
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose period/i })).toBeInTheDocument();

    // Find and click language toggle button
    const langToggle = screen.getByRole("button", { name: /Switch language|Dili değiştir/i });
    expect(langToggle).toHaveTextContent("TR");
    await userEvent.click(langToggle);

    // Verify page titles and other elements are now in Turkish
    expect(await screen.findByRole("heading", { name: "Kontrol Paneli" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dönem seçin/i })).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("EN");

    // Click it again to switch back to English
    await userEvent.click(langToggle);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("TR");
  });

  it("translates preset categories and descriptions dynamically on Rules view", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [] },
      "/api/recurring-templates": { templates: [] },
      "/api/settings": { currency: "USD" }
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));

    // Verify it renders in English initially
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("uber → Transport")).toBeInTheDocument();

    // Toggle language to Turkish
    const langToggle = screen.getByRole("button", { name: /Switch language|Dili değiştir/i });
    await userEvent.click(langToggle);

    // Verify it renders in Turkish
    expect(screen.getByText("Kira")).toBeInTheDocument();
    expect(screen.getByText("uber → Ulaşım")).toBeInTheDocument();

    // Switch back to English
    await userEvent.click(langToggle);
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("uber → Transport")).toBeInTheDocument();
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

function colorSchemeMeta() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.append(meta);
  }
  return meta;
}

function installLocalStorage() {
  const items = new Map<string, string>();
  const storage = {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    }
  } as Storage;

  vi.stubGlobal("localStorage", storage);
}

function mockColorScheme(initialScheme: "light" | "dark") {
  let matches = initialScheme === "dark";
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn((_event: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: "change", listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return {
    set(nextScheme: "light" | "dark") {
      matches = nextScheme === "dark";
      const event = { matches, media: mediaQueryList.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

function mockReducedMotion() {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    media: query,
    matches: query === "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }) as unknown as MediaQueryList));
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
      expenses_by_category: { Food: "386.40" },
      ytd_income: "15000.00",
      ytd_expenses: "3000.00",
      ytd_net_savings: "12000.00",
      income_delta: "100.00",
      expenses_delta: "-25.00",
      net_savings_delta: "125.00"
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
    savings_rate: "80.0",
    income_delta: "0.00",
    expenses_delta: "0.00",
    net_savings_delta: "0.00"
  };
}
