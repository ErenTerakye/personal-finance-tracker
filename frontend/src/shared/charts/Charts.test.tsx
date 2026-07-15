import {
  fireEvent,
  render as originalRender,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("keeps the nearest bar active while crossing the gaps between rows", () => {
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
    const trendBars = expenseBar.closest(".trend-bars") as HTMLElement;
    const incomeBar = screen.getByRole("button", {
      name: /Income for January 2026/,
    });
    vi.spyOn(incomeBar, "getBoundingClientRect").mockReturnValue(
      domRect({ top: 0, width: 6, height: 6 }),
    );
    vi.spyOn(expenseBar, "getBoundingClientRect").mockReturnValue(
      domRect({ top: 10, width: 6, height: 6 }),
    );
    const netBar = screen.getByRole("button", {
      name: /Net for January 2026/,
    });
    vi.spyOn(netBar, "getBoundingClientRect").mockReturnValue(
      domRect({ top: 20, width: 6, height: 6 }),
    );

    fireEvent.pointerMove(trendBars, { pointerType: "mouse", clientY: 9 });

    expect(expenseBar).toHaveClass("active");
    expect(incomeBar).not.toHaveClass("active");

    fireEvent.pointerMove(trendBars, { pointerType: "mouse", clientY: 7 });
    expect(incomeBar).toHaveClass("active");
    expect(document.querySelector("output")).toBeInTheDocument();

    fireEvent.pointerLeave(trendBars, { pointerType: "mouse" });
    expect(incomeBar).not.toHaveClass("active");
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
  it("toggles its chart data table with the native disclosure control", async () => {
    const user = userEvent.setup();
    render(
      <ExpenseMix
        title="Expense mix"
        items={[{ label: "Housing", value: "750.00" }]}
      />,
    );

    const summary = screen.getByText("Show chart data as a table");
    const disclosure = summary.closest("details");

    expect(disclosure).not.toHaveAttribute("open");
    await user.click(summary);
    expect(disclosure).toHaveAttribute("open");
    await user.click(summary);
    expect(disclosure).not.toHaveAttribute("open");
  });

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
    expect(
      screen.getByRole("button", { name: "Housing$750.0075.0%" }),
    ).not.toHaveAttribute("data-active");

    fireEvent.pointerLeave(
      screen.getByRole("group", { name: /Expense mix Donut chart/ }),
    );
    await user.tab();
    expect(housing).toHaveFocus();
    expect(housing).toHaveAttribute("data-active", "true");
  });

  it("keeps the nearest category active across ranking separators", () => {
    render(
      <ExpenseMix
        title="Expense mix"
        items={[
          { label: "Housing", value: "750.00" },
          { label: "Food", value: "250.00" },
        ]}
      />,
    );

    const ranking = document.querySelector(
      ".expense-mix-legend",
    ) as HTMLElement;
    const housing = screen.getByRole("button", {
      name: "Housing$750.0075.0%",
    });
    const food = screen.getByRole("button", {
      name: "Food$250.0025.0%",
    });
    vi.spyOn(housing, "getBoundingClientRect").mockReturnValue(
      domRect({ top: 0, width: 100, height: 30 }),
    );
    vi.spyOn(food, "getBoundingClientRect").mockReturnValue(
      domRect({ top: 40, width: 100, height: 30 }),
    );

    fireEvent.pointerMove(ranking, {
      pointerType: "mouse",
      clientY: 34,
    });
    expect(housing).toHaveAttribute("data-active", "true");

    fireEvent.pointerMove(ranking, {
      pointerType: "mouse",
      clientY: 36,
    });
    expect(food).toHaveAttribute("data-active", "true");
    expect(document.querySelector(".expense-mix-total")).toHaveTextContent(
      "Food$250.0025.0%",
    );

    fireEvent.pointerLeave(ranking, { pointerType: "mouse" });
    expect(food).not.toHaveAttribute("data-active");
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

  it("triggers onClickCategory when a slice or legend button is clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <ExpenseMix
        title="Expense mix"
        items={[
          { label: "Housing", value: "750.00" },
          { label: "Food", value: "250.00" },
        ]}
        onClickCategory={handleClick}
      />,
    );

    // Click the chart slice button
    const housingSlice = screen.getByRole("button", {
      name: "Housing: $750.00, 75.0% of expenses",
    });
    await user.click(housingSlice);
    expect(handleClick).toHaveBeenCalledWith("Housing");

    // Click the legend item button
    const foodLegend = screen.getByRole("button", {
      name: "Food$250.0025.0%",
    });
    await user.click(foodLegend);
    expect(handleClick).toHaveBeenCalledWith("Food");
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

function domRect(values: Partial<DOMRect>): DOMRect {
  const left = values.left ?? 0;
  const top = values.top ?? 0;
  const width = values.width ?? 0;
  const height = values.height ?? 0;
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
