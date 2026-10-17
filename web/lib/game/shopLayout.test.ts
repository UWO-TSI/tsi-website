import { describe, expect, it } from "vitest";
import {
  ITEM_KINDS, SHOP_COUNTER_SPOT, SHOP_DOOR, SHOP_EXIT, SHOP_EXIT_RANGE, SHOP_FIXTURES, SHOP_PATHS, SHOP_PENDANT, SHOP_ROOM,
  SHOP_SLOTS, SHOP_SOLIDS, SHOP_SPAWN, SHOP_STRIPS, SHOP_TAG_RANGE, SHOP_WALK_MARGIN, constrainShop, shopSolidAt, shopWalkable,
  type ItemKind,
} from "./shopLayout";
import { KEEPER_POSTS } from "./keepers";

const { halfW, halfD, height } = SHOP_ROOM;
const fixture = (id: string) => SHOP_FIXTURES.find(f => f.id === id)!;

/** Every cell the walker can reach from the spawn (a 0.1 grid over its bounds). */
const STEP = 0.1;
const reach = (() => {
  const mx = halfW - SHOP_WALK_MARGIN, mz = halfD - SHOP_WALK_MARGIN;
  const nx = Math.round((2 * mx) / STEP) + 1, nz = Math.round((2 * mz) / STEP) + 1;
  const seen = new Uint8Array(nx * nz);
  const at = (i: number, j: number) => [-mx + i * STEP, -mz + j * STEP] as const;
  const i0 = Math.round((SHOP_SPAWN[0] + mx) / STEP), j0 = Math.round((SHOP_SPAWN[1] + mz) / STEP);
  const queue = [[i0, j0]];
  seen[j0 * nx + i0] = 1;
  while (queue.length) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= nz || seen[c * nx + a]) continue;
      if (!shopWalkable(...at(a, c))) continue;
      seen[c * nx + a] = 1;
      queue.push([a, c]);
    }
  }
  const cells: [number, number][] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (seen[j * nx + i]) cells.push([...at(i, j)]);
  return cells;
})();
const nearestReach = (x: number, z: number) => Math.min(...reach.map(([a, c]) => Math.hypot(a - x, c - z)));

