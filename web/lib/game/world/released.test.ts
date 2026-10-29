/**
 * What the release barriers close off (lib/game/barriers.ts releaseRegions), and the movement sim keeping to it. David,
 * 2026-10-29: "i can dash slide across the river but i get soft locked there cuz i cant dash back and i just drown and
 * respawn where i was but i also cant go on the other side of the island cuz unreleased". The border's far-bank wall
 * stands a few units back from the river, so a jump with an air dash off the near bank landed on the strip between,
 * walking couldn't leave it, and every splash put the player back on it.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNLISTED, islandOf, landmarkPoint, landmarks, villageIsland } from "../defaultIsland";
import { barrierBoxes, barrierPlacements, releaseRegions } from "../barriers";
import { dropFlags } from "../drops";
import { MOVE_TUNING, NO_INPUT, STEP, createMoveState, stepMove, type MoveInput, type MoveState, type MoveWorld } from "../movement/sim";
import { objectsOf, villageSpawnPoint } from "../villageMap";
import { loadWorldFromDisk } from "./disk";
import { createTerrain, sampleX, sampleZ } from "./terrain";
import { villageOfWorld } from "./village";

const world = loadWorldFromDisk(join(__dirname, "../../../data/world"));
const v = villageOfWorld({ terrain: world.terrain, objects: world.objects });
const island = villageIsland(v);

/** The far bank's strip, where the parent's crossing stood (west of the river, east of the border's far-bank wall). */
const STRIP: [number, number] = [-51.4, 12.7];
/** The near bank across from it. */
const NEAR: [number, number] = [-40, 12];

