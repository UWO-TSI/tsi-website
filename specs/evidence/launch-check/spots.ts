/**
 * The two-account test's places in the active world (NEXT_PUBLIC_GAME_WORLD, as the server judges it), printed as JSON:
 * the campfire, a river cast spot the server accepts, the river's fish, the rock and shell nodes (the server's ids) (lib/collections/rolls.ts castWater) and a walking route from the
 * spawn to the fire (a breadth-first search over the walker's standable ground, half a unit a step, never climbing faster
 * than the walker can, thinned to a waypoint every few units).
 *   cd web && NEXT_PUBLIC_GAME_WORLD=new npx vite-node -c vitest.config.ts ../specs/evidence/launch-check/spots.ts
 */
import { join } from "node:path";
import { activeVillage, castWater } from "@/lib/collections/rolls";
import { FISH } from "@/lib/game/fishing";
import { villageNodes } from "@/lib/game/islandNodes";
import { islandOf } from "@/lib/game/defaultIsland";
import { village, villageSpawnPoint } from "@/lib/game/villageMap";
import { campfireSite } from "@/lib/game/campfireSite";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";
import { GAME_WORLD } from "@/lib/game/world/active";

const w = GAME_WORLD === "new" ? loadWorldFromDisk(join(process.cwd(), "data/world")) : null;
const v = w ? villageOfWorld(w) : village();
const fire = campfireSite(v)!;
const [sx, sz] = villageSpawnPoint(v);

// Everything walkable from the spawn (BFS over standable ground); the route ends within 3 u of the fire.
const island = islandOf(v), S = 0.5, x0 = v.bounds.minX - 5, z0 = v.bounds.minZ - 5, nx = Math.ceil((v.bounds.maxX - x0 + 5) / S), nz = Math.ceil((v.bounds.maxZ - z0 + 5) / S);
const px = (i: number) => x0 + i * S, pz = (k: number) => z0 + k * S, idx = (x: number, z: number) => Math.round((z - z0) / S) * nx + Math.round((x - x0) / S);
const prev = new Int32Array(nx * nz).fill(-2), queue = [idx(sx, sz)];
prev[queue[0]] = -1;
let goal = -1;
for (let q = 0; q < queue.length; q++) {
  const j = queue[q], i = j % nx, k = (j - i) / nx, h = island.ground(px(i), pz(k));
  if (goal < 0 && Math.hypot(px(i) - fire.x, pz(k) - fire.z) < 3.2) goal = j;
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = (k + dk) * nx + i + di, x = px(i + di), z = pz(k + dk);
    if (i + di < 0 || k + dk < 0 || i + di >= nx || k + dk >= nz || prev[c] !== -2 || !island.standable(x, z) || island.ground(x, z) - h > 0.4) continue;
    prev[c] = j; queue.push(c);
  }
}
// A river cast spot: ground a player walks to from the spawn with the river in reach (the server's own check), nearest the middle of the world's River
// annotation (the village: nearest the fire).
const cells = w?.annotations.find(a => a.name === "River")?.cells ?? [];
const mid = cells.length ? cells[cells.length >> 1] : null;
const [cx, cz] = mid && w ? [mid[0] + w.terrain.originX, mid[1] + w.terrain.originZ] : [fire.x, fire.z];
let cast: [number, number] | null = null;
for (let r = 0; r < 200 && !cast; r += 1) for (let a = 0; a < 64 && !cast; a++) {
  const x = Math.round(cx + r * Math.cos((a / 64) * 2 * Math.PI)), z = Math.round(cz + r * Math.sin((a / 64) * 2 * Math.PI));
  if (prev[idx(x, z)] !== -2 && castWater("village", [x, z]) === "river") cast = [x, z];
}

const path: [number, number][] = [];
for (let j = goal; j >= 0; j = prev[j]) path.unshift([px(j % nx), pz(Math.floor(j / nx))]);
const route = path.filter((_, i) => i % 8 === 0 || i === path.length - 1);
const nodes = villageNodes(activeVillage()).forage, pick = (p: string) => nodes.filter(n => n.id.startsWith(p)).map(({ id, x, z }) => ({ id, x, z }));
const riverFish = FISH.filter(f => (f.zone ?? "river") === "river").map(f => f.key);
console.log(JSON.stringify({ world: GAME_WORLD, spawn: [sx, sz], fire: { x: fire.x, z: fire.z }, cast, riverFish, rocks: pick("rock-"), shells: pick("shell-"), route }));
