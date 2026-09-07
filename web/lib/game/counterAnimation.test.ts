import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { animateCounter, type CounterFrame } from "./counterAnimation";

describe("HUD counter animation", () => {
  let frames: Map<number, FrameRequestCallback>;
  let now: number;
  let next: number;
  const tick = (time: number) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(time);
  };
  beforeEach(() => {
    frames = new Map(); now = 0; next = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("arrives at the target and clears a gain flash before stopping", () => {
    const update = vi.fn();
    animateCounter(0, 100, true, false, update);
    tick(350); expect(update).toHaveBeenLastCalledWith({ value: 88, flashing: true });
    tick(700); expect(update).toHaveBeenLastCalledWith({ value: 100, flashing: true });
    tick(900); expect(update).toHaveBeenLastCalledWith({ value: 100, flashing: false });
    expect(frames.size).toBe(0);
  });

  it("restarts from the visible value and clears a canceled gain on correction", () => {
    let visible: CounterFrame = { value: 0, flashing: false };
    const update = (frame: CounterFrame) => { visible = frame; };
    const stop = animateCounter(0, 100, true, false, update);
    tick(100);
    const before = visible.value;
    expect(before).toBeLessThan(80);
    stop();
    animateCounter(before, 80, false, false, update);
    tick(100); expect(visible).toEqual({ value: before, flashing: false });
    tick(450); expect(visible.value).toBeGreaterThan(before); expect(visible.value).toBeLessThanOrEqual(80);
    tick(800); expect(visible).toEqual({ value: 80, flashing: false }); expect(frames.size).toBe(0);
  });

  it("ignores even a queued stale callback after cancellation", () => {
    const update = vi.fn();
    const stop = animateCounter(0, 100, true, false, update);
    const stale = [...frames.values()][0];
    stop(); stale(200);
    expect(update).not.toHaveBeenCalled(); expect(frames.size).toBe(0);
  });

  it("shows the target in one frame without a flash when motion is reduced", () => {
    const update = vi.fn();
    animateCounter(0, 100, true, true, update);
    tick(0);
    expect(update).toHaveBeenCalledExactlyOnceWith({ value: 100, flashing: false });
    expect(frames.size).toBe(0);
  });

  it("does not schedule another frame if the update unmounts its consumer", () => {
    const stop = animateCounter(0, 100, true, false, () => stop());
    tick(100);
    expect(frames.size).toBe(0);
  });

  it("does not flash or keep scheduling an unchanged number", () => {
    const update = vi.fn();
    animateCounter(80, 80, true, false, update);
    tick(0); expect(update).toHaveBeenLastCalledWith({ value: 80, flashing: false });
    expect(frames.size).toBe(0);
  });

  it("decreases monotonically without celebrating a loss", () => {
    const values: number[] = [];
    animateCounter(100, 0, false, false, ({ value, flashing }) => { values.push(value); expect(flashing).toBe(false); });
    for (const time of [0, 100, 250, 400, 700]) tick(time);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(values.at(-1)).toBe(0); expect(frames.size).toBe(0);
  });
});
