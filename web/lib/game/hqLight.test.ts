import { describe, expect, it } from "vitest";
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM, walkable } from "./hqLayout";
import { hqPools, poolQuad } from "./hqLight";

describe("HQ's faked light", () => {
  const pools = hqPools();
  const { halfW: W, halfD: D } = HQ_ROOM;

  it("gives every lamp a warm pool on its own floor (and part), and a table lamp one on its top", () => {
    for (const lamp of HQ.lamps) {
      const floor = pools.find(p => p.id === `${lamp.id}:floor`)!;
      expect(floor.level).toBe(lamp.level);
      expect(floor.part).toBe(lamp.level ? lamp.part ?? 0 : 0);
      expect(floor.at[1]).toBeCloseTo(lamp.level * F + 0.045);
      expect(floor.half[0]).toBe(lamp.pool);
      if (lamp.on > 0) expect(pools.find(p => p.id === `${lamp.id}:top`)!.at[1]).toBeCloseTo(lamp.level * F + lamp.on + 0.006);
    }
  });

  it("puts a track spot's light where it's aimed, on the wall or the top it picks out (never a bare-floor stain)", () => {
    const lit = pools.filter(p => p.id.startsWith("track:"));
    const spots = HQ.tracks.flatMap(t => t.spots);
    expect(lit.length).toBeGreaterThan(spots.length / 3);
    for (const p of lit) {
      const [x, , z] = p.at;
      if (p.face === "-z") expect(z).toBeGreaterThan(D - 0.7);
      else if (p.face === "+z") expect(z).toBeLessThan(-D + 0.7);
      else if (p.face === "-x") expect(x).toBeGreaterThan(W - 0.7);
      else if (p.face === "+x") expect(x).toBeLessThan(-W + 0.7);
      else expect(p.at[1] - p.level * F).toBeGreaterThanOrEqual(0.45);
    }
    // the library on the left wall and the board on the right, downstairs; the art on the front wall over the bridge
    expect(lit.some(p => p.level === 0 && p.face === "-x")).toBe(true);
    expect(lit.some(p => p.level === 0 && p.face === "+x")).toBe(true);
    expect(lit.some(p => p.level === 1 && p.face === "+z" && p.part === 0)).toBe(true);
  });

  it("throws the aquarium's blue on the lounge in front of the glass", () => {
    const a = HQ.aquarium, near = pools.find(p => p.id === "aquarium:near")!;
    expect(near.at[2] + near.half[1]).toBeLessThanOrEqual(a.z0 + 1e-9);
    expect(near.at[0]).toBeCloseTo((a.x0 + a.x1) / 2);
  });

  it("leaves no dark corner at night: everywhere you can stand by a wall has a lamp, a sconce or a spot's wash near it (David, 2026-10-22)", () => {
    for (const level of [0, 1] as const) {
      const lights = [...HQ.lamps.filter(l => l.level === level).map(l => [l.light[0], l.light[2]]),
        ...pools.filter(p => p.level === level && p.id.startsWith("track:")).map(p => [p.at[0], p.at[2]])];
      for (let x = -W + 0.7; x <= W - 0.7 + 1e-9; x += 0.5) for (let z = -D + 0.7; z <= D - 0.7 + 1e-9; z += 0.5) {
        if (Math.min(W - Math.abs(x), D - Math.abs(z)) > 1.6 || !walkable(HQ, level, x, z)) continue;
        const near = Math.min(...lights.map(([lx, lz]) => Math.hypot(lx - x, lz - z)));
        expect(near, `level ${level} at (${x.toFixed(1)}, ${z.toFixed(1)})`).toBeLessThan(3.6);
      }
    }
  });

  it("fades each pool softly to its edge, cut to the room where a lamp stands in a corner", () => {
    for (const p of pools) {
      const { uvs } = poolQuad(p);
      for (const [u, v] of uvs) { expect(Math.abs(u)).toBeLessThanOrEqual(1 + 1e-9); expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9); }
    }
    const corner = pools.find(p => p.id === "work-floor:floor")!, q = poolQuad(corner);
    expect(Math.max(...q.uvs.map(([u]) => u))).toBeLessThan(1);               // cut at the left wall, its fade intact
  });

  it("keeps every pool inside the room", () => {
    for (const p of pools) for (const [x, y, z] of poolQuad(p).corners) {
      expect(Math.abs(x)).toBeLessThanOrEqual(W);
      expect(Math.abs(z)).toBeLessThanOrEqual(D);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(2 * F);
    }
  });
});
