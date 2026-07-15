import { describe, expect, it } from "vitest";
import { normalizeAmountDraft } from "./transactionForm";

describe("normalizeAmountDraft", () => {
  it.each([
    ["", ""],
    ["12", "12"],
    ["12.", "12."],
    ["12.34", "12.34"],
    [".5", "0.5"],
    [",5", "0.5"],
    ["12,34", "12.34"],
  ])("keeps supported amount draft %j as %j", (input, expected) => {
    expect(normalizeAmountDraft(input)).toBe(expected);
  });

  it.each(["-1", "1.234", "1.2.3", "1,234.56", "12a", " 12"])(
    "rejects unsupported amount draft %j",
    (input) => {
      expect(normalizeAmountDraft(input)).toBeNull();
    },
  );

  it("rejects values longer than the API contract", () => {
    expect(normalizeAmountDraft("1".repeat(65))).toBeNull();
  });
});
