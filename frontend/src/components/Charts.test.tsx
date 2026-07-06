import { fireEvent, render as originalRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CashflowTrend, TrendLines } from "./Charts";
import type { DashboardData } from "../types";
import { I18nProvider } from "../i18n";

function render(ui: React.ReactElement) {
  return originalRender(<I18nProvider>{ui}</I18nProvider>);
}

type TrendMonth = DashboardData["trend"]["months"][number];

describe("CashflowTrend", () => {
  it("scales bars while keeping true zero values empty", () => {
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "1.00",
            net_savings: "99.00"
          }),
          trendMonth("2026-02", {
            total_income: "0.00",
            total_expenses: "0.00",
            net_savings: "0.00"
          })
        ]}
      />
    );

    const activeMonth = screen.getByText("Jan 26").closest("li") as HTMLElement;
    const emptyMonth = screen.getByText("Feb 26").closest("li") as HTMLElement;

    expect(activeMonth.style.getPropertyValue("--income-size")).toBe("100%");
    expect(activeMonth.style.getPropertyValue("--expense-size")).toBe("6%");
    expect(activeMonth.style.getPropertyValue("--net-size")).toBe("99%");
    expect(emptyMonth.style.getPropertyValue("--income-size")).toBe("0%");
    expect(emptyMonth.style.getPropertyValue("--expense-size")).toBe("0%");
    expect(emptyMonth.style.getPropertyValue("--net-size")).toBe("0%");
  });

  it("shows exact details when an expense bar receives focus", async () => {
    const user = userEvent.setup();
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66"
          })
        ]}
      />
    );

    await user.tab();
    await user.tab();

    const tooltip = screen.getByText("$12.34").closest("output") as HTMLElement;
    expect(within(tooltip).getByText("Expenses")).toBeInTheDocument();
    expect(within(tooltip).getByText("1 entries")).toBeInTheDocument();
  });

  it("pins details on touch and dismisses with Escape", () => {
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66"
          })
        ]}
      />
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: /Expenses for January 2026/ }), {
      pointerType: "touch"
    });

    expect(screen.getByText("$12.34")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: /Expenses for January 2026/ }), { key: "Escape" });

    expect(screen.queryByText("$12.34")).not.toBeInTheDocument();
  });
});

describe("TrendLines", () => {
  it("renders accessible points and shows exact trend details on focus", async () => {
    const user = userEvent.setup();
    render(
      <TrendLines
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66"
          })
        ]}
      />
    );

    screen.getByRole("button", { name: /Income for January 2026: \$100.00/ });
    await user.tab();

    const tooltip = screen.getByText("$100.00").closest("output") as HTMLElement;
    expect(within(tooltip).getByText("Income")).toBeInTheDocument();
    expect(within(tooltip).getByText("0.0% savings rate")).toBeInTheDocument();
  });
});

function trendMonth(
  label: string,
  values: Pick<TrendMonth, "total_income" | "total_expenses" | "net_savings">
): TrendMonth {
  const [year, month] = label.split("-").map(Number);
  return {
    month,
    year,
    label,
    transaction_count: 1,
    savings_rate: "0.0",
    income_delta: "0.00",
    expenses_delta: "0.00",
    net_savings_delta: "0.00",
    ...values
  };
}
