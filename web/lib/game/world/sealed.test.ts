/**
 * The v1 seal (specs/launch/v1-new-world.md): on the new world, nobody walks, jumps or glides from the spawn into a zone
 * that stays closed at launch (every zone but the wharf, the west beach and the village: specs/launch/terrain-v3.md).
 * The zones are the world's own annotations (tagged in the world data, matched by name), the barriers are the map's
 * barrier objects standing at this drop, and the ground is whatever web/data/world holds, so this runs on any world.
 * The reach (walk, jump, glide, grab) is `reach.ts`.
 *
 * A leak fails the test and prints where, so David can close it in the editor:
 * `cd web && npx vitest run lib/game/world/sealed.test.ts`.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type MapObject, type Village } from "../villageMap";
import type { MapAnnotation } from "../grid";
import { loadWorldFromDisk } from "./disk";
import { createTerrain, sampleX, sampleZ, type WorldTerrain } from "./terrain";
import { villageOfWorld } from "./village";
import { STEP, reach } from "./reach";

/** The hidden v1 zones, by what their annotation is called. */
const ZONES: readonly { zone: string; name: RegExp }[] = [
  { zone: "the summit (Oracle temple)", name: /oracle|summit/i },
  { zone: "the forest ruins", name: /ruins/i },
  { zone: "the north island", name: /north island|plains/i },
  { zone: "the cave", name: /cave/i },
  // Terrain v3 (specs/launch/terrain-v3.md): everything but the wharf, the west beach and the village is closed at launch.
  { zone: "the meadow", name: /^meadow$/i },
  { zone: "the mountain", name: /^mountain$/i },
  { zone: "the islets", name: /islands biome|lighthouse islet/i },
];

interface Leak { zone: string; reached: number; at: [number, number][] }

/** The hidden zones a player reaches: how many lattice points, and where the reach first got in (up to 6, 4 u apart). */
function leaks(v: Village & { terrain: WorldTerrain }, annotations: readonly MapAnnotation[]): Leak[] {
  const r = reach(v), t = v.terrain, out: Leak[] = [];
  for (const { zone, name } of ZONES) {
    const cells = new Set(annotations.filter(a => name.test(a.name)).flatMap(a => a.cells.map(([cx, cz]) => cz * t.width + cx)));
    if (!cells.size) throw new Error(`no annotation tags ${zone} (${name}): tag it in the world data`);
    const inZone = (j: number) => { const i = j % r.nx, k = (j - i) / r.nx; return cells.has(Math.floor(k * STEP) * t.width + Math.floor(i * STEP)); };
    const hits = r.order.filter(inZone);
    if (!hits.length) continue;
    const at: [number, number][] = [];
    for (const j of hits) {
      const i = j % r.nx, x = Math.round(r.x0 + (i + 0.5) * STEP), z = Math.round(r.z0 + ((j - i) / r.nx + 0.5) * STEP);
      if (at.length < 6 && at.every(([ax, az]) => Math.hypot(ax - x, az - z) >= 4)) at.push([x, z]);
    }
    out.push({ zone, reached: hits.length, at });
  }
  return out;
}

