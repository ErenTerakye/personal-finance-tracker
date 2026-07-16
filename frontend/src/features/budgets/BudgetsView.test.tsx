import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  response,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("budgets workflow", () => {
  it("retries a failed budget resource load", async () => {
    let budgetAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/budgets/status")) {
        return response({ statuses: [] });
      }
      if (url.startsWith("/api/budgets")) {
        budgetAttempts += 1;
        if (budgetAttempts === 1) throw new TypeError("Load failed");
        return response({ budgets: [] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));
    const alert = await screen.findByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No budgets for this period")).toBeVisible();
    expect(budgetAttempts).toBe(2);
  });

  it("summarizes planned, spent, remaining, and uncovered amounts", async () => {
    const budgetRecord = {
      id: 1,
      category: "Food",
      amount: "500.00",
      month: 7,
      year: 2026,
      created_at: null,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/budgets/status")) {
        return response({
          statuses: [
            {
              budget: budgetRecord,
              actual_expenses: "400.00",
              remaining: "100.00",
              percent_used: "80.0",
              status: "near limit",
            },
          ],
        });
      }
      if (url.startsWith("/api/budgets"))
        return response({ budgets: [budgetRecord] });
      return response(
        dashboardPayload({
          report: { ...dashboardPayload({}).report, total_expenses: "450.00" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));

    expect(
      await screen.findByRole("heading", {
        name: "A few categories need a closer look",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Uncovered spending").nextSibling,
    ).toHaveTextContent("$50.00");
    expect(screen.getByText("Uncovered spending").parentElement).toHaveClass(
      "plan-metric-alert",
    );
    const categoryButton = screen.getByRole("button", {
      name: /Food, near limit/,
    });
    await userEvent.click(categoryButton);
    expect(categoryButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Edit Food budget" }),
    ).toBeInTheDocument();
    const inspectorId = categoryButton.getAttribute("aria-controls");
    expect(inspectorId).toBeTruthy();
    expect(document.getElementById(inspectorId!)).toHaveClass(
      "plan-inspector",
      "is-open",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Close category details" }),
    );
    expect(categoryButton).toHaveAttribute("aria-expanded", "false");
    expect(categoryButton).toHaveFocus();
    expect(document.getElementById(inspectorId!)).not.toHaveClass("is-open");
    expect(
      screen.queryByRole("button", { name: "Edit Food budget" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Priority" })).toBeChecked();
    expect(
      screen.getByRole("searchbox", { name: "Find a category" }),
    ).toBeVisible();
  });

  it("previews the impact of a budget before it is saved", async () => {
    const budgetRecord = {
      id: 1,
      category: "Food & Drinks",
      amount: "300.00",
      month: 7,
      year: 2026,
      created_at: null,
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/budgets/status")) {
        return response({
          statuses: [
            {
              budget: budgetRecord,
              actual_expenses: "120.00",
              remaining: "180.00",
              percent_used: "40.0",
              status: "on track",
            },
          ],
        });
      }
      if (url.startsWith("/api/budgets")) {
        return response({ budgets: [budgetRecord] });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Set budget" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Set budget" });
    const amountInput = within(dialog).getByLabelText("Amount");
    expect(amountInput).toHaveFocus();
    await userEvent.type(amountInput, "200");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Food & Drinks" }),
    );

    expect(
      within(dialog).getByText("Spent already").nextSibling,
    ).toHaveTextContent("$120.00");
    expect(
      within(dialog).getByText("Room after saving").nextSibling,
    ).toHaveTextContent("$80.00");
    expect(
      within(dialog).getByText(/replaces the current \$300\.00 limit/),
    ).toBeVisible();
  });

  it("imports budget CSV from a dialog and shows row results", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/budgets/import-csv" && init?.method === "POST") {
          return response({
            notice: "Budget CSV import finished.",
            imported_count: 1,
            skipped_count: 0,
            errors: [],
          });
        }
        if (url.startsWith("/api/budgets/status")) {
          return response({ statuses: [] });
        }
        if (url.startsWith("/api/budgets")) {
          return response({ budgets: [] });
        }
        return response(dashboardPayload({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Import CSV" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Import budget CSV" });
    const file = new File(
      ["category,amount,month,year\nFood,400,6,2026\n"],
      "budgets.csv",
      {
        type: "text/csv",
      },
    );

    await userEvent.upload(within(dialog).getByLabelText("CSV file"), file);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Import CSV" }),
    );

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Imported 1, skipped 0.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/budgets/import-csv",
      expect.objectContaining({ body: expect.stringContaining("Food,400") }),
    );
  });
});
