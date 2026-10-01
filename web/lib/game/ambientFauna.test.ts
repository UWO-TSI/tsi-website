import { describe, expect, it } from "vitest";
import { village, objectsOf } from "./villageMap";
import { villageIsland } from "./defaultIsland";
import { villageWater } from "./fishingSpots";
import {
  FLYERS, butterflyAt, crabStep, crabsFor, dragonflyAt, flyersFor, flyingWeather, gullAnchors, leapsAt, newCrabState, newFlyerPose, outWeight, seaAt,
  type FaunaSite, type Leap,
} from "./ambientFauna";
import { isWater, surfaceAt, worldToCellX, worldToCellZ } from "./grid";

const v = village(), island = villageIsland(v);
const site: FaunaSite = { map: v.map, flowers: objectsOf("flower", v).map(o => [o.x, o.z] as const), water: villageWater(v).classify };

describe("ambient fauna", () => {
  it("puts butterflies over the flowers and dragonflies over river and pond edges, by season", () => {
    const summer = flyersFor(site, "summer");
    expect(summer.filter(f => f.species.kind === "butterfly").length).toBeGreaterThan(4);
    expect(summer.filter(f => f.species.kind === "dragonfly").length).toBeGreaterThan(2);
    for (const f of summer) expect(f.species.seasons).toContain("summer");
    // Winter: none out.
    expect(flyersFor(site, "winter")).toEqual([]);
    // Dragonfly patches are over fresh water's edge, never the sea.
    for (const f of summer.filter(f => f.species.kind === "dragonfly")) for (const [x, z] of f.patch) expect(site.water(x, z)).not.toBe("sea");
    // The same on every client.
    expect(flyersFor(site, "summer")).toEqual(summer);
  });

  it("comes out by the hour and goes in the rain, easing both ways", () => {
    const common = FLYERS.find(s => s.key === "common")!;
    expect(outWeight(12, common.hours, 0)).toBe(1);
    expect(outWeight(3, common.hours, 0)).toBe(0);
    expect(outWeight(7.1, common.hours, 0)).toBeGreaterThan(0);
    expect(outWeight(7.1, common.hours, 0)).toBeLessThan(1);
    // Wrapping past midnight.
    expect(outWeight(23.5, [22, 2], 0)).toBe(1);
    expect(flyingWeather("rain")).toBe(false);
    expect(flyingWeather("snow")).toBe(false);
    expect(flyingWeather("clear")).toBe(true);
  });

  it("flies a butterfly flower to flower as a function of world time, and lifts it away when it's not out", () => {
    const [f] = flyersFor(site, "summer"), a = newFlyerPose(), b = newFlyerPose();
    butterflyAt(f, 5000, 1, island.ground, a);
    butterflyAt(f, 5000, 1, island.ground, b);
    expect(b).toEqual(a);
    // Never far from its patch while out; continuous over a frame.
    const near = (x: number, z: number) => f.patch.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4);
    let px = NaN, pz = NaN;
    for (let t = 1000; t < 1300; t += 1 / 60) {
      butterflyAt(f, t, 1, island.ground, a);
      expect(near(a.x, a.z)).toBe(true);
      if (!Number.isNaN(px)) expect(Math.hypot(a.x - px, a.z - pz)).toBeLessThan(0.12);
      px = a.x; pz = a.z;
    }
    butterflyAt(f, 1000, 0, island.ground, b);
    expect(b.scale).toBe(0);
    expect(b.y).toBeGreaterThan(a.y + 3);
  });

  it("darts a dragonfly between hovers along the water", () => {
    const d = flyersFor(site, "summer").find(f => f.species.kind === "dragonfly")!, p = newFlyerPose();
    const speeds: number[] = [];
    let px = NaN, pz = NaN;
    for (let t = 2000; t < 2010; t += 0.05) {
      dragonflyAt(d, t, 1, island.ground, p);
      if (!Number.isNaN(px)) speeds.push(Math.hypot(p.x - px, p.z - pz) / 0.05);
      px = p.x; pz = p.z;
    }
    // Mostly still (hovering), with quick darts.
    expect(speeds.filter(s => s < 1).length).toBeGreaterThan(speeds.length * 0.6);
    expect(Math.max(...speeds)).toBeGreaterThan(2);
  });

  it("keeps crabs on the beach by the sea, spread out", () => {
    const crabs = crabsFor(site);
    expect(crabs.length).toBeGreaterThanOrEqual(4);
    for (const c of crabs) {
      expect(island.standable(c.home[0], c.home[1])).toBe(true);
      expect(site.water(c.home[0] + c.sea[0] * 1.2, c.home[1] + c.sea[1] * 1.2)).toBe("sea");
      for (const o of crabs) if (o !== c) expect(Math.hypot(o.home[0] - c.home[0], o.home[1] - c.home[1])).toBeGreaterThanOrEqual(3);
    }
  });

  it("scuttles a crab away from an avatar that comes close, digs it in, and brings it back up once it's quiet", () => {
    const [c] = crabsFor(site), s = newCrabState(c);
    const ax = c.home[0] + 1, az = c.home[1];
    let t = 100;
    crabStep(c, s, t, 1 / 60, ax, az, island.standable);
    expect(s.fleeT).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 60; i++) crabStep(c, s, (t += 1 / 60), 1 / 60, ax, az, island.standable);
    expect(Math.hypot(s.x - ax, s.z - az)).toBeGreaterThan(1.5);
    for (let i = 0; i < 120; i++) crabStep(c, s, (t += 1 / 60), 1 / 60, ax, az, island.standable);
    expect(s.sink).toBeGreaterThan(0.9);
    // The avatar leaves; after the quiet spell it comes up.
    for (let i = 0; i < 60 * 12; i++) crabStep(c, s, (t += 1 / 60), 1 / 60, NaN, NaN, island.standable);
    expect(s.sink).toBeLessThan(0.05);
  });

  it("leaps fish only in open sea, on the same seeded schedule for everyone", () => {
    const buf = Array.from({ length: 8 }, (): Leap => ({ x: 0, z: 0, yaw: 0, u: 0, model: 0, t0: 0, id: 0 }));
    const isSea = (x: number, z: number) => seaAt(site, x, z);
    let seen = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const n = leapsAt(t, 0, -25, 30, isSea, buf);
      for (let i = 0; i < n; i++) {
        seen++;
        const { x, z } = buf[i], cx = worldToCellX(v.map, x), cz = worldToCellZ(v.map, z);
        expect(site.water(x, z)).toBe("sea");
        if (cx >= 0 && cz >= 0 && cx < v.map.width && cz < v.map.depth) expect(isWater(surfaceAt(v.map, cx, cz))).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(10);
    const a = buf.map(l => ({ ...l })), n1 = leapsAt(321.5, 0, -25, 30, isSea, buf), first = buf.slice(0, n1).map(l => ({ ...l }));
    void a;
    expect(leapsAt(321.5, 0, -25, 30, isSea, buf)).toBe(n1);
    expect(buf.slice(0, n1)).toEqual(first);
  });

  it("circles gulls over the sea off the sides and the far shore, never the near shore the camera stands over", () => {
    const g = gullAnchors(v.bounds, [[-24, 12]]);
    expect(g).toHaveLength(5);
    for (const [x, z] of g) expect(seaAt(site, x, z)).toBe(true);
    for (const [, z] of g) expect(z).toBeGreaterThan(v.bounds.minZ);
  });
});
