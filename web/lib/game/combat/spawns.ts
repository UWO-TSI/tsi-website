/**
 * Where the ruins' enemies live (ruins.ts layout), as data: one row per zone
 * and enemy type with its spawn points. Zones follow row 228/230 and the
 * content spec: wildlife and rune wisps in the outer wild with the elder
 * thorn crab in its far corner, animated books and stone golems in the inner
 * temple, the guardian statue in its chamber. The mission waves and the boss
 * summons are here too. Ids are the systems roster keys (web/lib/combat/content.ts).
 */
import { SANCTUM_CIRCLE, RUNE_CIRCLE } from "@/lib/game/ruins";
import type { Zone } from "@/lib/combat/content";
import type { Pack } from "./sim";

export interface SpawnPoint { id: string; type: string; x: number; z: number; pack?: Pack }
/** `at`: a spot, or for a pack (a fox den, a pollen cloud) a spot and how many live there. */
export interface SpawnRow { zone: Zone; type: string; at: ([number, number] | [number, number, number])[]; /** Seconds dead before it comes back while you're away (0: next visit). */ respawn: number }

/**
 * Zone 1, the Overgrown Outskirts (design sheet "Mobs, zone 1"): two fox dens of three (one by the lantern, the "fox
 * den" of the fetch mission), three crabs, two mushrooms, three wisps, two pollen clouds (9 and 13) and the elder
 * crab in the far corner. Clear of the gate plaza and the rune circle's ring.
 */
export const SPAWN_TABLE: SpawnRow[] = [
  { zone: "outer", type: "shadow-fox", respawn: 40, at: [[9, -18.5, 3], [-8.5, -12, 3]] },
  { zone: "outer", type: "thorn-crab", respawn: 40, at: [[-8, -7], [3.5, -7], [-5, -22]] },
  { zone: "outer", type: "mushroom-beast", respawn: 45, at: [[-3, -15.5], [12, -9.5]] },
  { zone: "outer", type: "rune-wisp", respawn: 45, at: [[-6, -17], [1, -12], [7.5, -6]] },
  { zone: "outer", type: "pollen-sprite", respawn: 50, at: [[4, -19.5, 9], [-2, -8, 13]] },
  { zone: "outer", type: "elder-thorn-crab", respawn: 120, at: [[-11.5, -20.5]] },
  { zone: "inner", type: "animated-book", respawn: 60, at: [[-7, 9.5], [7, 4], [3.5, 12.5]] },
  { zone: "inner", type: "stone-golem", respawn: 120, at: [[-5.5, 6], [5.5, 9]] },
  { zone: "boss", type: "guardian-statue", respawn: 0, at: [[0, 25.5]] },
];

/**
 * A pack's members round its spot (ids `<id>-1`…): a fox den in a small ring, a pollen cloud as a sunflower (each
 * sprite at the golden angle from the last, spreading out with the root of its index), so a cloud of any size reads round.
 */
export function packAt(id: string, type: string, x: number, z: number, n: number): SpawnPoint[] {
  const swarm = type === "pollen-sprite";
  return Array.from({ length: n }, (_, k) => {
    const a = swarm ? k * 2.39996 : (k / n) * Math.PI * 2, r = swarm ? 1.5 * Math.sqrt((k + 0.5) / n) : 0.9;
    return { id: `${id}-${k + 1}`, type, x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, pack: { id, slot: k, size: n, cx: x, cz: z } };
  });
}
export const SPAWNS: SpawnPoint[] = SPAWN_TABLE.flatMap(r => r.at.flatMap(([x, z, n], i) => n ? packAt(`${r.type}-${i + 1}`, r.type, x, z, n) : [{ id: `${r.type}-${i + 1}`, type: r.type, x, z }]));
const RESPAWN = new Map(SPAWNS.map(s => [s.id, SPAWN_TABLE.find(r => r.type === s.type)!.respawn]));
export const respawnAfter = (id: string) => RESPAWN.get(id) ?? 0;

const ring = (c: { x: number; z: number }, r: number, types: string[], wave: number, turn = 0): SpawnPoint[] =>
  types.map((type, i) => { const a = turn + (i / types.length) * Math.PI * 2; return { id: `wv${wave}-${i}`, type, x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r }; });
/** A pack coming in at a bearing from the circle (a fox den, a pollen cloud), as one pack. */
const packIn = (c: { x: number; z: number }, r: number, type: string, n: number, wave: number, bearing: number): SpawnPoint[] =>
  packAt(`wv${wave}-${type}`, type, c.x + Math.sin(bearing) * r, c.z + Math.cos(bearing) * r, n);

/** Waves per survive mission: they come in from the circle's edge (zone 1's packs as packs). */
export const WAVES: Record<string, SpawnPoint[][]> = {
  "survive-circle": [
    packIn(RUNE_CIRCLE, 4.2, "shadow-fox", 3, 1, Math.PI / 2),
    [...ring(RUNE_CIRCLE, 3.8, ["mushroom-beast", "thorn-crab"], 2), ...packIn(RUNE_CIRCLE, 4.4, "pollen-sprite", 8, 2, Math.PI)],
    ring(RUNE_CIRCLE, 3.8, ["thorn-crab", "shadow-fox", "rune-wisp"], 3, 1),
  ],
  "survive-sanctum": [
    ring(SANCTUM_CIRCLE, 4, ["animated-book", "animated-book"], 1, Math.PI / 2),
    ring(SANCTUM_CIRCLE, 4, ["animated-book", "animated-book", "animated-book"], 2),
    ring(SANCTUM_CIRCLE, 4, ["stone-golem"], 3, Math.PI),
    ring(SANCTUM_CIRCLE, 4, ["stone-golem", "animated-book", "animated-book"], 4, 0.5),
  ],
};

/** Most of one type alive at once: its spawns, the biggest wave, and the boss's two summons. */
export function capacity(type: string): number {
  const spawns = SPAWNS.filter(s => s.type === type).length;
  const wave = Math.max(0, ...Object.values(WAVES).flat().map(w => w.filter(s => s.type === type).length));
  return spawns + wave + (type === "rune-wisp" ? 2 : 0);
}
