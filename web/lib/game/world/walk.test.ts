/**
 * Gameplay on the smooth world (specs/world-editor.md v0 step 4), on the committed world files: the walker stands on
 * the drawn ground, slopes too steep block walking (on foot and for residents, both ways the sim moves), buildings
 * stand on flat pads, and every object, the campfire and the residents' stops stay on the surface.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { barDecks, inRect, landmarkHalf, villageIsland, wharfDock, wharfDecks, type LandmarkId } from "../defaultIsland";
import { BAR_Y, ENTRY, STOOLS, STOOL_Z, barOf, barPoint } from "../sushiBar";
import { JETTY, dockToWorld } from "../wharf";
import { campfireSite } from "../campfireSite";
import { MOVE_TUNING, NO_INPUT, createMoveState, stepMove, STEP, type MoveWorld } from "../movement/sim";
import { navGrid, planResidents } from "../residentRoutine";
import { PROPOSALS, acceptProposed } from "../proposals";
import { villageSpawnPoint } from "../villageMap";
import { loadWorldFromDisk } from "./disk";
import { MAX_CLIMB, terrainHeight, terrainSteepness, sampleX, sampleZ } from "./terrain";
import { villageOfWorld } from "./village";

const world = loadWorldFromDisk(join(__dirname, "../../../data/world"));
const t = world.terrain;
// The v1 barrier proposal is drawn for the v2 world (world-map.json, barriers.test.ts); the new world's closures are its
// own border and terrain v3 R2's bridges and rockfall, so only the other proposals (the campfire) apply here.
const objects = acceptProposed(world.objects, PROPOSALS.filter(p => p.target === "world-map").flatMap(p => p.objects).filter(o => o.kind !== "barrier"));
const v = villageOfWorld({ terrain: t, objects });
const island = villageIsland(v);

/** A steep land face on the mountain: a sample too steep to climb with walkable ground below it, downhill. */
function steepFace(): { low: [number, number]; high: [number, number] } {
  for (let k = 2; k < t.rows - 2; k++) for (let i = 2; i < t.cols - 2; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    if (terrainHeight(t, x, z) < 1.5 || terrainSteepness(t, x, z) < MAX_CLIMB * 1.6) continue;
    const e = 0.05, gx = (terrainHeight(t, x + e, z) - terrainHeight(t, x - e, z)) / (2 * e), gz = (terrainHeight(t, x, z + e) - terrainHeight(t, x, z - e)) / (2 * e), g = Math.hypot(gx, gz);
    const [ux, uz] = [gx / g, gz / g];
    // Walk down the fall line to flat ground; the whole way must keep falling (a face, not a ditch), and up past the top.
    const hx = x + ux * 1.5, hz = z + uz * 1.5;
    if (!island.standable(hx, hz) || terrainHeight(t, hx, hz) < terrainHeight(t, x, z)) continue;
    let prev = terrainHeight(t, hx, hz);
    for (let d = -1.5; d < 4; d += 0.1) {
      const lx = x - ux * d, lz = z - uz * d, h = terrainHeight(t, lx, lz);
      if (h > prev + 1e-3) break;
      prev = h;
      if (d > 0.5 && h > t.seaLevel + 0.2 && h < terrainHeight(t, x, z) - 0.8 && terrainSteepness(t, lx, lz) < 0.3 && island.standable(lx, lz)) return { low: [lx, lz], high: [hx, hz] };
    }
  }
  throw new Error("no steep face found");
}

