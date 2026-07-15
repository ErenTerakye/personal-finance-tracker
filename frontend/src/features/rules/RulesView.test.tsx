import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  dashboardPayload,
  installAppTestLifecycle,
  mockFetch,
  response,
} from "../../test/appTestSupport";

installAppTestLifecycle();

const categoryRule = {
  id: 1,
  alias: "uber",
  category: "Transport",
  created_at: null,
};

const recurringTemplate = {
  id: 2,
  type: "expense",
  amount: "1200.00",
  category: "Rent",
  description: "Monthly rent",
  day_of_month: 1,
  active: true,
  created_at: null,
};

describe("rules workflow", () => {
  it("explains active automations in one plain-language list", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [categoryRule] },
      "/api/recurring-templates": { templates: [recurringTemplate] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Rules|Automations/i }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "2 automations are working for you",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your automations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Change “uber” to “Transport”"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Monthly rent")).not.toHaveLength(0);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("retries all page resources after a load failure", async () => {
    const attempts = { rules: 0, templates: 0, settings: 0 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/category-rules")) {
        attempts.rules += 1;
        if (attempts.rules === 1) throw new TypeError("Load failed");
        return response({ rules: [] });
      }
      if (url.startsWith("/api/recurring-templates")) {
        attempts.templates += 1;
        return response({ templates: [] });
      }
      if (url.startsWith("/api/settings")) {
        attempts.settings += 1;
        return response({ currency: "USD" });
      }
      return response(dashboardPayload({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Rules|Automations/i }),
    );
    const alert = await screen.findByRole("alert");
    const beforeRetry = { ...attempts };
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(alert).not.toBeInTheDocument());
    expect(attempts).toEqual({
      rules: beforeRetry.rules + 1,
      templates: beforeRetry.templates + 1,
      settings: beforeRetry.settings + 1,
    });
  });

  it("creates a category automation through the guided dialog", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/category-rules" && init?.method === "POST") {
          return response({
            notice: "Category rule saved.",
            notice_code: "category_rule.saved",
            rule: { ...categoryRule, alias: "groceries", category: "Food" },
          });
        }
        if (url.startsWith("/api/category-rules"))
          return response({ rules: [] });
        if (url.startsWith("/api/recurring-templates"))
          return response({ templates: [] });
        if (url.startsWith("/api/settings"))
          return response({ currency: "USD" });
        return response(dashboardPayload({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Rules|Automations/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "New automation" }),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: /Clean up imported categories/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Clean up imported categories" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Example category cleanup")).toHaveTextContent(
      "CSV saysuberLedger savesTransport",
    );
    await userEvent.type(
      screen.getByLabelText("Imported category"),
      "groceries",
    );
    await userEvent.type(screen.getByLabelText("Save as category"), "Food");
    await userEvent.click(
      screen.getByRole("button", { name: "Create automation" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Category rule saved.",
      ),
    );
    expect(
      screen.queryByRole("dialog", {
        name: "Clean up imported categories",
      }),
    ).not.toBeInTheDocument();
  });

  it("explains monthly templates and offers useful starter examples", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [] },
      "/api/recurring-templates": { templates: [] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Rules|Automations/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "New automation" }),
    );
    await userEvent.click(
      screen.getByRole("radio", { name: /Remember a monthly transaction/i }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Rent" }));

    expect(screen.getByLabelText("Description (optional)")).toHaveValue(
      "Monthly rent",
    );
    expect(screen.getByLabelText("Category")).toHaveValue("Housing");
    expect(screen.getByLabelText("Day")).toHaveValue(1);
    expect(screen.getByRole("radio", { name: "Expense" })).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText("Amount")).toHaveFocus());
  });

  it("previews monthly entries and explains duplicate safety", async () => {
    window.history.replaceState({}, "", "/rules?month=3&year=2026");
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [] },
      "/api/recurring-templates": { templates: [recurringTemplate] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await screen.findByRole("heading", { name: /Prepare .+/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Review entries" }),
    );

    expect(
      screen.getByRole("heading", { name: /Review .+ entries/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/already created for this month will be skipped/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create 1 entries" }),
    ).toBeEnabled();
  });

  it("confirms before deleting an automation", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [categoryRule] },
      "/api/recurring-templates": { templates: [] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await userEvent.click(
      await screen.findByRole("link", { name: /Rules|Automations/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete uber" }),
    );

    expect(
      screen.getByRole("heading", { name: "Delete this automation?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Existing transactions will not change/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete automation" }),
    ).toBeEnabled();
  });
});
