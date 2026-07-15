import { describe, expect, it } from "vitest";
import { normalizeBudgetAmountDraft } from "./budgetForm";

describe("normalizeBudgetAmountDraft", () => {
  it.each([
    ["", ""],
    [".5", "0.5"],
    ["12,40", "12.40"],
    ["1250.99", "1250.99"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeBudgetAmountDraft(input)).toBe(expected);
  });

  it.each(["12.345", "1,2,3", "abc", "-10"])(
    "rejects invalid draft %s",
    (input) => {
      expect(normalizeBudgetAmountDraft(input)).toBeNull();
    },
  );
});
