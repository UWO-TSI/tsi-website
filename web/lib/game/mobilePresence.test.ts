import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pollPresence, presenceRequest, recentVisitors } from "./mobilePresence";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("recent visitor data", () => {
  it("keeps finite coordinates, unique members, and safe display fields", () => {
    expect(recentVisitors([null, { user_id: "a", world_x: NaN, world_z: 0 },
      { user_id: "a", world_x: 0, world_z: -8, display_name: "Ada" },
      { user_id: "a", world_x: 1, world_z: 2 },
      { user_id: "b", world_x: "3", world_z: 2 },
      { user_id: "c", world_x: 1, world_z: 2, display_name: {} },
    ])).toEqual([{ user_id: "a", world_x: 0, world_z: -8, display_name: "Ada" }, { user_id: "c", world_x: 1, world_z: 2 }]);
    expect(recentVisitors({ ghosts: [] })).toEqual([]);
    expect(recentVisitors(Array.from({ length: 30 }, (_, i) => ({ user_id: `${i}`, world_x: i, world_z: 0 })))).toHaveLength(20);
  });
});

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

describe("presence polling", () => {
  it("waits for completion before scheduling the next poll", async () => {
    const first = deferred<number>();
    const request = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(2);
    const value = vi.fn(); const error = vi.fn();
    const stop = pollPresence(request, 100, value, error, 1000);
    await vi.advanceTimersByTimeAsync(300);
    expect(request).toHaveBeenCalledTimes(1);
    first.resolve(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(value).toHaveBeenCalledWith(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(value).toHaveBeenLastCalledWith(2);
    expect(error).not.toHaveBeenCalled();
    stop(); expect(vi.getTimerCount()).toBe(0);
  });
  it("retries after a timeout without accepting the stale result", async () => {
    const first = deferred<number>();
    const request = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(2);
    const value = vi.fn(); const error = vi.fn();
    const stop = pollPresence(request, 100, value, error, 50);
    await vi.advanceTimersByTimeAsync(50);
    expect(error).toHaveBeenCalledTimes(1);
    first.resolve(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(value.mock.calls).toEqual([[2]]);
    stop();
  });
  it.each(["resolve", "reject"] as const)("aborts on close and suppresses late %s callbacks", async (settlement) => {
    const pending = deferred<number>();
    let signal!: AbortSignal;
    const value = vi.fn(); const error = vi.fn();
    const stop = pollPresence((s) => { signal = s; return pending.promise; }, 100, value, error);
    stop();
    if (settlement === "resolve") pending.resolve(3); else pending.reject(new Error("late"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(signal.aborted).toBe(true);
    expect(value).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
