import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutation } from "./useMutation";

describe("useMutation", () => {
  it("prevents duplicate submissions while pending and refreshes on success", async () => {
    let finish!: (value: string) => void;
    const action = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve)),
    );
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useMutation(action, { onSuccess }));

    let first!: Promise<string | undefined>;
    let duplicate!: Promise<string | undefined>;
    act(() => {
      first = result.current.mutate("save");
      duplicate = result.current.mutate("save-again");
    });
    expect(result.current.status).toBe("pending");
    expect(action).toHaveBeenCalledTimes(1);
    await expect(duplicate).resolves.toBeUndefined();
    await act(async () => finish("saved"));
    await expect(first).resolves.toBe("saved");
    expect(onSuccess).toHaveBeenCalledWith("saved", "save");
    expect(result.current).toMatchObject({ status: "success", data: "saved" });
  });

  it("normalizes thrown values and resets after errors", async () => {
    const { result } = renderHook(() =>
      useMutation(async () => {
        throw { reason: "unknown" };
      }),
    );

    await act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe(
      "The request could not be completed.",
    );
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
  });
});