describe("the release regions on the new world", () => {
  it("are measured from the spawn: the near bank released, the far-bank strip and the meadow locked, an islet stranded", () => {
    expect(island.released!(...villageSpawnPoint(v))).toBe(true);
    expect([island.released!(...NEAR), island.locked!(...NEAR)]).toEqual([true, false]);
    expect([island.released!(...STRIP), island.locked!(...STRIP)]).toEqual([false, true]);
    expect(island.locked!(-80, -20)).toBe(true); // the meadow, past the border
    expect([island.released!(124, 104), island.locked!(124, 104)]).toEqual([false, false]); // the lighthouse islet: no barrier, out at sea
  });

  it("never close off released ground: every spawn and every released landmark's door and exit", () => {
    const spots = objectsOf("spawn", v).map(o => [o.id, o.x, o.z] as const);
    for (const l of landmarks(v)) {
      if (UNLISTED.has(l.id) || l.id === "oracle") continue; // the temple stands past the border (its drop)
      for (const which of ["door", "exit"] as const) { const p = landmarkPoint(l.id, which, v); if (p) spots.push([`${l.id} ${which}`, p[0], p[1]]); }
    }
    expect(spots.length).toBeGreaterThan(4);
    expect(spots.filter(([, x, z]) => !island.released!(x, z) || island.locked!(x, z)).map(([id]) => id)).toEqual([]);
  });

  it("measure in well under a frame's worth of a load (lazily, once per island)", () => {
    // The best of three fresh islands: the budget is 30 ms on the main thread at load (about 24 ms alone in node); the
    // bound has room for a busy machine running the suite in parallel.
    const ms = Math.min(...[0, 1, 2].map(() => { const fresh = islandOf(v), t0 = performance.now(); fresh.locked!(0, 0); return performance.now() - t0; }));
    console.log(`release regions measured in ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(60);
  });
});

describe("the release regions follow the drop", () => {
  // Flat land at 1 with a sea channel at |x| < 2, crossed by a neck of land at |z| < 1.5 that a rockslide (the mountain's, drop 2) fills.
  const t = createTerrain(64, 64, -32, -32);
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    t.heights[k * t.cols + i] = Math.abs(x) < 2 && Math.abs(z) >= 1.5 ? -2 : 1;
  }
  const small = villageOfWorld({ terrain: t, objects: [{ id: "default", kind: "spawn", x: -10, z: 0 }, { id: "slide", kind: "barrier", x: 0, z: 0, model: "rockslide" }] });
  const regions = (drop: 1 | 2) => releaseRegions(t, islandOf(small).wet, barrierBoxes(barrierPlacements(small, dropFlags(drop))), [-10, 0])!;

  it("lock the land past a barrier until its drop, then release it", () => {
    expect([regions(1).locked(10, 5), regions(1).released(10, 5)]).toEqual([true, false]);
    expect([regions(2).locked(10, 5), regions(2).released(10, 5)]).toEqual([false, true]);
    expect(regions(1).released(-10, 5)).toBe(true);
  });
});

const tune = { ...MOVE_TUNING, glider: 1 };
/** The parent's crossing: sprint west at the river from `from`, dash, hold crouch (the dash-slide), jump at the bank's edge, air dash 0.2 s later. */
function dashSlideOver(from: [number, number], each: (s: MoveState) => void): MoveState {
  let s = createMoveState(from[0], from[1], island, -Math.PI / 2), t = 0, jumped = -1;
  for (let n = 0; n < 600; n++) {
    t += STEP;
    const input: MoveInput = { ...NO_INPUT, x: -1, sprint: true, sneak: jumped < 0, jump: jumped >= 0 && t - jumped < 0.3, dashPressed: n === 30 };
    if (jumped < 0 && s.mode !== "air" && island.wet(s.x - 0.7, s.z)) { input.jumpPressed = input.jump = true; jumped = t; }
    if (jumped >= 0 && Math.abs(t - jumped - 0.2) < STEP / 2) input.dashPressed = true;
    s = stepMove(s, input, STEP, island, tune);
    each(s);
  }
  return s;
}

describe("moving at the river", () => {
  it("a dash-slide from the near bank toward the far, locked bank ends on the released side", () => {
    let flew = false, stoodOff = 0;
    const end = dashSlideOver([NEAR[0] + 1, NEAR[1]], s => {
      if (s.x < -46) flew = true; // out over the river
      if ((s.mode === "ground" || s.mode === "slide") && !island.released!(s.x, s.z)) stoodOff++;
    });
    expect(flew).toBe(true);
    expect(stoodOff).toBe(0);
    expect(island.released!(end.x, end.z)).toBe(true);
  });

  it("a drown on the far bank respawns on the released side", () => {
    // Bodies whose last safe spot is the strip (an old state, a teleport made before the regions): one standing on it,
    // walking east into the river, and one already falling into the river off it.
    const near = createMoveState(NEAR[0], NEAR[1], island), y = island.top(...STRIP), safe: [number, number, number] = [STRIP[0], y, STRIP[1]];
    expect(island.wet(-47, STRIP[1])).toBe(true);
    for (const start of [{ ...near, x: STRIP[0], y, z: STRIP[1], safe }, { ...near, x: -47, y: 1.5, z: STRIP[1], mode: "air" as const, safe }]) {
      let s: MoveState = start, respawned: [number, number] | null = null;
      for (let n = 0; n < 1200 && !respawned; n++) {
        s = stepMove(s, { ...NO_INPUT, x: 1 }, STEP, island, tune);
        const r = s.events.find(e => e.kind === "respawn");
        if (r) respawned = [r.x, r.z];
      }
      expect(respawned).not.toBeNull();
      expect(island.released!(...respawned!)).toBe(true);
      expect(respawned![0]).toBeGreaterThan(-46); // the village's side of the river
    }
    // And a body started there begins on the released side.
    const fresh = createMoveState(...STRIP, island);
    expect([island.released!(fresh.x, fresh.z), island.released!(fresh.safe[0], fresh.safe[2])]).toEqual([true, true]);
  });

  it("the last-safe tracker never stores a locked-region point", () => {
    const bad: string[] = [];
    for (let z = 10; z <= 22; z += 1.5) for (const back of [1, 3, 6]) {
      let x = -30;
      while (!island.wet(x - 0.5, z)) x -= 0.5;
      dashSlideOver([x + back, z], s => { if (!island.released!(s.safe[0], s.safe[2]) || island.locked!(s.safe[0], s.safe[2])) bad.push(`${s.safe[0].toFixed(1)},${s.safe[2].toFixed(1)}`); });
    }
    expect(bad).toEqual([]);
  });

  it("the tracker skips stranded ground too: a sim world released only at x > 0", () => {
    const w: MoveWorld = { top: () => 0, wet: () => false, released: x => x > 0 };
    let s = createMoveState(2, 0, w);
    for (let n = 0; n < 240; n++) s = stepMove(s, { ...NO_INPUT, x: -1 }, STEP, w);
    expect(s.x).toBeLessThan(-1);
    expect(s.safe[0]).toBeGreaterThan(0);
  });
});
