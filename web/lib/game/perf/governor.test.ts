import { describe, expect, it } from "vitest";
import { GOVERNOR, Governor, LEVELS } from "./governor";

/** Feed `seconds` of frames at `ms` each; returns the levels it passed through. */
function run(g: Governor, ms: number, seconds: number) {
  const seen: number[] = [];
  for (let t = 0; t < seconds * 1000; t += ms) if (g.frame(ms)) seen.push(g.level);
  return seen;
}

describe("adaptive quality", () => {
  it("holds the chosen settings while the frame rate is fine", () => {
    const g = new Governor();
    expect(run(g, 16.7, 60)).toEqual([]);
    expect(run(g, 8, 60)).toEqual([]);
    expect(g.knobs).toBe(LEVELS[0]);
  });
  it("steps down one level after a few slow seconds, the least visible first", () => {
    const g = new Governor();
    expect(run(g, 30, GOVERNOR.downAfter - 0.5)).toEqual([]);
    expect(run(g, 30, 1)).toEqual([1]);
    expect(g.knobs).toMatchObject({ shadowScale: 0.5, renderScale: 1, particles: 1 });
    expect(run(g, 30, 12).slice(0, 3)).toEqual([2, 3, 4]);
    expect(LEVELS.findIndex(l => l.renderScale < 1)).toBe(LEVELS.length - 1); // resolution goes last
  });
  it("ignores single hitches", () => {
    const g = new Governor();
    for (let i = 0; i < 20; i++) { run(g, 10, 0.5); g.frame(600); g.frame(200); }
    expect(g.level).toBe(0);
  });
  it("steps back up after a while with headroom, and waits longer after a step it had to undo", () => {
    const g = new Governor();
    run(g, 30, 4);
    expect(g.level).toBe(1);
    expect(run(g, 10, GOVERNOR.upAfter + 1)).toEqual([0]);
    run(g, 30, 4); // the step up didn't hold: back down, and the next try waits twice as long
    expect(g.level).toBe(1);
    expect(run(g, 10, GOVERNOR.upAfter + 1)).toEqual([]);
    expect(run(g, 10, GOVERNOR.upAfter + 1)).toEqual([0]);
  });
  it("gives the detail back when stepping down bought nothing, and holds off a while", () => {
    const g = new Governor();
    const seen = run(g, 40, 30); // the same 40 ms frames whatever the level
    expect(seen).toEqual([1, 2, 3, 4, 0]); // 15 s in: every level on, no faster
    expect(run(g, 40, GOVERNOR.holdOff - 20)).toEqual([]); // holding off
    expect(run(g, 40, 30)[0]).toBe(1); // then it tries again
    // Where a level does help (a GPU-bound load), it stays down.
    const h = new Governor();
    for (let i = 0; i < 40; i++) run(h, h.level >= 2 ? 15 : 40, 1);
    expect(h.level).toBe(2);
  });
  it("resets to the chosen settings", () => {
    const g = new Governor();
    run(g, 40, 10);
    expect(g.level).toBeGreaterThan(0);
    g.reset();
    expect(g.knobs).toBe(LEVELS[0]);
  });
});
