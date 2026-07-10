import { describe, expect, it } from "vitest";
import { artifactUrls } from "./artifacts";

describe("artifactUrls", () => {
  it("owns report, chart, and filtered CSV download URLs", () => {
    expect(
      artifactUrls.transactionsCsv({
        month: 7,
        year: 2026,
        category: "Food & drink",
      }),
    ).toBe(
      "/api/transactions/export-csv?month=7&year=2026&category=Food+%26+drink",
    );
    expect(artifactUrls.budgetsCsv({ month: 7, year: 2026 })).toBe(
      "/api/budgets/export-csv?month=7&year=2026",
    );
    expect(artifactUrls.monthlyChart(7, 2026)).toBe(
      "/api/charts/monthly.png?month=7&year=2026",
    );
  });
});
