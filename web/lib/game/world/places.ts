/**
 * Where you are by name (round 7, David: "the biome tag should also show like the location like village wharf plains
 * etc"): the world's painted areas (web/data/world/world.json annotations) a player knows, the smallest one you stand in.
 * The houses and lots read as the village.
 */
import doc from "@/data/world/world.json";

const NAMES = {
  "Village (re-plan)": "Village", Wharf: "Wharf", Beach: "Beach", Meadow: "Meadow", Mountain: "Mountain",
  "Ruins in forest": "Ruins", "Oracle Temple: the climb is the class pilgrimage": "Oracle Temple", Falls: "Falls",
  "North island": "North Island", "Cave mouth": "Cave", River: "River", "Pond (dry until elevated water)": "Pond", "Lighthouse islet": "Lighthouse", "Islands biome: boat later": "Islands",
} as const;
/** A place the HUD names (each has its icon in the kit's PLACE_LOOK). */
export type Place = (typeof NAMES)[keyof typeof NAMES];
const nameOf = (painted: string): Place | undefined => (NAMES as Record<string, Place>)[painted];
const { width: W, depth: D, originX, originZ } = doc;
const names: Place[] = [];
const at = new Uint8Array(W * D);
// Largest first, so a smaller area inside another (the falls on the mountain) wins its cells.
for (const a of [...doc.annotations].filter(a => nameOf(a.name)).sort((a, b) => b.cells.length - a.cells.length)) {
  const id = names.push(nameOf(a.name)!);
  for (const [cx, cz] of a.cells) at[cz * W + cx] = id;
}
const idAt = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= D ? 0 : at[cz * W + cx]);
/**
 * The named area at world (x, z): the one you stand in, else the nearest within `reach` metres (a deck's end over the
 * sea, a river's bank), else null (out at sea). Cell (0, 0)'s centre is the world's origin.
 */
export function placeAt(x: number, z: number, reach = 6): Place | null {
  const cx = Math.round(x - originX), cz = Math.round(z - originZ);
  let best = 0, bestD = Infinity;
  for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
    const d = dx * dx + dz * dz, id = d < bestD && d <= reach * reach ? idAt(cx + dx, cz + dz) : 0;
    if (id) { best = id; bestD = d; }
  }
  return names[best - 1] ?? null;
}
