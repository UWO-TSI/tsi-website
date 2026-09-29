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

export interface SpawnPoint { id: string; type: string; x: number; z: number }
export interface SpawnRow { zone: Zone; type: string; at: [number, number][]; /** Seconds dead before it comes back while you're away (0: next visit). */ respawn: number }

export const SPAWN_TABLE: SpawnRow[] = [
  { zone: "outer", type: "shadow-fox", respawn: 40, at: [[-7, -18], [6, -19.5], [11, -9], [-10, -12], [-3, -9]] },
  { zone: "outer", type: "thorn-crab", respawn: 40, at: [[-8, -8], [3.5, -7], [-5, -22]] },
  { zone: "outer", type: "mushroom-beast", respawn: 45, at: [[-3, -15], [12, -9.5]] },
  { zone: "outer", type: "rune-wisp", respawn: 45, at: [[-6.5, -13.5], [3.5, -17.5], [7.5, -6]] },
  { zone: "outer", type: "elder-thorn-crab", respawn: 120, at: [[-11.5, -20.5]] },
  { zone: "inner", type: "animated-book", respawn: 60, at: [[-7, 9.5], [7, 4], [3.5, 12.5]] },
  { zone: "inner", type: "stone-golem", respawn: 120, at: [[-5.5, 6], [5.5, 9]] },
  { zone: "boss", type: "guardian-statue", respawn: 0, at: [[0, 25.5]] },
];
export const SPAWNS: SpawnPoint[] = SPAWN_TABLE.flatMap(r => r.at.map(([x, z], i) => ({ id: `${r.type}-${i + 1}`, type: r.type, x, z })));
export const respawnAfter = (id: string) => SPAWN_TABLE.find(r => SPAWNS.some(s => s.id === id && s.type === r.type))?.respawn ?? 0;

const ring = (c: { x: number; z: number }, r: number, types: string[], wave: number, turn = 0): SpawnPoint[] =>
  types.map((type, i) => { const a = turn + (i / types.length) * Math.PI * 2; return { id: `wv${wave}-${i}`, type, x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r }; });

/** Waves per survive mission: they come in from the circle's edge. */
export const WAVES: Record<string, SpawnPoint[][]> = {
  "survive-circle": [
    ring(RUNE_CIRCLE, 3.8, ["shadow-fox", "shadow-fox"], 1, Math.PI / 2),
    ring(RUNE_CIRCLE, 3.8, ["mushroom-beast", "shadow-fox", "thorn-crab"], 2),
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
