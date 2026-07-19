import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  mockCompactLayout,
  mockFetch,
  response,
  transaction,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("transactions workflow", () => {
  it("uses friendly localized copy for a ledger without transactions", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );

    const emptyState = (
      await screen.findByText("No transactions yet")
    ).closest<HTMLElement>(".empty-state")!;
    expect(emptyState).toHaveTextContent(
      "Add your first entry for this period to start building your history.",
    );
    expect(
      within(emptyState).getByRole("button", { name: "Add transaction" }),
    ).toBeVisible();
    expect(emptyState).not.toHaveTextContent("TRANSACTIONS.EMPTY.EYEBROW");

    await userEvent.click(
      screen.getByRole("button", { name: "Switch to Turkish" }),
    );
    expect(await screen.findByText("Henüz işlem yok")).toBeVisible();
    expect(
      screen.getByText(
        "Bu dönem için ilk işleminizi ekleyerek geçmişinizi oluşturmaya başlayın.",
      ),
    ).toBeVisible();
  });

  it("distinguishes a search miss and clears the query to restore records", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    const search = await screen.findByRole("searchbox");
    await userEvent.type(search, "does not exist");

    const emptyState = (
      await screen.findByText("No matching transactions")
    ).closest<HTMLElement>(".empty-state")!;
    expect(emptyState).toHaveTextContent(
      "Try a different search or clear your filters.",
    );
    expect(
      within(emptyState).queryByRole("button", { name: "Add transaction" }),
    ).toBeNull();
    await userEvent.click(
      within(emptyState).getByRole("button", {
        name: "Clear search and filters",
      }),
    );

    expect(search).toHaveValue("");
    expect(await within(activeRoute()).findByText("Groceries")).toBeVisible();
  });

  it("retries a failed transaction resource load", async () => {
    let transactionAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/transactions")) {
        transactionAttempts += 1;
        if (transactionAttempts === 1) throw new TypeError("Load failed");
        return response({ transactions: [] });
      }
      if (url.startsWith("/api/dashboard")) {
        return response(dashboardPayload({}));
      }
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Load failed");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No transactions yet")).toBeVisible();
    expect(transactionAttempts).toBe(2);
  });

  it("opens the shared transaction form from the global create command", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    act(() =>
      window.dispatchEvent(new Event("finance-tracker:add-transaction")),
    );

    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toHaveAttribute("open");
  });

  it("searches the loaded ledger immediately and discloses advanced filters", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": {
        transactions: [
          transaction(),
          {
            ...transaction(),
            id: 2,
            category: "Salary",
            description: "July pay",
          },
        ],
      },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    const search = await screen.findByRole("searchbox");
    await userEvent.type(search, "salary");

    await waitFor(() => {
      expect(within(activeRoute()).getByText("Salary")).toBeInTheDocument();
      expect(within(activeRoute()).queryByText("Groceries")).toBeNull();
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Advanced filters" }),
    );
    expect(screen.getByLabelText("Transaction filter period")).toBeVisible();
    await userEvent.type(
      within(
        document.querySelector<HTMLElement>(".transaction-filter-panel")!,
      ).getByLabelText("Category"),
      "Food",
    );
    expect(
      await screen.findByRole("button", { name: "Reset filters" }),
    ).toBeVisible();
  });

  it("summarizes cash movement and groups the timeline by day", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": {
        transactions: [
          transaction(),
          {
            ...transaction(),
            id: 2,
            type: "income",
            amount: "125.00",
            category: "Freelance",
            description: "Invoice payment",
            date: "2026-06-01",
          },
        ],
      },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );

    const snapshot = await screen.findByRole("region", {
      name: "Transaction summary",
    });
    expect(snapshot).toHaveTextContent("Money in$125.00");
    expect(snapshot).toHaveTextContent("Money out$45.90");
    expect(snapshot).toHaveTextContent("Net activity+$79.10");
    expect(screen.getByText("Friday, June 12")).toBeVisible();
    expect(screen.getByText("Monday, June 1")).toBeVisible();

    await userEvent.selectOptions(
      screen.getByLabelText("Sort transactions"),
      "oldest",
    );
    expect(document.querySelector(".ledger-day time")).toHaveTextContent(
      "Monday, June 1",
    );
  });

  it("creates a transaction from a dialog and announces success", async () => {
    mockCompactLayout();
    const fetchMock = mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/transactions" && init?.method === "POST") {
          return response({
            notice: "Transaction added to the local ledger.",
            transaction: transaction(),
          });
        }
        if (url.startsWith("/api/transactions")) {
          return response({ transactions: [] });
        }
        return response(dashboardPayload({}));
      },
    );

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    await userEvent.click(
      within(
        document.querySelector<HTMLElement>(".compact-app-bar")!,
      ).getByRole("button", { name: "Add transaction" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add transaction" });
    await userEvent.type(within(dialog).getByLabelText("Amount"), "45.90");
    await userEvent.type(within(dialog).getByLabelText("Category"), "Food");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add expense" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Transaction added to the local ledger.",
      ),
    );
  });

  it("makes transaction direction explicit and adapts the primary action", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add transaction" })[0],
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Add transaction",
    });
    expect(within(dialog).getByText("What are you recording?")).toBeVisible();
    expect(within(dialog).getByLabelText("Expense")).toBeChecked();
    expect(within(dialog).queryByText("Private by design")).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Add expense" }),
    ).toBeVisible();
    const amount = within(dialog).getByLabelText("Amount");
    await userEvent.type(amount, "0.00");
    expect(amount).toBeInvalid();
    await userEvent.clear(amount);
    await userEvent.type(amount, "12a.345");
    expect(amount).toHaveValue("12.34");
    expect(amount).toBeValid();
    await userEvent.clear(amount);
    await userEvent.type(amount, "1,5");
    expect(amount).toHaveValue("1.5");

    await userEvent.click(within(dialog).getByLabelText("Income"));

    expect(within(dialog).getByLabelText("Income")).toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Add income" }),
    ).toBeVisible();
    expect(dialog).toHaveClass("entry-dialog-income");
  });

  it("imports transaction CSV from a dialog and shows row results", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url === "/api/transactions/import-csv/preview" &&
          init?.method === "POST"
        ) {
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
                  date: "2026-06-01",
                },
                original_category: "Salary",
                error: null,
              },
              {
                line_number: 3,
                status: "invalid",
                transaction: null,
                original_category: null,
                error: "Amount must be greater than zero.",
              },
            ],
          });
        }
        if (
          url.startsWith("/api/transactions/import-csv?") &&
          init?.method === "POST"
        ) {
          return response({
            notice: "Transaction CSV import finished.",
            imported_count: 2,
            skipped_count: 1,
            errors: ["Line 3: Amount must be greater than zero."],
          });
        }
        if (url.startsWith("/api/transactions")) {
          return response({ transactions: [] });
        }
        return response(dashboardPayload({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Import CSV" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Import transaction CSV",
    });
    const file = new File(
      [
        "type,amount,category,description,date\nincome,1000,Salary,Paycheck,2026-06-01\n",
      ],
      "transactions.csv",
      { type: "text/csv" },
    );

    await userEvent.upload(within(dialog).getByLabelText("CSV file"), file);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Preview CSV" }),
    );

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "2 valid, 0 duplicate, 1 invalid.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Import CSV" }),
    );

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Imported 2, skipped 1.",
    );
    expect(
      within(dialog).getByText("Line 3: Amount must be greater than zero."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/import-csv?allow_duplicates=false",
      expect.objectContaining({ body: expect.stringContaining("income,1000") }),
    );
  });

  it("opens and cancels delete confirmation", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [transaction()] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    await within(activeRoute()).findByText("Groceries");
    expect(
      within(activeRoute()).queryByRole("button", {
        name: /Edit .+ transaction/,
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    const popover = document.getElementById("row-actions-1");
    if (popover && typeof (popover as any).showPopover === "function") {
      (popover as any).showPopover();
    } else if (popover) {
      // Fallback: manually strip popover attribute if JSDOM doesn't support the API
      popover.removeAttribute("popover");
    }
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete transaction" });

    expect(dialog).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  });
});

function activeRoute() {
  return document.querySelector<HTMLElement>(".route-stage.is-active")!;
}
