/**
 * The member island's map before the full world loads (lib/game/world/load.ts swaps the heightfield in) and on the
 * server: the new world's cell view (web/data/world/cells.json, since the server can't decode the PNGs) with its
 * document's objects and river. Importing this registers it as `village()`'s default, so only the code that plays the
 * member island (the game, the title, the server's catch checks, the tests) bundles the world document; the applicant
 * island doesn't.
 */
import worldCells from "@/data/world/cells.json";
import worldDoc from "@/data/world/world.json";
import type { MapAnnotation } from "../grid";
import { parseObjects, setMemberVillage, type VillageDoc } from "../villageMap";
import { villageOfCells, type WorldCells } from "./cells";

setMemberVillage(() =>
  villageOfCells(worldCells as WorldCells, parseObjects(worldDoc.objects as VillageDoc["objects"]), worldDoc.annotations as MapAnnotation[]));
