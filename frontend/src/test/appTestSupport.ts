import { afterEach, beforeEach, vi } from "vitest";

export function installAppTestLifecycle() {
  beforeEach(() => {
    installLocalStorage();
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    window.history.replaceState({}, "", "/");
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
}

export function mockFetch(routes: Record<string, unknown>) {
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

export function response(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

export function colorSchemeMeta() {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.append(meta);
  }
  return meta;
}

export function installLocalStorage() {
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
    },
  } as Storage;

  vi.stubGlobal("localStorage", storage);
}

export function mockColorScheme(initialScheme: "light" | "dark") {
  let matches = initialScheme === "dark";
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: vi.fn(
      (_event: "change", listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (_event: "change", listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      if (query === mediaQueryList.media) return mediaQueryList;
      return {
        media: query,
        matches: false,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList;
    }),
  );

  return {
    set(nextScheme: "light" | "dark") {
      matches = nextScheme === "dark";
      const event = {
        matches,
        media: mediaQueryList.media,
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

export function mockReducedMotion() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(
      (query: string) =>
        ({
          media: query,
          matches: query === "(prefers-reduced-motion: reduce)",
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );
}

export function mockCompactLayout() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(
      (query: string) =>
        ({
          media: query,
          matches: query === "(max-width: 63.999rem)",
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );
}

export function transaction() {
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

export function activity() {
  return {
    id: 1,
    kind: "expense",
    amount: "45.90",
    category: "Food",
    description: "Groceries",
    date: "2026-06-12",
    account: {
      id: 1,
      name: "Everyday checking",
      type: "asset",
      subtype: "cash",
      role: "account",
      before_balance: "1000.00",
      after_balance: "954.10",
      balance_effect: "-45.90",
      balance_state: "normal",
    },
    from_account: null,
    to_account: null,
    net_worth_effect: "-45.90",
    cashflow_effect: "-45.90",
    created_at: "2026-06-12T12:00:00",
    updated_at: "2026-06-12T12:00:00",
  };
}

export function budget() {
  return {
    id: 1,
    category: "Travel",
    amount: "150.00",
    month: 6,
    year: 2026,
    created_at: "2026-06-12T12:00:00",
  };
}

export function dashboardPayload(overrides: Record<string, unknown>) {
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
      net_savings_delta: "125.00",
    },
    trend: {
      months: [
        trendMonth("2026-01"),
        trendMonth("2026-02"),
        trendMonth("2026-03"),
        trendMonth("2026-04"),
        trendMonth("2026-05"),
        trendMonth("2026-06"),
      ],
      total_income: "15000.00",
      total_expenses: "3000.00",
      net_savings: "12000.00",
      transaction_count: 12,
      top_expense_categories: { Food: "386.40" },
    },
    savings_rate: "84.5",
    recent_activities: [activity()],
    budget_statuses: [],
    net_worth: {
      as_of: "2026-07-16",
      total_assets: "0.00",
      total_liabilities: "0.00",
      total_net_worth: "0.00",
      active_account_count: 0,
      archived_account_count: 0,
      resolved_asset_count: 0,
      resolved_liability_count: 0,
      account_state_warning_count: 0,
      currency: "USD",
    },
    ...overrides,
  };
}

export function trendMonth(label: string) {
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
    net_savings_delta: "0.00",
  };
}
