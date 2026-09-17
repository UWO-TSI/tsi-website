import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startIntroSweep } from "./introSweep";

describe("first-visit camera sweep", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const setup = () => ({ camera: { smoothTime: 0.25, setLookAt: vi.fn() }, active: vi.fn(), viewed: vi.fn(), events: new EventTarget() });

  it("uses caller-supplied applicant poses for descent and skip", () => {
    const { camera, active, viewed, events } = setup();
    const poses = { start: [-4, 36, -9, 0, 0, -5] as [number, number, number, number, number, number], end: [0, 8.1, -16.3, 0, 0.7, -5.5] as [number, number, number, number, number, number] };
    startIntroSweep(camera, active, viewed, events, poses);
    expect(camera.setLookAt).toHaveBeenNthCalledWith(1, ...poses.start, false);
    events.dispatchEvent(new Event("pointerdown"));
    expect(camera.setLookAt).toHaveBeenLastCalledWith(...poses.end, true);
    vi.advanceTimersByTime(450);
    expect(active).toHaveBeenLastCalledWith(false);
  });

  it("records a completed visit and restores the original camera smoothing", () => {
    const { camera, active, viewed, events } = setup();
    startIntroSweep(camera, active, viewed, events);
    expect(camera.setLookAt.mock.calls).toEqual([[-14, 23, -43, 0, -2, -10, false], [0, 19.5, -35, 0, 1.5, -15, true]]);
    expect(camera.smoothTime).toBe(2.6); expect(active).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(6499); expect(viewed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(viewed).toHaveBeenCalledOnce(); expect(active).toHaveBeenLastCalledWith(false);
    expect(camera.smoothTime).toBe(0.25); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["keydown", "pointerdown"])("handles repeated %s as one deliberate skip", (event) => {
    const { camera, active, viewed, events } = setup();
    startIntroSweep(camera, active, viewed, events);
    for (let i = 0; i < 10; i++) events.dispatchEvent(new Event(event));
    expect(camera.setLookAt).toHaveBeenCalledTimes(3); expect(viewed).toHaveBeenCalledOnce(); expect(camera.smoothTime).toBe(0.4);
    expect(vi.getTimerCount()).toBe(2);
    vi.advanceTimersByTime(450); expect(active).toHaveBeenLastCalledWith(false); expect(camera.smoothTime).toBe(0.25);
    expect(vi.getTimerCount()).toBe(0); expect(viewed).toHaveBeenCalledOnce();
  });

  it("does not mark an interrupted mount as viewed or leave input listeners behind", () => {
    const { camera, active, viewed, events } = setup();
    const stop = startIntroSweep(camera, active, viewed, events);
    vi.advanceTimersByTime(100); stop(); stop();
    events.dispatchEvent(new Event("keydown")); events.dispatchEvent(new Event("pointerdown")); vi.runAllTimers();
    expect(camera.setLookAt).toHaveBeenCalledTimes(2); expect(camera.smoothTime).toBe(0.25);
    expect(viewed).not.toHaveBeenCalled(); expect(active.mock.calls).toEqual([[true], [false]]); expect(vi.getTimerCount()).toBe(0);
  });

  it("clears both timers when unmounted during a skip and keeps the deliberate dismissal", () => {
    const { camera, active, viewed, events } = setup();
    const stop = startIntroSweep(camera, active, viewed, events);
    events.dispatchEvent(new Event("pointerdown")); stop(); vi.runAllTimers();
    expect(viewed).toHaveBeenCalledOnce(); expect(active.mock.calls).toEqual([[true], [false]]);
    expect(camera.smoothTime).toBe(0.25); expect(vi.getTimerCount()).toBe(0);
  });

  it("can restart after a Strict Mode setup-cleanup cycle without duplicate listeners", () => {
    const { camera, active, viewed, events } = setup();
    startIntroSweep(camera, active, viewed, events)();
    startIntroSweep(camera, active, viewed, events);
    events.dispatchEvent(new Event("keydown"));
    expect(camera.setLookAt).toHaveBeenCalledTimes(5); expect(viewed).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(450); expect(camera.smoothTime).toBe(0.25); expect(vi.getTimerCount()).toBe(0);
  });
});
