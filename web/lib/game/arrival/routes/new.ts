/**
 * Bram's walk-along on the new world (web/data/world), the first ten minutes as David set them (t-short, t-sell,
 * specs/launch/v1-gameplay.md): off the boat and over the crate (the dock, as the village's), then HQ first: he walks you
 * to its door and you go in to Alice while he waits outside. Out again, one E opens the camera conversation and he
 * points out the museum, the café and the shop from there, a line each framing it. Then down the wharf, pausing by the
 * shipwright and the tackle shop without stopping to talk, to the sell barrel: his rod, a first catch, the barrel.
 * Places are the wharf's dock frame, landmarks and map props by id; routes.test.ts checks them on the committed world.
 */
import type { TutorialRoute } from "../route";
import { VILLAGE_ROUTE } from "./village";

/** Where he waits by HQ's door: in, and out again. */
const HQ_DOOR = { landmark: "hq", point: "exit", offset: [1.2, -0.6] } as const;
/** Beside the sell barrel on the wharf's deck, the water in front. */
const BARREL = { prop: "sell-barrel", offset: [-1.4, 1.4] } as const;

export const NEW_ROUTE: TutorialRoute = {
  world: "new",
  // The boat side of the new wharf has an islet out to sea, so the boat comes in off the other side.
  crossFrom: { x: -14, z: -46, yaw: 0.24 },
  crates: VILLAGE_ROUTE.crates,
  talk: "box",
  end: "free",
  stops: [
    VILLAGE_ROUTE.stops[0],
    { id: "hqFirst", stand: HQ_DOOR, task: { kind: "hq", id: "alice" } },
    { id: "sights", stand: HQ_DOOR, shots: [null, { landmark: "museum" }, { landmark: "cafe" }, { landmark: "shop" }, null] },
    { id: "wharf", stand: BARREL, gives: "rod", task: { kind: "catch", id: "catch" },
      via: [
        { prop: "shipwright-ship", offset: [-4.2, -0.5], pause: 1.8, face: { prop: "shipwright-ship" }, say: "shipwright" },
        { prop: "tackle-shop", offset: [-4, 0], pause: 1.8, face: { prop: "tackle-shop" }, say: "tackle" },
      ] },
    { id: "barrel", stand: BARREL, task: { kind: "sell", id: "sell" } },
  ],
};
