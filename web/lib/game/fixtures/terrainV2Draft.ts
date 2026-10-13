/**
 * The world map (terrain v2): David's drawn world (specs/references/terrain/terrainv1.png), first rasterised by
 * art/terrain/draft_from_png.py and FROZEN on 2026-10-10. Since then `web/data/world-map.json` is the source of
 * truth: David edits it in the painter (`/lab/map?fixture=v2`, Save writes the file through /api/lab/world-map),
 * and the generator only returns for explicit regional passes merged into it. Never regenerate over it.
 * `/lab/island?fixture=v2` walks it.
 */
import draft from "@/data/world-map.json";
import type { VillageDoc } from "../villageMap";

export function terrainV2DraftDoc(): VillageDoc {
  return draft as unknown as VillageDoc;
}
