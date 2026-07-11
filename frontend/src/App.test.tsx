import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./app/App";
import {
  installAppTestLifecycle,
  mockFetch,
  mockColorScheme,
  mockReducedMotion,
  budget,
  dashboardPayload,
} from "./test/appTestSupport";

installAppTestLifecycle();

describe("app composition", () => {
  it("renders dashboard totals and over-budget pressure", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({
        budget_statuses: [
          {
            budget: budget(),
            actual_expenses: "185.00",
            remaining: "-35.00",
            percent_used: "123.3",
            status: "over budget",
          },
        ],
      }),
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose period/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Six-month cashflow trend")).toBeInTheDocument();
    expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
    expect(screen.getByText("over budget")).toBeInTheDocument();
    expect(screen.getByText("Show chart data as a table")).toBeInTheDocument();
  });

  it("navigates with browser routes", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: /Plan/i }));

    expect(window.location.pathname).toBe("/budgets");
    expect(
      await screen.findByRole("heading", { name: "Budgets" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Plan | Personal Finance Tracker");
  });

  it("opens the transaction form from the global create command", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(
      screen.getAllByRole("button", { name: "Add transaction" })[0],
    );

    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toBeInTheDocument();
  });

  it("keeps compact header commands connected to their workflows", async () => {
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/transactions": { transactions: [] },
    });

    render(<App />);
    await screen.findByRole("heading", { level: 1 });
    const compactHeader =
      document.querySelector<HTMLElement>(".compact-app-bar");
    expect(compactHeader).not.toBeNull();

    await userEvent.click(
      within(compactHeader!).getByRole("button", {
        name: "Add transaction",
      }),
    );
    expect(window.location.pathname).toBe("/transactions");
    expect(
      await screen.findByRole("dialog", { name: "Add transaction" }),
    ).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      within(compactHeader!).getByRole("link", { name: "Finance Tracker" }),
    );
    expect(window.location.pathname).toBe("/");
  });

  it("uses view transitions for route changes when motion is allowed", async () => {
    mockColorScheme("light");
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });
    const startViewTransition = vi.fn(({ update }: { update: () => void }) => {
      update();
      return { finished: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Plan" }));

    expect(startViewTransition).toHaveBeenCalledWith({
      update: expect.any(Function),
      types: ["forward"],
    });
    expect(window.location.pathname).toBe("/budgets");
  });

  it("skips view transitions when reduced motion is preferred", async () => {
    mockReducedMotion();
    mockFetch({
      "/api/dashboard": dashboardPayload({}),
      "/api/budgets": { budgets: [] },
      "/api/budgets/status": { statuses: [] },
    });
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<App />);
    await userEvent.click(await screen.findByRole("link", { name: "Plan" }));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/budgets");
  });

  it("supports language toggling between English and Turkish", async () => {
    mockFetch({ "/api/dashboard": dashboardPayload({}) });

    render(<App />);

    // Verify it renders in English by default
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Choose period/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("CASHFLOW OVERVIEW")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");

    // Find and click language toggle button
    const langToggle = screen.getByRole("button", {
      name: /Switch language|Dili değiştir/i,
    });
    expect(langToggle).toHaveTextContent("TR");
    await userEvent.click(langToggle);

    // Verify page titles and other elements are now in Turkish
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dönem seçin/i }),
    ).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("EN");
    expect(screen.getByText("NAKİT AKIŞI ÖZETİ")).toBeInTheDocument();
    expect(screen.getAllByText("Finance Tracker").length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("tr");
    await waitFor(() => expect(langToggle).toHaveFocus());

    // Click it again to switch back to English
    await userEvent.click(langToggle);
    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toBeInTheDocument();
    expect(langToggle).toHaveTextContent("TR");
    expect(screen.getByText("CASHFLOW OVERVIEW")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });
});
