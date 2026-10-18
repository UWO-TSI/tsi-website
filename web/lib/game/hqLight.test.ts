import { describe, expect, it } from "vitest";
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM } from "./hqLayout";
import { hqPools, poolCorners } from "./hqLight";

describe("HQ's faked light", () => {
  const pools = hqPools();

  it("gives every lamp a warm pool on its own floor, and a table lamp one on its top", () => {
    for (const lamp of HQ.lamps) {
      const floor = pools.find(p => p.id === `${lamp.id}:floor`)!;
      expect(floor.level).toBe(lamp.level);
      expect(floor.at[1]).toBeCloseTo(lamp.level * F + 0.045);
      expect(floor.half[0]).toBe(lamp.pool);
      if (lamp.on > 0) expect(pools.find(p => p.id === `${lamp.id}:top`)!.at[1]).toBeCloseTo(lamp.level * F + lamp.on + 0.006);
    }
  });

  it("puts a track spot's light where it's aimed, on the back wall or the top it picks out (never a bare-floor stain)", () => {
    const spots = HQ.tracks.flatMap(t => t.spots.map(s => ({ s, floor: t.from[1] < F || s.aim[1] < F - 0.2 ? 0 : F })));
    const lit = pools.filter(p => p.id.startsWith("track:"));
    expect(lit.length).toBe(spots.filter(({ s, floor }) => s.aim[2] > HQ_ROOM.halfD - 0.7 || s.aim[1] - floor >= 0.5).length);
    expect(lit.length).toBeGreaterThan(spots.length / 2);
    for (const p of lit) {
      if (p.face === "-z") expect(p.at[2]).toBeGreaterThan(HQ_ROOM.halfD - 0.7);
      else expect(p.face).toBe("up");
    }
    // the upstairs art is lit on the upper floor; the library under the mezzanine on the ground
    expect(lit.some(p => p.level === 1 && p.face === "-z")).toBe(true);
    expect(lit.some(p => p.level === 0 && p.face === "-z")).toBe(true);
  });

  it("throws the aquarium's blue on the lounge in front of the glass", () => {
    const a = HQ.aquarium, near = pools.find(p => p.id === "aquarium:near")!;
    expect(near.at[0] + near.half[0]).toBeLessThanOrEqual(a.x0 + 1e-9);
    expect(near.at[2]).toBeCloseTo((a.z0 + a.z1) / 2);
  });

  it("keeps every pool inside the room", () => {
    for (const p of pools) for (const [x, y, z] of poolCorners(p)) {
      expect(Math.abs(x)).toBeLessThanOrEqual(HQ_ROOM.halfW);
      expect(Math.abs(z)).toBeLessThanOrEqual(HQ_ROOM.halfD);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(2 * F);
    }
  });
});
