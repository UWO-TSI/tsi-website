/**
 * Terrain v2 DRAFT: David's drawn world map (specs/references/terrain/terrainv1.png)
 * rasterised onto the grid by art/terrain/draft_from_png.py. A sizing draft for
 * walking and iterating proportions, never the shipped island.
 * `/lab/island?fixture=v2` walks it; `/lab/map?fixture=v2` opens it in the painter.
 */
import draft from "@/data/terrain-v2-draft.json";
import type { VillageDoc } from "../villageMap";

export function terrainV2DraftDoc(): VillageDoc {
  return draft as unknown as VillageDoc;
}
