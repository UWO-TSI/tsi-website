/**
 * Bram's walk-along on the new world (web/data/world), the first ten minutes as David set them (t-short, t-sell,
 * specs/launch/v1-gameplay.md; his v2 review, 2026-10-27): off the boat, and on the dock he has you jump the box and
 * dash. Then HQ first: he walks you to its door and you go in to Alice while he waits outside. Out again, one E opens
 * the camera conversation and he points out the museum, the café and the shop, a line and a shot each. Down on the
 * wharf the same for the tackle shop and the shipwright's; then to the quay's edge, his rod for a first catch, the sell
 * barrel to sell it, and straight on (no E) the hand-over: he keeps nothing back, the rod's yours.
 * Places are the wharf's dock frame, landmarks and map props by id; routes.test.ts checks them on the committed world.
 */
import type { TutorialRoute } from "../route";

/** The box across the dock (dock frame: x across, z toward the land): hopped on the way up. A tutorial prop only. */
const BOX_Z = -0.95;
/** Past the box, where he waits for you to hop it, then to dash. */
const PAST_BOX = { dock: [0.45, BOX_Z + 1.3] } as const;
/** Where he waits by HQ's door: in, and out again. */
const HQ_DOOR = { landmark: "hq", point: "exit", offset: [1.2, -0.6] } as const;
/** On the wharf by the tackle shop, the shipwright's in view: the camera conversation's spot. */
const WHARF = { prop: "tackle-shop", offset: [-4, 0] } as const;
/** Beside the sell barrel along the quay, at the deck's water edge (the sea is +x there: the quay's barrel sits a step in from it). */
const BARREL = { prop: "sell-barrel", offset: [0.3, 2.0] } as const;
/** A little further along the quay for the first cast: out of the barrel's reach (its E is Sell), the water in reach. */
const CAST = { prop: "sell-barrel", offset: [0.3, 3.6] } as const;

export const NEW_ROUTE: TutorialRoute = {
  world: "new",
  // The boat side of the new wharf has an islet out to sea, so the boat comes in off the other side.
  crossFrom: { x: -14, z: -46, yaw: 0.24 },
  crates: [{ at: { dock: [0, BOX_Z] }, yaw: 0.03 }],
  talk: "box",
  end: "none",
  stops: [
    // Beside the boat as you land; then over the box, and he waits on the far side for you to hop it too.
    { id: "dockNew", stand: { dock: [-0.5, -1.95] },
      task: { kind: "reach", id: "box", at: { dock: [0.05, BOX_Z + 0.62] }, radius: 0.45, hint: "jump",
        wait: [{ dock: [0.05, BOX_Z - 0.6] }, { dock: [0.05, BOX_Z + 0.55], hop: true }, PAST_BOX] } },
    // Straight on: a dash (he's already there, no E).
    { id: "dash", stand: PAST_BOX, auto: true, task: { kind: "dash", id: "dash" } },
    { id: "hqFirst", stand: HQ_DOOR, task: { kind: "hq", id: "alice" } },
    { id: "sights", stand: HQ_DOOR, shots: [null, { landmark: "museum" }, { landmark: "cafe" }, { landmark: "shop" }, null] },
    { id: "wharf", stand: WHARF, shots: [null, { prop: "tackle-shop" }, { prop: "shipwright-ship" }, null] },
    { id: "cast", stand: CAST, gives: "rod", task: { kind: "catch", id: "catch" } },
    { id: "barrel", stand: BARREL, task: { kind: "sell", id: "sell" } },
    // The hand-over cutscene, straight on from the sale: the camera close on him as he holds out the rod.
    { id: "keep", stand: BARREL, auto: true, holds: "rod", shots: [null, null, "bram"] },
  ],
};
