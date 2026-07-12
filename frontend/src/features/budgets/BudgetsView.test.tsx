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
      await screen.findByRole("heading", { name: "Planned versus spent" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Uncovered spending").nextSibling,
    ).toHaveTextContent("$50.00");
    expect(screen.getByText("Uncovered spending").parentElement).toHaveClass(
      "budget-total-warning",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Food, near limit/ }),
    );
    expect(
      screen.getByRole("button", { name: "Edit Food budget" }),
    ).toBeInTheDocument();
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
