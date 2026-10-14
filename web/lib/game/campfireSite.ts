/**
 * Where the beach campfire stands (specs/v1-drop.md §3): the map's `campfire` object, which the island's painter places
 * (lab/map); until it does, the open sand nearest the `beach` landmark with room for both rings round it (dry,
 * standable and nearly level on every ring, nothing in the way). Built once per village.
 */
import { FIRE, type Spot } from "./campfire";
import { villageIsland } from "./defaultIsland";
import { objectById, objectsOf, village, type Village } from "./villageMap";

const found = new WeakMap<Village, Spot | null>();
/** The rings' room: these radii round the fire must all be open ground. */
const RINGS = [1.1, FIRE.sitRadius, FIRE.danceRadius, FIRE.danceRadius + 0.7];

export function campfireSite(v: Village = village()): Spot | null {
  if (found.has(v)) return found.get(v)!;
  const placed = objectsOf("campfire", v)[0];
  let site: Spot | null = placed ? { x: placed.x, z: placed.z } : null;
  if (!site) {
    const beach = objectById("landmark", "beach", v);
    site = beach ? openSpotNear(v, beach.x, beach.z) : null;
  }
  found.set(v, site);
  return site;
}

/** The nearest spot to (x, z), within 14 u, where the fire and its rings fit. */
function openSpotNear(v: Village, x: number, z: number): Spot | null {
  const island = villageIsland(v);
  const fits = (cx: number, cz: number) => {
    if (!island.standable(cx, cz)) return false;
    const h = island.ground(cx, cz);
    for (const r of RINGS) for (let a = 0; a < 16; a++) {
      const px = cx + Math.sin((a / 16) * Math.PI * 2) * r, pz = cz + Math.cos((a / 16) * Math.PI * 2) * r;
      if (!island.standable(px, pz) || Math.abs(island.ground(px, pz) - h) > 0.35) return false;
    }
    return true;
  };
  for (let r = 0; r <= 14; r += 0.5) {
    const n = Math.max(1, Math.round((r * Math.PI * 2) / 0.5));
    for (let k = 0; k < n; k++) {
      const cx = x + Math.sin((k / n) * Math.PI * 2) * r, cz = z + Math.cos((k / n) * Math.PI * 2) * r;
      if (fits(cx, cz)) return { x: Math.round(cx * 2) / 2, z: Math.round(cz * 2) / 2 };
    }
  }
  return null;
}
