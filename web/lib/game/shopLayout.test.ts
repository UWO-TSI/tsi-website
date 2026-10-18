import { describe, expect, it } from "vitest";
import {
  ITEM_KINDS, SHOP_BOOTHS, SHOP_BOOTH_LIST, SHOP_COUNTER_SPOT, SHOP_DOOR, SHOP_MEZZ, SHOP_EXIT, SHOP_EXIT_RANGE, SHOP_FIXTURES, SHOP_FLOOR_HEIGHT, SHOP_PATHS, SHOP_PENDANT,
  SHOP_ROOM, SHOP_SLAB, SHOP_SLOTS, SHOP_SOLIDS, SHOP_SPAWN, SHOP_STAIR, SHOP_STRIPS, SHOP_TAG_RANGE, SHOP_WALK_MARGIN, STAIR_LANE,
  createShopWalker, shopLayoutJson, shopSolidAt, shopWalkable, stairHeight, type ItemKind, type Level, type ShopWalker,
} from "./shopLayout";
import { KEEPER_POSTS } from "./keepers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { halfW, halfD } = SHOP_ROOM;
const F = SHOP_FLOOR_HEIGHT, S = SHOP_STAIR;
const fixture = (id: string) => SHOP_FIXTURES.find(f => f.id === id)!;
const LANE_X = (STAIR_LANE[0] + STAIR_LANE[1]) / 2;
const HEAD = [LANE_X, S.z1 + 0.6] as [number, number];

/** Every cell the walker can reach on a floor from a start (a 0.1 grid over its bounds). */
const STEP = 0.1;
function reachFrom(level: Level, start: [number, number]) {
  const mx = halfW - SHOP_WALK_MARGIN, mz = halfD - SHOP_WALK_MARGIN;
  const nx = Math.round((2 * mx) / STEP) + 1, nz = Math.round((2 * mz) / STEP) + 1;
  const seen = new Uint8Array(nx * nz);
  const at = (i: number, j: number) => [-mx + i * STEP, -mz + j * STEP] as const;
  const i0 = Math.round((start[0] + mx) / STEP), j0 = Math.round((start[1] + mz) / STEP);
  expect(shopWalkable(level, ...at(i0, j0)), `start ${start} on floor ${level}`).toBe(true);
  const queue = [[i0, j0]];
  seen[j0 * nx + i0] = 1;
  while (queue.length) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= nz || seen[c * nx + a] || !shopWalkable(level, ...at(a, c))) continue;
      seen[c * nx + a] = 1;
      queue.push([a, c]);
    }
  }
  const cells: [number, number][] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (seen[j * nx + i]) cells.push([...at(i, j)]);
  return cells;
}
const reach: Record<Level, [number, number][]> = { 0: reachFrom(0, SHOP_SPAWN), 1: reachFrom(1, HEAD) };
const nearestReach = (level: Level, x: number, z: number) => Math.min(...reach[level].map(([a, c]) => Math.hypot(a - x, c - z)));

/** Walk the room's walker toward each point in turn, as the interior walker does (its clamp to the walls, then the walker). */
function walk(w: ShopWalker, from: [number, number], ...to: [number, number][]): [number, number] {
  let [x, z] = from;
  const m = halfW - SHOP_WALK_MARGIN, n = halfD - SHOP_WALK_MARGIN;
  for (const [tx, tz] of to) for (let k = 0; k < 2000; k++) {
    const d = Math.hypot(tx - x, tz - z);
    if (d < 0.05) break;
    const s = Math.min(d, 4.6 / 60);
    const nx = Math.min(m, Math.max(-m, x + ((tx - x) / d) * s)), nz = Math.min(n, Math.max(-n, z + ((tz - z) / d) * s));
    const c = w.constrain(x, z, nx, nz);
    if (Math.hypot(c[0] - x, c[1] - z) < 1e-6) break;   // stuck
    [x, z] = [c[0], c[1]];
  }
  return [x, z];
}

