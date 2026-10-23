/**
 * Which world the member island plays (specs/launch/v1-new-world.md, ledger row 318): `NEXT_PUBLIC_GAME_WORLD=new` is
 * the smooth world (web/data/world), anything else the village (web/data/village-map.json), the fallback. Inlined at
 * build time on the client and the server alike, so the server's catch checks (lib/collections/rolls.ts) judge the
 * world the client walks. Flipping it needs a redeploy. The applicant island and the title keep their own maps.
 */
export type GameWorld = "village" | "new";
export const gameWorld = (env = process.env.NEXT_PUBLIC_GAME_WORLD): GameWorld => (env === "new" ? "new" : "village");
export const GAME_WORLD = gameWorld();
