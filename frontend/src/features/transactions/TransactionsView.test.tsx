import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  mockFetch,
  response,
  transaction,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("transactions workflow", () => {
  it("opens the shared transaction form from the global create command", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Transactions|Activity/i }),
    );
    window.dispatchEvent(new Event("finance-tracker:add-transaction"));

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

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
    await userEvent.click(
      document.querySelector(".transaction-filter-disclosure summary")!,
    );
    expect(screen.getByLabelText("Transaction filter period")).toBeVisible();
  });

  it("creates a transaction from a dialog and announces success", async () => {
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
      await screen.findByRole("button", { name: "Add entry" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add transaction" });
    await userEvent.type(within(dialog).getByLabelText("Amount"), "45.90");
    await userEvent.type(within(dialog).getByLabelText("Category"), "Food");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add entry" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Transaction added to the local ledger.",
      ),
    );
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
    await screen.findByText("Groceries");
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
