import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatementTape } from "./Charts";
import type { DashboardData } from "../types";

type TrendMonth = DashboardData["trend"]["months"][number];

describe("StatementTape", () => {
  it("scales bars while keeping true zero values empty", () => {
    render(
      <StatementTape
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
    ...values
  };
}
