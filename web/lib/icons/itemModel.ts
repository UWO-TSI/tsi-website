/**
 * What a shop item is shown as, large (the shop's detail view, the shelves in the shop): its icon's spec
 * (lib/icons/manifest.ts), so the 3D model, its tints and its view match the icon exactly. Finishes (wallpaper and
 * flooring) have a texture, not a model: their spec's view is "roll" or "tile", and the detail view shows their icon.
 */
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS } from "@/lib/wallet/catalogue";
import { iconSpecs, type IconSpec } from "./manifest";
import { iconKey, type IconRow } from "./keys";

let specs: Map<string, IconSpec> | null = null;
const all = () => (specs ??= new Map(iconSpecs([...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS]).map(s => [s.key, s])));

/** An item's icon spec (null if it has none). */
export function itemSpec(row: IconRow): IconSpec | null {
  return all().get(iconKey(row)) ?? null;
}

/** An item's 3D model to turn in the detail view, or null where it has none (a finish's texture, or nothing). */
export function itemModel(row: IconRow): IconSpec | null {
  const s = itemSpec(row);
  return s && s.view !== "roll" && s.view !== "tile" && /\.glb$/.test(s.url) ? s : null;
}

/** Anything's 3D model by its icon key (a catch, a material, a tool: the bag's and the collection's detail views). */
export function keyModel(key: string): IconSpec | null {
  const s = all().get(key) ?? null;
  return s && s.view !== "roll" && s.view !== "tile" && /\.glb$/.test(s.url) ? s : null;
}
