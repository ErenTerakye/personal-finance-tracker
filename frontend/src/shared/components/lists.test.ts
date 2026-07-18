import { describe, expect, it } from "vitest";
import type { BudgetStatus } from "../../types";
import { rankBudgetAttention, summarizeBudgetAttention } from "./lists";

describe("budget attention queue calculations", () => {
  it("ranks severity, monetary impact, pressure, and category deterministically", () => {
    const ranked = rankBudgetAttention([
      attentionStatus(1, "Dining", "near limit", "5.00", "95.0"),
      attentionStatus(2, "Books", "over budget", "-50.00", "120.0"),
      attentionStatus(3, "Travel", "over budget", "-100.00", "110.0"),
      attentionStatus(4, "Auto", "over budget", "-50.00", "150.0"),
      attentionStatus(5, "Health", "near limit", "4.00", "92.0"),
      attentionStatus(6, "Utilities", "ok", "40.00", "60.0"),
    ]);

    expect(ranked.map((status) => status.budget.category)).toEqual([
      "Travel",
      "Auto",
      "Books",
      "Dining",
      "Health",
    ]);
  });

  it("totals overages and near-limit headroom", () => {
    expect(
      summarizeBudgetAttention([
        attentionStatus(1, "Rent", "over budget", "-1500.00", "193.8"),
        attentionStatus(2, "Travel", "over budget", "-90.00", "116.4"),
        attentionStatus(3, "Dining", "near limit", "5.70", "96.6"),
        attentionStatus(4, "Health", "near limit", "8.00", "92.0"),
      ]),
    ).toEqual({
      overAmount: "1590.00",
      overCount: 2,
      nearAmount: "13.70",
      nearCount: 2,
    });
  });
});

function attentionStatus(
  id: number,
  category: string,
  status: string,
  remaining: string,
  percentUsed: string,
): BudgetStatus {
  return {
    budget: {
      id,
      category,
      amount: "100.00",
      month: 6,
      year: 2026,
      created_at: "2026-06-01T12:00:00",
    },
    actual_expenses: "100.00",
    remaining,
    percent_used: percentUsed,
    status,
  };
}
