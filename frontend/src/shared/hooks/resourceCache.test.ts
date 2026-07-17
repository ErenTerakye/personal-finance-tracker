import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearResourceCache,
  invalidateResourceTags,
  loadResourceCache,
  prefetchResource,
  readResourceCache,
} from "./resourceCache";

describe("resource cache", () => {
  beforeEach(clearResourceCache);

  it("deduplicates in-flight preparation and reuses fresh data", async () => {
    let resolve!: (value: string) => void;
    const loader = vi.fn(
      () =>
        new Promise<string>((resolvePromise) => {
          resolve = resolvePromise;
        }),
    );

    const first = prefetchResource("route", loader, { tags: ["ledger"] });
    const second = prefetchResource("route", loader, { tags: ["ledger"] });
    expect(loader).toHaveBeenCalledTimes(0);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    resolve("ready");

    await expect(first).resolves.toBe("ready");
    await expect(second).resolves.toBe("ready");
    await expect(loadResourceCache("route", loader)).resolves.toBe("ready");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidates related entries by tag", async () => {
    await prefetchResource("dashboard", async () => "cached", {
      tags: ["ledger"],
    });
    expect(readResourceCache("dashboard")).toMatchObject({
      data: "cached",
      fresh: true,
    });

    invalidateResourceTags("ledger");
    expect(readResourceCache("dashboard")).toEqual({ fresh: false });
  });

  it("retains a preparation failure for the route retry state", async () => {
    const error = new TypeError("offline");
    await expect(
      prefetchResource("route", async () => Promise.reject(error)),
    ).rejects.toBe(error);

    expect(readResourceCache("route")).toMatchObject({
      error,
      fresh: true,
    });
  });
});
