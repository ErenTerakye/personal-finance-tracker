import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResource } from "./useResource";
import { prefetchResource } from "./resourceCache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useResource", () => {
  it("aborts the active request on dependency change and cleanup", async () => {
    const signals: AbortSignal[] = [];
    const loader = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>(() => undefined);
    });
    const { rerender, unmount } = renderHook(
      ({ key }) => useResource(loader, key),
      { initialProps: { key: "first" } },
    );

    await waitFor(() => expect(signals).toHaveLength(1));
    rerender({ key: "second" });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    unmount();
    expect(signals[1].aborted).toBe(true);
  });

  it("ignores a stale completion even when the loader does not honor abort", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const loader = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ key }) => useResource(loader, key),
      { initialProps: { key: "first" } },
    );

    rerender({ key: "second" });
    await act(async () => first.resolve("stale"));
    expect(result.current.status).toBe("loading");
    await act(async () => second.resolve("fresh"));
    expect(result.current).toMatchObject({ status: "success", data: "fresh" });
  });

  it("normalizes errors and refetches explicitly", async () => {
    const loader = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce({ unexpected: true })
      .mockResolvedValueOnce("recovered");
    const { result } = renderHook(() => useResource(loader, "stable"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe(
      "The request could not be completed.",
    );
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("normalizes an error thrown synchronously by the loader", async () => {
    const loader = vi.fn(() => {
      throw new TypeError("synchronous failure");
    });
    const { result } = renderHook(() => useResource(loader, "stable"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("synchronous failure");
  });

  it("starts from prepared data without exposing an idle loading frame", async () => {
    await prefetchResource("prepared", async () => "warm");
    const loader = vi.fn(async () => "network");

    const { result } = renderHook(() =>
      useResource(loader, "prepared", { cacheKey: "prepared" }),
    );

    expect(result.current).toMatchObject({ status: "success", data: "warm" });
    expect(loader).not.toHaveBeenCalled();
  });
});
