import {
  fireEvent,
  render as originalRender,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CashflowTrend, ExpenseMix, TrendLines } from ".";
import type { DashboardData } from "../../types";
import { I18nProvider } from "../i18n/I18nProvider";

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
            net_savings: "99.00",
          }),
          trendMonth("2026-02", {
            total_income: "0.00",
            total_expenses: "0.00",
            net_savings: "0.00",
          }),
        ]}
      />,
    );

    const activeMonth = screen.getByText("Jan 26").closest("li") as HTMLElement;
    const emptyMonth = screen.getByText("Feb 26").closest("li") as HTMLElement;

    expect(activeMonth.style.getPropertyValue("--income-size")).toBe("100%");
    expect(activeMonth.style.getPropertyValue("--expense-size")).toBe("6%");
    expect(activeMonth.style.getPropertyValue("--net-size")).toBe("99%");
    expect(activeMonth.style.getPropertyValue("--income-scale")).toBe("1");
    expect(activeMonth.style.getPropertyValue("--expense-scale")).toBe("0.06");
    expect(activeMonth.style.getPropertyValue("--net-scale")).toBe("0.99");
    expect(emptyMonth.style.getPropertyValue("--income-size")).toBe("0%");
    expect(emptyMonth.style.getPropertyValue("--expense-size")).toBe("0%");
    expect(emptyMonth.style.getPropertyValue("--net-size")).toBe("0%");
    expect(emptyMonth.style.getPropertyValue("--income-scale")).toBe("0");
  });

  it("retains each visual bar slot when the trend period changes", () => {
    const { rerender } = render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "40.00",
            net_savings: "60.00",
          }),
        ]}
      />,
    );
    const incomeBar = screen.getByRole("button", {
      name: /Income for January 2026/,
    });

    rerender(
      <I18nProvider>
        <CashflowTrend
          months={[
            trendMonth("2026-02", {
              total_income: "50.00",
              total_expenses: "40.00",
              net_savings: "10.00",
            }),
          ]}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("button", { name: /Income for February 2026/ }),
    ).toBe(incomeBar);
  });

  it("shows exact details when an expense bar receives focus", async () => {
    const user = userEvent.setup();
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66",
          }),
        ]}
      />,
    );

    await user.tab();
    await user.tab();

    const tooltip = document.querySelector("output") as HTMLElement;
    expect(within(tooltip).getByText("Expenses")).toBeInTheDocument();
    expect(within(tooltip).getByText("1 entries")).toBeInTheDocument();
  });

  it("highlights only the hovered bar and clears it when the pointer leaves", () => {
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66",
          }),
        ]}
      />,
    );

    const expenseBar = screen.getByRole("button", {
      name: /Expenses for January 2026/,
    });
    const expenseFill = expenseBar.querySelector("span") as HTMLElement;

    fireEvent.pointerEnter(expenseBar, { pointerType: "mouse" });
    expect(expenseBar).not.toHaveClass("active");

    fireEvent.pointerEnter(expenseFill, { pointerType: "mouse" });

    expect(expenseBar).toHaveClass("active");
    expect(
      screen.getByRole("button", { name: /Income for January 2026/ }),
    ).not.toHaveClass("active");

    fireEvent.pointerLeave(expenseFill, { pointerType: "mouse" });
    expect(expenseBar).not.toHaveClass("active");
  });

  it("pins details on touch and dismisses with Escape", () => {
    render(
      <CashflowTrend
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66",
          }),
        ]}
      />,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: /Expenses for January 2026/ }),
      {
        pointerType: "touch",
      },
    );

    expect(document.querySelector("output")).toHaveTextContent("$12.34");
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Expenses for January 2026/ }),
      { key: "Escape" },
    );

    expect(document.querySelector("output")).not.toBeInTheDocument();
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
            net_savings: "87.66",
          }),
        ]}
      />,
    );

    screen.getByRole("button", { name: /Income for January 2026: \$100.00/ });
    await user.tab();

    const tooltip = document.querySelector("output") as HTMLElement;
    expect(within(tooltip).getByText("Income")).toBeInTheDocument();
    expect(within(tooltip).getByText("0.0% savings rate")).toBeInTheDocument();
  });

  it("pins a focused point with the keyboard and dismisses it with Escape", () => {
    render(
      <TrendLines
        months={[
          trendMonth("2026-01", {
            total_income: "100.00",
            total_expenses: "12.34",
            net_savings: "87.66",
          }),
        ]}
      />,
    );

    const point = screen.getByRole("button", {
      name: /Income for January 2026: \$100.00/,
    });
    fireEvent.focus(point);
    fireEvent.keyDown(point, { key: "Enter" });
    expect(point).toHaveAttribute("aria-pressed", "true");

    fireEvent.blur(point);
    expect(document.querySelector("output")).toHaveTextContent("$100.00");
    fireEvent.keyDown(point, { key: "Escape" });
    expect(document.querySelector("output")).not.toBeInTheDocument();
  });
});

describe("ExpenseMix", () => {
  it("renders an accessible donut with exact category data", () => {
    render(
      <ExpenseMix
        title="Expense mix"
        items={[
          { label: "Housing", value: "750.00" },
          { label: "Food", value: "250.00" },
        ]}
      />,
    );

    expect(
      screen.getByRole("group", { name: /Expense mix Donut chart/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getAllByText("75.0%")).toHaveLength(2);

    const table = screen.getByRole("table");
    expect(within(table).getByText("Housing")).toBeInTheDocument();
    expect(within(table).getByText("25.0%")).toBeInTheDocument();
  });

  it("reveals slice details on hover and keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseMix
        title="Expense mix"
        items={[
          { label: "Housing", value: "750.00" },
          { label: "Food", value: "250.00" },
        ]}
      />,
    );

    const housing = screen.getByRole("button", {
      name: "Housing: $750.00, 75.0% of expenses",
    });
    fireEvent.pointerEnter(housing);
    expect(document.querySelector(".expense-mix-total")).toHaveTextContent(
      "Housing$750.0075.0%",
    );

    fireEvent.pointerLeave(
      screen.getByRole("group", { name: /Expense mix Donut chart/ }),
    );
    await user.tab();
    expect(housing).toHaveFocus();
    expect(housing).toHaveAttribute("data-active", "true");
  });

  it("groups smaller categories to keep the chart readable", () => {
    render(
      <ExpenseMix
        title="Expense mix"
        items={Array.from({ length: 7 }, (_, index) => ({
          label: `Category ${index + 1}`,
          value: String(70 - index * 10),
        }))}
      />,
    );

    expect(screen.getAllByText("Other")).toHaveLength(2);
    expect(screen.queryByText("Category 6")).not.toBeInTheDocument();
  });
});

function trendMonth(
  label: string,
  values: Pick<TrendMonth, "total_income" | "total_expenses" | "net_savings">,
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
    ...values,
  };
}
