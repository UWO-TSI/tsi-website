/**
 * The zone plan (specs/launch/terrain-v3.md): what a fresh generation must hold, whatever the plan's numbers become.
 * The committed world may differ (David sculpts it in the editor), so this generates its own.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldFromDisk } from "./disk";
import { H, blob, generateWorld, sideOf, stairs, strip } from "./generate";
import { terrainHeight } from "./terrain";

describe("the zone plan's shapes", () => {
  it("measure about the distance to their rim, positive inside", () => {
    const round = blob([0, 0], [10, 10, 10, 10]);
    expect(round(0, 0)).toBeCloseTo(10);
    expect(round(13, 0)).toBeCloseTo(-3);
    expect(strip([[0, 0], [10, 0]], 2)(5, 1)).toBeCloseTo(1);
    expect(sideOf([[0, 0], [0, 10]])(-3, 5)).toBeCloseTo(3); // west of a line running toward +z
  });

  it("step a staircase up to its top and no further", () => {
    expect(stairs(-3, 1.5, 5.5, 0.6, 4.5)).toBeCloseTo(0);
    expect(stairs(3, 1.5, 5.5, 0.6, 4.5)).toBeCloseTo(1.5);
    expect(stairs(8, 1.5, 5.5, 0.6, 4.5)).toBeCloseTo(3);
    expect(stairs(40, 1.5, 5.5, 0.6, 4.5)).toBeCloseTo(4.5);
  });
});

describe("a generated world", () => {
  const before = loadWorldFromDisk(join(__dirname, "../../../data/world"));
  const { world } = generateWorld(before.objects, []);
  const t = world.terrain, at = (x: number, z: number) => terrainHeight(t, x, z);
  const named = (name: string) => world.annotations.find(a => a.name === name);

  it("is the same twice", () => {
    const again = generateWorld(before.objects, []).world.terrain;
    expect(Buffer.from(again.heights.buffer).equals(Buffer.from(t.heights.buffer))).toBe(true);
    expect(Buffer.from(again.paint).equals(Buffer.from(t.paint))).toBe(true);
  });

  it("keeps David's grid: 384 by 552 cells, two samples a unit, the same sea", () => {
    expect([t.width, t.depth, t.res, t.originX, t.originZ, t.seaLevel]).toEqual([384, 552, 2, -192, -276, before.terrain.seaLevel]);
  });

  it("stands the village flat at its height, the quay low, the beach at the sea, the summit highest", () => {
    for (const [x, z] of [[10, 60], [1, 60], [10, 72]]) expect(at(x, z)).toBeCloseTo(H.village, 1);
    expect(Math.abs(at(45, 44))).toBeLessThan(0.3); // the quay beside the path
    expect(at(-15, 110)).toBeLessThan(1);
    expect(at(-2, -152)).toBeCloseTo(H.summit, 0);
    let top = -Infinity;
    for (const h of t.heights) top = Math.max(top, h);
    expect(top).toBeLessThan(t.heightRange[1]);
    expect(top).toBeGreaterThan(H.summit);
  });

  it("puts the north island a wide strait off the meadow: no land between them for 30 units", () => {
    for (const z of [-60, -10, 20, 70]) {
      let wet = 0, widest = 0;
      for (let x = -140; x <= -70; x += 0.5) { wet = at(x, z) <= t.seaLevel ? wet + 0.5 : 0; widest = Math.max(widest, wet); }
      expect(widest, `z ${z}`).toBeGreaterThan(30);
    }
  });

  it("tags every zone closed at launch, and the lighthouse islet small and well off the wharf", () => {
    for (const name of ["Meadow", "Mountain", "Ruins in forest", "North island", "Islands biome: boat later", "Cave mouth", "Oracle Temple: the climb is the class pilgrimage"]) {
      expect(named(name)?.cells.length, name).toBeGreaterThan(0);
    }
    const islet = named("Lighthouse islet")!.cells;
    expect(islet.length).toBeLessThan(120);
    for (const [cx, cz] of islet) expect(Math.hypot(cx + t.originX - 49, cz + t.originZ - 50)).toBeGreaterThan(50);
  });
}, 60_000);
