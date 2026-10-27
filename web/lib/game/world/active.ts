/**
 * Which world the member island plays (specs/launch/v1-new-world.md, ledger row 318): `NEXT_PUBLIC_GAME_WORLD=new` is
 * the smooth world (web/data/world), anything else the village (web/data/village-map.json), the fallback. Inlined at
 * build time on the client and the server alike, so the server's catch checks (lib/collections/rolls.ts) judge the
 * world the client walks. Flipping it needs a redeploy. The applicant island and the title keep their own maps.
 */
export type GameWorld = "village" | "new";
export const gameWorld = (env = process.env.NEXT_PUBLIC_GAME_WORLD): GameWorld => (env === "new" ? "new" : "village");
export const GAME_WORLD = gameWorld();

/**
 * The dump models the new world draws as our own (game/remodel, art/remodel/): the same file name under
 * /assets/game/remodel/, so one swap covers every place that names the dump's file. The village keeps the dump's.
 */
const REMODELLED = /^\/assets\/acnh\/(fish\/[\w-]+|critters\/(common|tiger|agrias|monarch|peacock|emperor)-butterfly|critters\/(darner|red)-dragonfly|props\/(crab-gazami|crab-hermit|rock-[abc]|fence-rope-a))\.glb$/;
export const worldModel = (url: string, world: GameWorld = GAME_WORLD) =>
  world === "new" && REMODELLED.test(url) ? url.replace("/assets/acnh/", "/assets/game/remodel/") : url;
