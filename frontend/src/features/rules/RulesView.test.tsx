import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import {
  installAppTestLifecycle,
  mockFetch,
  response,
  dashboardPayload,
} from "../../test/appTestSupport";

installAppTestLifecycle();

describe("rules workflow", () => {
  it("manages category rules and recurring templates", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/category-rules" && init?.method === "POST") {
          return response({
            notice: "Category rule saved.",
            notice_code: "category_rule.saved",
            rule: {
              id: 1,
              alias: "groceries",
              category: "Food",
              created_at: null,
            },
          });
        }
        if (url === "/api/recurring-templates" && init?.method === "POST") {
          return response({
            notice: "Recurring template saved.",
            notice_code: "recurring_template.saved",
            template: {
              id: 1,
              type: "expense",
              amount: "1200.00",
              category: "Rent",
              description: "",
              day_of_month: 1,
              active: true,
              created_at: null,
            },
          });
        }
        if (url.startsWith("/api/category-rules")) {
          return response({ rules: [] });
        }
        if (url.startsWith("/api/recurring-templates")) {
          return response({ templates: [] });
        }
        return response(dashboardPayload({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));
    await userEvent.type(await screen.findByLabelText("Alias"), "groceries");
    await userEvent.type(
      document.querySelector("#rule-category") as HTMLInputElement,
      "Food",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save rule" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Category rule saved.",
      ),
    );
  });

  it("renders rules info cards, presets, and playground correctly", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/category-rules")) {
          return response({
            rules: [
              { id: 1, alias: "uber", category: "Transport", created_at: null },
            ],
          });
        }
        if (url.startsWith("/api/recurring-templates")) {
          return response({ templates: [] });
        }
        return response(dashboardPayload({}));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));

    // Verifies info cards
    expect(screen.getByText("Category Aliases")).toBeInTheDocument();
    expect(screen.getByText("Recurring Templates")).toBeInTheDocument();

    // Verifies template presets show by default (since templates is empty)
    expect(
      screen.getByText(/Quick-add standard templates:/i),
    ).toBeInTheDocument();

    // Verifies alias presets do not show by default (since rules is not empty), but toggle button shows
    expect(
      screen.queryByText(/Quick-add popular aliases:/i),
    ).not.toBeInTheDocument();
    const toggleButton = screen.getByRole("button", {
      name: /Show Quick-Add Presets/i,
    });
    await userEvent.click(toggleButton);
    expect(screen.getByText(/Quick-add popular aliases:/i)).toBeInTheDocument();

    // Verifies playground sandbox behaves correctly
    const sandboxInput = screen.getByPlaceholderText(/Type a CSV category/i);
    expect(sandboxInput).toBeInTheDocument();

    // Typing mismatch
    await userEvent.type(sandboxInput, "lyft");
    expect(
      await screen.findByText(/No active alias matches/i),
    ).toBeInTheDocument();

    // Typing match
    await userEvent.clear(sandboxInput);
    await userEvent.type(sandboxInput, "uber");
    expect(await screen.findByText(/Maps/i)).toBeInTheDocument();
  });

  it("translates preset categories and descriptions dynamically on Rules view", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/category-rules": { rules: [] },
      "/api/recurring-templates": { templates: [] },
      "/api/settings": { currency: "USD" },
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Rules/i }));

    // Verify it renders in English initially
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("uber → Transport")).toBeInTheDocument();

    const now = new Date();
    const monthIndex = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthNamesEn = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthNamesTr = [
      "",
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ];
    const expectedEnPeriod = `${monthNamesEn[monthIndex]} ${year}`;
    const expectedTrPeriod = `${monthNamesTr[monthIndex]} ${year}`;

    expect(
      screen.getByRole("button", {
        name: new RegExp(`Apply for ${expectedEnPeriod}`, "i"),
      }),
    ).toBeInTheDocument();

    // Toggle language to Turkish
    const langToggle = screen.getByRole("button", {
      name: /Switch language|Dili değiştir/i,
    });
    await userEvent.click(langToggle);

    // Verify it renders in Turkish
    expect(screen.getByText("Kira")).toBeInTheDocument();
    expect(screen.getByText("uber → Ulaşım")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(`${expectedTrPeriod} için uygula`, "i"),
      }),
    ).toBeInTheDocument();

    // Switch back to English
    await userEvent.click(langToggle);
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("uber → Transport")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Apply for ${expectedEnPeriod}`, "i"),
      }),
    ).toBeInTheDocument();
  });
});
