/**
 * Where the beach campfire stands (specs/v1-drop.md §3): the map's `campfire` object, which the island's painter places
 * (lab/map); until it does, the open sand nearest the `beach` landmark with room for both rings round it (dry,
 * standable and nearly level on every ring, clear of furniture, trees and study tables). Built once per village.
 */
import { FIRE, type Spot } from "./campfire";
import { villageIsland } from "./defaultIsland";
import { objectById, objectsOf, village, type ObjectKind, type Village } from "./villageMap";

const found = new WeakMap<Village, Spot | null>();
/** The rings' room: these radii round the fire must all be open ground. */
const RINGS = [1.1, FIRE.sitRadius, FIRE.danceRadius, FIRE.danceRadius + 0.4];
/**
 * Things that stand in the way of the rings, and how far off the fire keeps them: a study table with its parasol and
 * chairs well clear of the dance ring, anything else (a tree, a bush, a bench, a lamp, the spawn) a step beyond it.
 */
const KEEP_CLEAR: Partial<Record<ObjectKind, number>> = { study: FIRE.danceRadius + 3.6, bench: FIRE.danceRadius + 1.2, spawn: FIRE.danceRadius + 2,
  tree: FIRE.danceRadius + 0.4, rock: FIRE.danceRadius + 0.4, bush: FIRE.danceRadius, lamp: FIRE.danceRadius + 0.4, fence: FIRE.danceRadius + 0.4,
  fitting: FIRE.danceRadius + 1.5, missions: FIRE.danceRadius + 1.5, bridge: FIRE.danceRadius + 1.5 };

export function campfireSite(v: Village = village()): Spot | null {
  if (found.has(v)) return found.get(v)!;
  const placed = objectsOf("campfire", v)[0];
  let site: Spot | null = placed ? { x: placed.x, z: placed.z, ...(placed.scale ? { scale: placed.scale } : {}) } : null;
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
  const things = (Object.keys(KEEP_CLEAR) as ObjectKind[]).flatMap(k => objectsOf(k, v).map(o => ({ x: o.x, z: o.z, r: KEEP_CLEAR[k]! })));
  const fits = (cx: number, cz: number) => {
    if (!island.standable(cx, cz) || things.some(o => Math.hypot(o.x - cx, o.z - cz) < o.r)) return false;
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
      if (fits(cx, cz)) return { x: Math.round(cx * 100) / 100, z: Math.round(cz * 100) / 100 };
    }
  }
  return null;
}
