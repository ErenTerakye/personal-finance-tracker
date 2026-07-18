import { describe, expect, it } from "vitest";
import {
  absoluteMoney,
  compareMoney,
  money,
  signedMoney,
  subtractMoney,
  sumMoney,
} from "./money";

describe("decimal-safe money formatting", () => {
  it("formats the supported high-value boundary without losing a cent", () => {
    expect(money("90071992547409.91")).toBe("$90,071,992,547,409.91");
    expect(signedMoney("-90071992547409.91")).toBe("-$90,071,992,547,409.91");
  });

  it("adds, subtracts, compares, and takes absolute values in integer cents", () => {
    expect(sumMoney(["90071992547409.90", "0.01"])).toBe("90071992547409.91");
    expect(subtractMoney("0.30", "0.20")).toBe("0.10");
    expect(compareMoney("90071992547409.91", "90071992547409.90")).toBe(1);
    expect(absoluteMoney("-0.01")).toBe("0.01");
  });
});
