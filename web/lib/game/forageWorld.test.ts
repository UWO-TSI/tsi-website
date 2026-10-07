import { beforeEach, describe, expect, it } from "vitest";
import { HOLE_FILL, MAX_HOLES, addHole, holeFrame, holeOpacity, holesNow, pruneHoles, resetForageWorld } from "./forageWorld";

describe("a dug hole filling back in", () => {
  beforeEach(() => resetForageWorld());

  it("starts fresh (frame 0) and steps through the pack's frames as it fills, never back", () => {
    expect(holeFrame(0)).toBe(0);
    let last = 0;
    for (let t = 0; t < HOLE_FILL; t += 0.5) { const f = holeFrame(t); expect(f).toBeGreaterThanOrEqual(last); last = f; }
    expect(last).toBe(7);
    expect(holeFrame(HOLE_FILL * 0.5)).toBe(4);
  });

  it("is gone once filled, and isn't there before it was dug", () => {
    expect(holeFrame(HOLE_FILL)).toBe(-1);
    expect(holeFrame(-0.1)).toBe(-1);
    expect(holeOpacity(HOLE_FILL)).toBe(0);
  });

  it("fades out over the end of the fill instead of popping away", () => {
    expect(holeOpacity(0)).toBe(1);
    expect(holeOpacity(HOLE_FILL * 0.5)).toBe(1);
    const late = holeOpacity(HOLE_FILL * 0.95);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
    let prev = 1;
    for (let t = HOLE_FILL * 0.8; t < HOLE_FILL; t += 0.25) { const o = holeOpacity(t); expect(o).toBeLessThanOrEqual(prev + 1e-9); prev = o; }
  });

  it("keeps the holes on the world clock, forgets the filled ones and the oldest past the limit", () => {
    addHole({ id: "a", x: 0, y: 0, z: 0, t0: 100 });
    addHole({ id: "b", x: 2, y: 0, z: 0, t0: 150 });
    pruneHoles(160);
    expect(holesNow().map(h => h.id)).toEqual(["a", "b"]);
    pruneHoles(100 + HOLE_FILL + 1);
    expect(holesNow().map(h => h.id)).toEqual(["b"]);
    for (let i = 0; i < MAX_HOLES + 3; i++) addHole({ id: `h${i}`, x: i, y: 0, z: 0, t0: 200 });
    expect(holesNow()).toHaveLength(MAX_HOLES);
    expect(holesNow()[0].id).toBe(`h3`);
  });

  it("digs the same spot again as a fresh hole", () => {
    addHole({ id: "a", x: 0, y: 0, z: 0, t0: 100 });
    addHole({ id: "a", x: 0, y: 0, z: 0, t0: 140 });
    expect(holesNow()).toHaveLength(1);
    expect(holesNow()[0].t0).toBe(140);
  });
});
