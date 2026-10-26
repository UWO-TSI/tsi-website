/**
 * The two-account test's places in the active world (NEXT_PUBLIC_GAME_WORLD, as the server judges it), printed as JSON:
 * the campfire, a river cast spot the server accepts (lib/collections/rolls.ts castWater) and a walking route from the
 * spawn to the fire (a breadth-first search over the walker's standable ground, half a unit a step, never climbing faster
 * than the walker can, thinned to a waypoint every few units).
 *   cd web && NEXT_PUBLIC_GAME_WORLD=new npx vite-node -c vitest.config.ts ../specs/evidence/launch-check/spots.ts
 */
import { join } from "node:path";
import { castWater } from "@/lib/collections/rolls";
import { islandOf } from "@/lib/game/defaultIsland";
import { village, villageSpawnPoint } from "@/lib/game/villageMap";
import { campfireSite } from "@/lib/game/campfireSite";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";
import { GAME_WORLD } from "@/lib/game/world/active";

const v = GAME_WORLD === "new" ? villageOfWorld(loadWorldFromDisk(join(process.cwd(), "data/world"))) : village();
const fire = campfireSite(v)!;
const [sx, sz] = villageSpawnPoint(v);

// A river cast spot: land with the river in reach, nearest the spawn's side of the island (the server's own check).
let cast: [number, number] | null = null;
for (let r = 0; r < 200 && !cast; r += 1) for (let a = 0; a < 64 && !cast; a++) {
  const x = Math.round(fire.x + r * Math.cos((a / 64) * 2 * Math.PI)), z = Math.round(fire.z + r * Math.sin((a / 64) * 2 * Math.PI));
  if (castWater("village", [x, z]) === "river") cast = [x, z];
}

// The route: BFS from the spawn over standable ground to within 3 u of the fire.
const island = islandOf(v), S = 0.5, x0 = v.bounds.minX - 5, z0 = v.bounds.minZ - 5, nx = Math.ceil((v.bounds.maxX - x0 + 5) / S), nz = Math.ceil((v.bounds.maxZ - z0 + 5) / S);
const px = (i: number) => x0 + i * S, pz = (k: number) => z0 + k * S, idx = (x: number, z: number) => Math.round((z - z0) / S) * nx + Math.round((x - x0) / S);
const prev = new Int32Array(nx * nz).fill(-2), queue = [idx(sx, sz)];
prev[queue[0]] = -1;
let goal = -1;
for (let q = 0; q < queue.length && goal < 0; q++) {
  const j = queue[q], i = j % nx, k = (j - i) / nx, h = island.ground(px(i), pz(k));
  if (Math.hypot(px(i) - fire.x, pz(k) - fire.z) < 3.2) { goal = j; break; }
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = (k + dk) * nx + i + di, x = px(i + di), z = pz(k + dk);
    if (i + di < 0 || k + dk < 0 || i + di >= nx || k + dk >= nz || prev[c] !== -2 || !island.standable(x, z) || island.ground(x, z) - h > 0.4) continue;
    prev[c] = j; queue.push(c);
  }
}
const path: [number, number][] = [];
for (let j = goal; j >= 0; j = prev[j]) path.unshift([px(j % nx), pz(Math.floor(j / nx))]);
const route = path.filter((_, i) => i % 8 === 0 || i === path.length - 1);
console.log(JSON.stringify({ world: GAME_WORLD, spawn: [sx, sz], fire: { x: fire.x, z: fire.z }, cast, route }));
