import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorldTransition } from "./worldTransition";

describe("world transition lifetime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("changes the scene only at black, then holds and fades back to idle", async () => {
    const state = vi.fn(), error = vi.fn(), change = vi.fn();
    const transition = createWorldTransition(state, error);
    expect(transition.trigger(change)).toBe(true);
    expect(state).toHaveBeenLastCalledWith("fading-in");
    await vi.advanceTimersByTimeAsync(299); expect(change).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(change).toHaveBeenCalledOnce(); expect(state).toHaveBeenLastCalledWith("black");
    await vi.advanceTimersByTimeAsync(200); expect(state).toHaveBeenLastCalledWith("fading-out");
    await vi.advanceTimersByTimeAsync(500); expect(state).toHaveBeenLastCalledWith("idle");
    expect(error).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects same-frame duplicates and stays locked throughout the fade", async () => {
    const transition = createWorldTransition(vi.fn(), vi.fn());
    const first = vi.fn(), duplicate = vi.fn();
    transition.trigger(first); expect(transition.trigger(duplicate)).toBe(false);
    await vi.advanceTimersByTimeAsync(300); expect(transition.trigger(duplicate)).toBe(false);
    await vi.advanceTimersByTimeAsync(200); expect(transition.trigger(duplicate)).toBe(false);
    await vi.advanceTimersByTimeAsync(500); expect(transition.trigger(duplicate)).toBe(true);
    await vi.runAllTimersAsync(); expect(first).toHaveBeenCalledOnce(); expect(duplicate).toHaveBeenCalledOnce();
  });

  it("cancels before the scene change when the provider unmounts", async () => {
    const state = vi.fn(), change = vi.fn();
    const transition = createWorldTransition(state, vi.fn());
    transition.trigger(change); transition.dispose(); state.mockClear();
    await vi.runAllTimersAsync();
    expect(change).not.toHaveBeenCalled(); expect(state).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(transition.trigger(change)).toBe(false);
  });

  it.each(["resolve", "reject"])("ignores a late promise %s after unmount", async (outcome) => {
    const state = vi.fn(), error = vi.fn();
    let finish!: () => void;
    const promise = new Promise<void>((resolve, reject) => { finish = outcome === "resolve" ? resolve : () => reject(new Error("late")); });
    const transition = createWorldTransition(state, error);
    transition.trigger(() => promise); await vi.advanceTimersByTimeAsync(300);
    transition.dispose(); state.mockClear(); finish(); await vi.runAllTimersAsync();
    expect(state).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers from a rejected callback and allows the next transition", async () => {
    const state = vi.fn(), error = vi.fn(), failure = new Error("scene unavailable");
    const transition = createWorldTransition(state, error);
    transition.trigger(() => Promise.reject(failure));
    await vi.advanceTimersByTimeAsync(999); expect(error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(state).toHaveBeenLastCalledWith("idle"); expect(error).toHaveBeenCalledExactlyOnceWith(failure);
    const retry = vi.fn(); expect(transition.trigger(retry)).toBe(true);
    await vi.runAllTimersAsync(); expect(retry).toHaveBeenCalledOnce();
  });

  it("also recovers from a synchronous throw with no Error object", async () => {
    const state = vi.fn(), error = vi.fn();
    createWorldTransition(state, error).trigger(() => { throw undefined; });
    await vi.runAllTimersAsync(); expect(state).toHaveBeenLastCalledWith("idle"); expect(error).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("clears a hold timer when the provider unmounts at black", async () => {
    const state = vi.fn(); const transition = createWorldTransition(state, vi.fn());
    transition.trigger(vi.fn()); await vi.advanceTimersByTimeAsync(300);
    expect(vi.getTimerCount()).toBe(1); transition.dispose(); state.mockClear();
    await vi.runAllTimersAsync(); expect(state).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("skips the timed fades when reduced motion is requested", async () => {
    const state = vi.fn(), change = vi.fn();
    createWorldTransition(state, vi.fn()).trigger(change, true);
    await vi.runAllTimersAsync(); expect(change).toHaveBeenCalledOnce(); expect(state).toHaveBeenLastCalledWith("idle");
    expect(vi.getTimerCount()).toBe(0);
  });
});