/** A small test world: flat ground at `ground` with what `shape` raises or digs, the spawn at the origin. */
function testWorld(shape: (x: number, z: number) => number, objects: MapObject[] = []) {
  const t = createTerrain(64, 64, -32, -32);
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) t.heights[k * t.cols + i] = shape(sampleX(t, i), sampleZ(t, k));
  return villageOfWorld({ terrain: t, objects: [{ id: "default", kind: "spawn", x: 0, z: 0 }, ...objects] }) as Village & { terrain: WorldTerrain };
}
/** Annotations for the closed zones over cells [x0, x1) × [z0, z1) of the 64 × 64 test grid (cell = world + 32). */
const zonesAt = (x0: number, x1: number, z0: number, z1: number): MapAnnotation[] => {
  const cells: [number, number][] = [];
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) cells.push([x + 32, z + 32]);
  return ["Oracle Temple", "Ruins in forest", "Plains biome", "Cave mouth", "Meadow", "Mountain", "Islands biome"].map(name => ({ name, color: "#fff", cells }));
};
const smooth = (a: number, b: number, v: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

describe("the reach the seal is judged by", () => {
  // A plateau 4 u up in the corner x, z > 12, behind a cliff (grade 4) everywhere along its edge.
  const plateau = (x: number, z: number) => 0.4 + 4 * smooth(12, 13, Math.min(x, z));
  const zone = zonesAt(16, 32, 16, 32);

  it("is sealed by a cliff taller than a jump and a grab", () => {
    expect(leaks(testWorld(plateau), zone)).toEqual([]);
    // A walkable ramp up the cliff at z ≈ 20: a leak, found where the ramp tops out.
    const ramp = (x: number, z: number) => (Math.abs(z - 20) < 2 && x > 0 && x < 14 ? 0.4 + 4 * smooth(2, 13, x) : plateau(x, z));
    const open = leaks(testWorld(ramp), zone);
    expect(open.map(l => l.zone)).toEqual(ZONES.map(z => z.zone));
    expect(Math.hypot(open[0].at[0][0] - 16, open[0].at[0][1] - 20)).toBeLessThanOrEqual(2);
  });

  it("is sealed by a barrier across a gap in a ridge", () => {
    // A 4 u ridge along x = 13, with a 2 u gap at ground level at z = 20; the zone beyond it.
    const ridge = (x: number, z: number) => (Math.abs(z - 20) < 1 ? 0.4 : 0.4 + 4 * smooth(2, 1.5, Math.abs(x - 13)));
    const beyond = zonesAt(16, 32, -32, 32);
    const open = leaks(testWorld(ridge), beyond);
    expect(Math.hypot(open[0].at[0][0] - 16, open[0].at[0][1] - 20)).toBeLessThanOrEqual(2);
    expect(leaks(testWorld(ridge, [{ id: "slide", kind: "barrier", model: "rockslide", x: 13, z: 20 }]), beyond)).toEqual([]);
  });

  it("lets a jump and a grab up a low step, but not up a slope too steep to walk", () => {
    expect(leaks(testWorld((x, z) => 0.4 + 2 * smooth(12, 12.5, Math.min(x, z))), zone)).not.toEqual([]); // 2 u: jump 1.28 + grab 1.15
    expect(leaks(testWorld((x, z) => 0.4 + 6 * smooth(10, 14, Math.min(x, z))), zone)).toEqual([]); // grade 1.5 for 4 u
  });

  it("glides over a narrow strait onto an island, never over a wide one", () => {
    // A 3 u bank at the shore x = 4, the sea beyond, an island past `gap`.
    const sea = (gap: number) => (x: number, z: number) => (x < 4 ? 3 : x < 4 + gap ? -2 : 0.4) + 0 * z;
    const island = zonesAt(4 + 6 + 2, 32, -32, 32);
    expect(leaks(testWorld(sea(6)), island)).not.toEqual([]);
    expect(leaks(testWorld(sea(20)), zonesAt(26, 32, -32, 32))).toEqual([]);
  });
});

describe("the new world's v1 seal", () => {
  it("keeps every zone closed at launch out of reach of the spawn", () => {
    const w = loadWorldFromDisk(fileURLToPath(new URL("../../../data/world/", import.meta.url)));
    const found = leaks(villageOfWorld(w) as Village & { terrain: WorldTerrain }, w.annotations);
    if (found.length) console.warn(`Leaks into the hidden zones (fix in /lab/world):\n${found.map(l => `- ${l.zone}: ${l.reached} points reached, first at ${l.at.map(([x, z]) => `(${x}, ${z})`).join(" ")}`).join("\n")}`);
    expect(found).toEqual([]);
  }, 120_000);
});
