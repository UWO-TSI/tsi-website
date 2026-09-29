import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presenceRequest } from "./mobilePresence";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("bounded presence requests", () => {
  it("aborts and rejects a hung request even if the transport ignores abort", async () => {
    let signal!: AbortSignal;
    const promise = presenceRequest((s) => { signal = s; return new Promise(() => {}); }, new AbortController().signal, 100);
    const result = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not start a request after cancellation", async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn();
    await expect(presenceRequest(request, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans its timeout and external abort listener after success", async () => {
    const controller = new AbortController();
    let requestSignal!: AbortSignal;
    await expect(presenceRequest(async (signal) => { requestSignal = signal; return 7; }, controller.signal)).resolves.toBe(7);
    controller.abort();
    expect(requestSignal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