describe("shop layout (specs/interiors/shop.md, phase 1)", () => {
  it("keeps every block inside the room and under the ceiling", () => {
    for (const f of SHOP_FIXTURES) for (const { at, size } of f.blocks) {
      expect(Math.abs(at[0]) + size[0] / 2, f.id).toBeLessThanOrEqual(halfW + 1e-9);
      expect(Math.abs(at[2]) + size[2] / 2, f.id).toBeLessThanOrEqual(halfD + 1e-9);
      expect(at[1] + size[1], f.id).toBeLessThanOrEqual(height + 1e-9);
    }
    for (const s of SHOP_SLOTS) expect(Math.abs(s.at[0]) + s.size[0] / 2, s.id).toBeLessThanOrEqual(halfW);
  });

  it("arrives a step inside the door, clear of everything and outside the exit prompt", () => {
    expect(shopWalkable(...SHOP_SPAWN)).toBe(true);
    expect(Math.abs(SHOP_SPAWN[0] - SHOP_DOOR.x)).toBeLessThan(SHOP_DOOR.half);
    expect(Math.hypot(SHOP_SPAWN[0] - SHOP_EXIT[0], SHOP_SPAWN[1] - SHOP_EXIT[1])).toBeGreaterThan(SHOP_EXIT_RANGE);
    expect(nearestReach(...SHOP_EXIT)).toBeLessThan(SHOP_EXIT_RANGE - 0.5);
  });

  it("runs a clear aisle from the door to the counter, at least 2.4 wide", () => {
    for (let z = SHOP_SPAWN[1]; z <= SHOP_COUNTER_SPOT[1]; z += 0.05) for (const x of [-1.2, 0, 1.2]) expect(shopWalkable(x, z, 0), `${x}, ${z}`).toBe(true);
    expect(shopWalkable(...SHOP_COUNTER_SPOT)).toBe(true);
    expect(nearestReach(...SHOP_COUNTER_SPOT)).toBeLessThan(0.08);
  });

  it("walks every path on the floor plan", () => {
    for (const p of SHOP_PATHS) for (let k = 1; k < p.points.length; k++) {
      const [a, c] = p.points[k - 1], [d, e] = p.points[k], n = Math.ceil(Math.hypot(d - a, e - c) / 0.05);
      for (let t = 0; t <= n; t++) {
        const x = a + ((d - a) * t) / n, z = c + ((e - c) * t) / n;
        expect(shopWalkable(x, z), `${p.id} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true);
        expect(nearestReach(x, z), p.id).toBeLessThan(0.08);
      }
    }
  });

  it("puts the two sections either side of the aisle, apart", () => {
    const zoneX = (zone: "items" | "merch") => SHOP_FIXTURES.filter(f => f.zone === zone).flatMap(f => f.blocks.map(({ at, size }) => [at[0] - size[0] / 2, at[0] + size[0] / 2]));
    const items = zoneX("items"), merch = zoneX("merch");
    expect(Math.min(...items.map(([a]) => a))).toBeGreaterThan(1.2);
    expect(Math.max(...merch.map(([, c]) => c))).toBeLessThan(-1.2);
    for (const s of SHOP_SLOTS) expect(Math.sign(s.at[0]), s.id).toBe(ITEM_KINDS[s.kind].zone === "items" ? 1 : -1);
  });

  it("shows every kind of item, each where you can walk up to it", () => {
    const kinds = Object.keys(ITEM_KINDS) as ItemKind[];
    for (const k of kinds) expect(SHOP_SLOTS.some(s => s.kind === k), k).toBe(true);
    for (const s of SHOP_SLOTS) {
      expect(SHOP_FIXTURES.some(f => f.id === s.fixture), s.id).toBe(true);
      expect(nearestReach(s.at[0], s.at[2]), s.id).toBeLessThan(SHOP_TAG_RANGE);
    }
    expect(new Set(SHOP_SLOTS.map(s => s.id)).size).toBe(SHOP_SLOTS.length);
  });

  it("closes the counter's ends: the shopkeeper's side is out of reach, and they're seen over it", () => {
    const [, , cz] = fixture("counter").blocks[0].at, back = cz + fixture("counter").blocks[0].size[2] / 2;
    const front = cz - fixture("counter").blocks[0].size[2] / 2, ledge = fixture("counter").blocks[1].at[1] + fixture("counter").blocks[1].size[1];
    // The walking camera (interiorShared snapInteriorCamera): 8.4 up and 7.2 behind you at the counter spot.
    const camZ = SHOP_COUNTER_SPOT[1] - 7.2, camY = 8.4, hips = 0.55;
    for (const s of KEEPER_POSTS.shop.stations) {
      expect(s.at[1]).toBeGreaterThan(back);
      expect(Math.abs(s.at[0])).toBeLessThan(1.6 - 0.2);
      expect(nearestReach(...s.at)).toBeGreaterThan(0.5);
      expect(hips + ((camY - hips) * (s.at[1] - front)) / (s.at[1] - camZ)).toBeGreaterThan(ledge);
    }
    // Nothing reachable behind the counter.
    expect(reach.some(([x, z]) => Math.abs(x) < 1.6 && z > back)).toBe(false);
  });

  it("slides along what it meets and never ends a step inside anything", () => {
    const [x, z] = constrainShop(0, 2.3, 0, 3.2);
    expect(z).toBeLessThan(2.7);
    expect(x).toBe(0);
    const [sx, sz] = constrainShop(2.0, 0.6, 2.4, 1.0);   // into the tools table's corner: slides along its end
    expect(shopSolidAt(sx, sz)).toBe(false);
    expect(sx).toBeGreaterThan(2.0);
    for (const [cx, cz] of SHOP_SOLIDS) expect(shopSolidAt(cx, cz, 0)).toBe(true);
  });

  it("lights edges of real fixtures, and hangs the pendant over the counter", () => {
    for (const s of SHOP_STRIPS) expect(SHOP_FIXTURES.some(f => f.id === s.fixture)).toBe(true);
    const counter = fixture("counter").blocks[0];
    expect(SHOP_PENDANT.x1 - SHOP_PENDANT.x0).toBeLessThanOrEqual(counter.size[0]);
    expect(Math.abs(SHOP_PENDANT.z - counter.at[2])).toBeLessThan(counter.size[2] / 2);
    expect(SHOP_PENDANT.y).toBeGreaterThan(2.4);
  });
});
