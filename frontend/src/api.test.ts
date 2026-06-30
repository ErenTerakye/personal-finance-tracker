import { describe, expect, it, vi } from "vitest";
import { api, ApiError, query } from "./api";

describe("api client", () => {
  it("serializes filters without empty values", () => {
    expect(query({ month: 6, year: 2026, category: "", transaction_type: "expense" })).toBe(
      "month=6&year=2026&transaction_type=expense"
    );
  });

  it("reads nested FastAPI error JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: { error: "Amount must be greater than zero." } })
      })
    );

    await expect(api.transactions()).rejects.toThrow(ApiError);
    await expect(api.transactions()).rejects.toThrow("Amount must be greater than zero.");
  });
});
