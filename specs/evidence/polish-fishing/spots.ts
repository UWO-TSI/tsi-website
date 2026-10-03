// Fishing evidence: shore spots near the village spawn where a cast has water in reach, with the water's direction.
//   npx vite-node -c web/vitest.config.ts specs/evidence/polish-fishing/spots.ts
import { villageIsland } from "@/lib/game/defaultIsland";
import { villageWater, fishingSpot } from "@/lib/game/fishingSpots";
import { village, villageSpawnPoint } from "@/lib/game/villageMap";

const island = villageIsland(), { classify } = villageWater(), { bounds: b } = village();
const [sx, sz] = villageSpawnPoint();
const out: { x: number; z: number; water: string; dir: number; dist: number; target: [number, number] }[] = [];
for (let x = b.minX; x <= b.maxX; x += 0.5) for (let z = b.minZ; z <= b.maxZ; z += 0.5) {
  if (!island.standable(x, z)) continue;
  const spot = fishingSpot(island.map, classify, x, z);
  if (!spot) continue;
  const dir = Math.round(Math.atan2(spot.target[0] - x, spot.target[1] - z) * 180 / Math.PI);
  out.push({ x, z, water: spot.water, dir, dist: Math.round(Math.hypot(x - sx, z - sz) * 10) / 10, target: [Math.round(spot.target[0] * 100) / 100, Math.round(spot.target[1] * 100) / 100] });
}
out.sort((a, b) => a.dist - b.dist);
console.log(JSON.stringify({ spawn: [sx, sz], count: out.length, near: out.slice(0, 40), ponds: out.filter(o => o.water === "pond").slice(0, 8), sea: out.filter(o => o.water === "sea").slice(0, 8) }));