describe("walking the smooth world", () => {
  it("stands on the drawn ground, smoothly", () => {
    const [sx, sz] = villageSpawnPoint(v);
    expect(island.ground(sx, sz)).toBeCloseTo(terrainHeight(t, sx, sz), 6);
    // Across the village toward the plaza, in tiny steps: no jump in the ground.
    const plaza = objects.find(o => o.kind === "landmark" && o.id === "plaza")!;
    let prev = island.ground(sx, sz), worst = 0;
    for (let s = 1; s <= 2000; s++) {
      const x = sx + ((plaza.x - sx) * s) / 2000, z = sz + ((plaza.z - sz) * s) / 2000, h = island.ground(x, z);
      worst = Math.max(worst, Math.abs(h - prev));
      prev = h;
    }
    expect(worst).toBeLessThan(0.05);
  });

  it("walks from the jetty's middle finger at the water up its pier's stairs, across its platform and a gangway onto the deck boards", () => {
    const dock = wharfDock(v)!, at = (lz: number) => dockToWorld(dock, 0, lz, { x: 0, z: 0 });
    expect(dock.y).toBe(JETTY.top);
    const landing = at(-2.5), platform = at(11), boards = at(JETTY.land + 1.6);
    expect(island.ground(landing.x, landing.z)).toBeCloseTo(JETTY.low, 6);
    expect(island.ground(platform.x, platform.z)).toBeCloseTo(1, 6);
    expect(island.ground(boards.x, boards.z)).toBeCloseTo(1, 1);
    for (const p of [landing, platform, boards]) expect(island.wet(p.x, p.z)).toBe(false);
    const [x, z] = island.move(landing.x, landing.z, boards.x, boards.z);
    expect(Math.hypot(x - boards.x, z - boards.z)).toBeLessThan(0.01);
  });

  it("walks from the sand up the sushi bar's boardwalk to its entrance, on stilts over water too deep to wade under its guests' deck", () => {
    const bar = barOf(v)!, at = (lx: number, lz: number) => barPoint(bar, lx, lz);
    const [sx, sz] = at(0, 12.5), [ex, ez] = at(...ENTRY), [cx, cz] = at(0, 0);
    expect(island.ground(cx, cz)).toBeCloseTo(BAR_Y, 6);
    // The boardwalk's end meets the sand at its own height: no step up onto it.
    expect(Math.abs(terrainHeight(t, ...at(0, 12)) - (BAR_Y + 0.04 - 0.4))).toBeLessThan(0.15);
    expect(island.wet(sx, sz)).toBe(false);
    const [x, z] = island.move(sx, sz, ex, ez);
    expect(Math.hypot(x - ex, z - ez)).toBeLessThan(0.01);
    expect(island.ground(ex, ez)).toBeCloseTo(BAR_Y + 0.04, 6);
    // The guests' deck and the stools are reached only by the entrance (E there): the water under them is too deep to wade.
    for (const lx of [-4.3, ...STOOLS, 4.3]) for (const lz of [STOOL_Z, 3.2, 4.1]) expect(island.standable(...at(lx, lz)), `${lx}, ${lz}`).toBe(false);
  });

  it("blocks walking up a slope too steep to climb, and lets you walk down it", () => {
    const { low, high } = steepFace();
    // The walker's own step rule.
    const [ex, ez] = island.move(low[0], low[1], high[0], high[1]);
    expect(terrainHeight(t, ex, ez)).toBeLessThan(terrainHeight(t, high[0], high[1]) - 0.5);
    const [dx, dz] = island.move(high[0], high[1], low[0], low[1]);
    expect(Math.hypot(dx - low[0], dz - low[1])).toBeLessThan(0.3);
    // The movement sim: run uphill at the face for two seconds and never get up it, and a held jump does not climb it either.
    const world: MoveWorld = island;
    const dir = [high[0] - low[0], high[1] - low[1]], len = Math.hypot(dir[0], dir[1]);
    let s = createMoveState(low[0], low[1], world);
    const top = terrainHeight(t, high[0], high[1]);
    for (let i = 0; i < 240; i++) s = stepMove(s, { ...NO_INPUT, x: dir[0] / len, z: dir[1] / len, sprint: true, jump: i % 30 < 15, jumpPressed: i % 30 === 0 }, STEP * 2, world, MOVE_TUNING);
    expect(s.y).toBeLessThan(top - 0.5);
    // A resident's straight walk up it is refused (its steps are 0.2 apart, as NavGrid.clear takes them), and so is a path through it.
    const nav = navGrid(island, v), n = Math.ceil(len / 0.2);
    let refused = false;
    for (let j = 1; j <= n && !refused; j++) refused = !nav.step(low[0] + (dir[0] * (j - 1)) / n, low[1] + (dir[1] * (j - 1)) / n, low[0] + (dir[0] * j) / n, low[1] + (dir[1] * j) / n);
    expect(refused).toBe(true);
    expect(nav.clear(low[0], low[1], high[0], high[1])).toBe(false);
  });

  it("stands every building on a flat pad", () => {
    for (const o of objects) {
      const half = o.kind === "landmark" ? landmarkHalf(o.id as LandmarkId, o.yaw ?? 0, o.scale ?? 1) : null;
      if (!half) continue;
      const base = island.ground(o.x, o.z);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) expect(Math.abs(island.ground(o.x + a * half[0], o.z + b * half[1]) - base), o.id).toBeLessThan(0.02);
    }
  });

  it("keeps every object and the campfire on the surface, on dry land", () => {
    for (const o of objects) {
      if (o.kind === "landmark" && o.id === "wharf") continue; // the jetty's origin stands at the water's edge
      if (o.kind === "barrier" && o.model === "border") continue; // the invisible border runs out into the water at its ends
      if (/^(coral|reeds|river-stones|lily-pads)-/.test(o.model ?? "")) continue; // the coral, reeds and stones stand in the shallows, the lily pads float
      if (o.model?.startsWith("ship-house-")) continue; // a ship house straddles the deck's water edge, its back on piles in the sea
      // On the ground, or on the jetty's decks (its lanterns stand on its platform) or the sushi bar's (it stands on its stilts).
      const deck = [...wharfDecks(v), ...barDecks(v)].find(d => inRect(o.x, o.z, d)), h = island.ground(o.x, o.z);
      expect(h, `${o.kind}:${o.id}`).toBeCloseTo(deck ? deck.y(o.x, o.z) : terrainHeight(t, o.x, o.z), 6);
      expect(h, `${o.kind}:${o.id} above the sea`).toBeGreaterThan(t.seaLevel);
    }
    const fire = campfireSite(v);
    expect(fire).not.toBeNull();
    expect(island.ground(fire!.x, fire!.z)).toBeGreaterThan(t.seaLevel);
    expect(island.wet(fire!.x, fire!.z)).toBe(false);
  });

  it("routes the residents over walkable ground to stops on dry land", () => {
    const plans = planResidents([
      { slug: "bram", post: "wharf_keeper" }, { slug: "rosa", post: "cafe_owner" }, { slug: "pim", post: "villager" }, { slug: "eliza", post: "hq_lead" },
    ], v, island);
    const nav = navGrid(island, v), [sx, sz] = villageSpawnPoint(v);
    let stops = 0;
    for (const p of plans) for (const phase of Object.values(p.phases)) for (const stop of phase) {
      const [x, z] = stop.at;
      expect(island.wet(x, z), `${p.slug} stop`).toBe(false);
      expect(Math.abs(island.ground(x, z) - terrainHeight(t, x, z))).toBeLessThan(1e-6);
      const path = nav.path(sx, sz, x, z);
      expect(path, `${p.slug} reaches ${x.toFixed(1)},${z.toFixed(1)}`).not.toBeNull();
      for (let i = 1; i < path!.length; i++) {
        const [ax, az] = path![i - 1], [bx, bz] = path![i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
        for (let j = 1; j <= n; j++) {
          const x0 = ax + ((bx - ax) * (j - 1)) / n, z0 = az + ((bz - az) * (j - 1)) / n, x1 = ax + ((bx - ax) * j) / n, z1 = az + ((bz - az) * j) / n;
          expect(island.climb!(x0, z0, x1, z1)).toBe(true);
        }
      }
      stops++;
    }
    expect(stops).toBeGreaterThan(8);
  });
});