describe("shop layout, two floors: the ground floor and the mezzanine (specs/interiors/shop.md, phase 1)", () => {
  it("keeps every block inside the room and under its floor's ceiling", () => {
    for (const f of SHOP_FIXTURES) for (const { at, size } of f.blocks) {
      expect(Math.abs(at[0]) + size[0] / 2, f.id).toBeLessThanOrEqual(halfW + 1e-9);
      expect(Math.abs(at[2]) + size[2] / 2, f.id).toBeLessThanOrEqual(halfD + 1e-9);
      // (The flight's top railing post rises through the stairwell to meet the railing upstairs.)
      expect(at[1] + size[1], f.id).toBeLessThanOrEqual(F + (f.id === "stair" ? 1 : 1e-9));
      // Downstairs, nothing pokes into the slab, except the flight that climbs through the stairwell.
      if (f.level === 0 && f.id !== "stair") expect(at[1] + size[1], f.id).toBeLessThanOrEqual(F - SHOP_SLAB + 1e-9);
    }
    for (const s of SHOP_SLOTS) expect(Math.abs(s.at[0]) + s.size[0] / 2, s.id).toBeLessThanOrEqual(halfW);
  });

  it("arrives a step inside the door, clear of everything and outside the exit prompt", () => {
    expect(shopWalkable(0, ...SHOP_SPAWN)).toBe(true);
    expect(Math.abs(SHOP_SPAWN[0] - SHOP_DOOR.x)).toBeLessThan(SHOP_DOOR.half);
    expect(Math.hypot(SHOP_SPAWN[0] - SHOP_EXIT[0], SHOP_SPAWN[1] - SHOP_EXIT[1])).toBeGreaterThan(SHOP_EXIT_RANGE);
    expect(nearestReach(0, ...SHOP_EXIT)).toBeLessThan(SHOP_EXIT_RANGE - 0.5);
  });

  it("runs a clear aisle from the door to the counter, at least 2.4 wide", () => {
    for (let z = SHOP_SPAWN[1]; z <= SHOP_COUNTER_SPOT[1]; z += 0.05) for (const x of [-1.2, 0, 1.2]) expect(shopWalkable(0, x, z, 0), `${x}, ${z}`).toBe(true);
    expect(nearestReach(0, ...SHOP_COUNTER_SPOT)).toBeLessThan(0.08);
  });

  it("walks every path on each floor", () => {
    for (const p of SHOP_PATHS) {
      if (p.level === "stair") continue;
      const level = p.level;
      for (let k = 1; k < p.points.length; k++) {
        const [a, c] = p.points[k - 1], [d, e] = p.points[k], n = Math.ceil(Math.hypot(d - a, e - c) / 0.05);
        for (let t = 0; t <= n; t++) {
          const x = a + ((d - a) * t) / n, z = c + ((e - c) * t) / n;
          expect(shopWalkable(level, x, z), `${p.id} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(true);
          expect(nearestReach(level, x, z), p.id).toBeLessThan(0.08);
        }
      }
    }
  });

  it("climbs from the door to the merch wall and back down by the stair", () => {
    const w = createShopWalker();
    const foot = walk(w, SHOP_SPAWN, [LANE_X, S.z0 - 0.5]);
    expect(w.zone).toBe("ground");
    expect(Math.hypot(foot[0] - LANE_X, foot[1] - (S.z0 - 0.5))).toBeLessThan(0.06);
    // Halfway up: on the flight, at half height, the mezzanine showing.
    const mid = walk(w, foot, [LANE_X, (S.z0 + S.z1) / 2]);
    expect(w.zone).toBe("stair");
    expect(w.height).toBeCloseTo(stairHeight(mid[1]), 6);
    expect(w.height).toBeCloseTo(F / 2, 1);
    expect(w.upperShown).toBe(true);
    const top = walk(w, mid, HEAD);
    expect(w.zone).toBe("upper");
    expect(w.height).toBe(F);
    expect(Math.hypot(top[0] - HEAD[0], top[1] - HEAD[1])).toBeLessThan(0.06);
    // And on to the merch wall, then all the way back down to the door.
    walk(w, top, [3, 3.6]);
    expect(w.zone).toBe("upper");
    expect(w.upperShown).toBe(true);
    const back = walk(w, [3, 3.6], HEAD, [LANE_X, S.z0 - 0.5], SHOP_SPAWN);
    expect(w.zone).toBe("ground");
    expect(w.height).toBe(0);
    expect(Math.hypot(back[0] - SHOP_SPAWN[0], back[1] - SHOP_SPAWN[1])).toBeLessThan(0.06);
  });

  it("shows the merch level from the door, cuts it away once you're under it, and never flickers at its edge", () => {
    const w = createShopWalker();
    expect(w.upperShown).toBe(true);
    let p = walk(w, SHOP_SPAWN, [0, -2.5]);
    expect(w.upperShown).toBe(true);
    const shown: boolean[] = [];
    for (const z of [-1.7, -1.3, -1.7, -2.1, SHOP_COUNTER_SPOT[1]]) { p = walk(w, p, [0, z]); shown.push(w.upperShown); }
    // In the band between showBelow and hideAbove it stays as it was: shown on the way in, hidden on the way out.
    expect(shown).toEqual([true, false, false, true, false]);
    expect(SHOP_MEZZ.showBelow).toBeLessThan(SHOP_MEZZ.hideAbove);
    expect(SHOP_MEZZ.hideAbove).toBeLessThan(SHOP_MEZZ.z0);
  });

  it("won't let you walk under or beside the flight downstairs, or into the stairwell upstairs", () => {
    const w = createShopWalker();
    // Beside the flight, walking at its side from the room.
    const [x] = walk(w, [-3.7, 1.0], [-5.6, 1.0]);
    expect(w.zone).toBe("ground");
    expect(x).toBeGreaterThan(S.x1);
    // Upstairs: toward the stairwell from the room side, and over the mezzanine's front edge.
    const up = createShopWalker();
    walk(up, SHOP_SPAWN, [LANE_X, S.z0 - 0.5], HEAD);
    const [ux] = walk(up, HEAD, [-3.6, 2.6], [-3.6, 0], [-5.6, 0]);
    expect(up.zone).toBe("upper");
    expect(ux).toBeGreaterThan(S.x1);
    const [, uz] = walk(up, [ux, 0], [2, 0], [2, -4]);
    expect(up.zone).toBe("upper");
    expect(uz).toBeCloseTo(SHOP_MEZZ.z0 + SHOP_MEZZ.edge, 1);
  });

  it("puts 2-3 changing rooms right behind the stair, each used from in front of its curtain", () => {
    const { x0, x1, z0, z1, count, height, range } = SHOP_BOOTHS;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
    // Behind the stair: past its top end, against the right wall's corner.
    expect(z0).toBeGreaterThan(S.z1);
    expect(x0).toBe(-halfW);
    expect(x1 - x0).toBeGreaterThan(count * 1.0);
    expect(height).toBeGreaterThan(2);
    for (const [i, b] of SHOP_BOOTH_LIST.entries()) {
      expect(shopWalkable(0, ...b.spot), b.id).toBe(true);
      expect(nearestReach(0, ...b.spot), b.id).toBeLessThan(0.08);
      expect(b.spot[1]).toBeLessThan(z0);
      expect(z0 - b.spot[1]).toBeLessThan(range);
      expect(Math.abs(b.spot[0] - b.at[0])).toBeLessThan((x1 - x0) / count / 2);
      // Each booth's spot is its own: the next one's is out of range.
      if (i > 0) expect(Math.hypot(b.spot[0] - SHOP_BOOTH_LIST[i - 1].spot[0], b.spot[1] - SHOP_BOOTH_LIST[i - 1].spot[1])).toBeGreaterThan(range);
    }
    expect(reach[0].some(([x, z]) => x > x0 && x < x1 && z > z0 && z < z1)).toBe(false);
    // The rail is still by the stair, and the old booth spot shows folded clothes.
    expect(fixture("rail").blocks[0].at[0]).toBeLessThan(-1.2);
    expect(SHOP_SLOTS.filter(s => s.fixture === "clothes-table" && s.kind === "clothes").length).toBeGreaterThanOrEqual(3);
  });

  it("puts the in-game items downstairs and the club merch upstairs, each where you can walk up to it", () => {
    for (const k of Object.keys(ITEM_KINDS) as ItemKind[]) expect(SHOP_SLOTS.some(s => s.kind === k), k).toBe(true);
    for (const s of SHOP_SLOTS) {
      expect(s.level, s.id).toBe(s.kind.startsWith("merch") ? 1 : 0);
      if (s.level === 1) expect(s.at[2] - s.size[2] / 2, `${s.id} on the mezzanine`).toBeGreaterThan(SHOP_MEZZ.z0);
      expect(fixture(s.fixture).level, s.id).toBe(s.level);
      expect(nearestReach(s.level, s.at[0], s.at[2]), s.id).toBeLessThan(SHOP_TAG_RANGE);
    }
    expect(new Set(SHOP_SLOTS.map(s => s.id)).size).toBe(SHOP_SLOTS.length);
  });

  it("closes the counter's ends: the shopkeeper's side is out of reach, and they're seen over it", () => {
    const body = fixture("counter").blocks[0], top = fixture("counter").blocks[1];
    const back = body.at[2] + body.size[2] / 2, front = body.at[2] - body.size[2] / 2, ledge = top.at[1] + top.size[1];
    // The walking camera (interiorShared snapInteriorCamera): 8.4 up and 7.2 behind you at the counter spot.
    const camZ = SHOP_COUNTER_SPOT[1] - 7.2, camY = 8.4, hips = 0.55;
    for (const s of KEEPER_POSTS.shop.stations) {
      expect(s.at[1]).toBeGreaterThan(back);
      expect(Math.abs(s.at[0])).toBeLessThan(body.size[0] / 2 - 0.2);
      expect(nearestReach(0, ...s.at)).toBeGreaterThan(0.5);
      expect(hips + ((camY - hips) * (s.at[1] - front)) / (s.at[1] - camZ)).toBeGreaterThan(ledge);
    }
    expect(reach[0].some(([x, z]) => Math.abs(x) < body.size[0] / 2 && z > back)).toBe(false);
  });

  it("slides along what it meets and never ends a step inside anything", () => {
    const w = createShopWalker();
    const [x, z] = w.constrain(0, 2.3, 0, 3.2);
    expect(z).toBeLessThan(2.7);
    expect(x).toBe(0);
    for (const level of [0, 1] as const) for (const [cx, cz] of SHOP_SOLIDS[level]) expect(shopSolidAt(level, cx, cz, 0)).toBe(true);
  });

  it("lights edges of real fixtures on their own floor, and hangs the pendant over the counter", () => {
    for (const s of SHOP_STRIPS) expect(fixture(s.fixture).level).toBe(s.level);
    const counter = fixture("counter").blocks[0];
    expect(SHOP_PENDANT.x1 - SHOP_PENDANT.x0).toBeLessThanOrEqual(counter.size[0]);
    expect(Math.abs(SHOP_PENDANT.z - counter.at[2])).toBeLessThan(counter.size[2] / 2);
    expect(SHOP_PENDANT.y).toBeGreaterThan(2.4);
    expect(SHOP_PENDANT.y).toBeLessThan(F - SHOP_SLAB);
  });
});

it("the model build reads the layout the game walks (art/interiors/shop_layout.json is current: node scripts/shop-layout-json.mjs)", () => {
  expect(readFileSync(join(process.cwd(), "..", "art", "interiors", "shop_layout.json"), "utf8")).toBe(shopLayoutJson());
});
