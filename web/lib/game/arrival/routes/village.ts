/**
 * Bram's walk-along on the village (the current map; playtest round 1, David's walk-along note). Data only: when the
 * tutorial moves to the new map, write that world's file beside this one with its own places.
 *
 * Dock-frame places: x across the pier, z toward the land (the wharf landmark's frame, lib/game/wharf.ts). The boat
 * lands you near the pier's tip; the fish crate fills the deck a little way up; the land end is past z 1.
 */
import type { TutorialRoute } from "../route";

/** The fish crate across the pier (dock frame): the dock's movement bit, hopped on the way up. */
const CRATE_Z = -0.95;

export const VILLAGE_ROUTE: TutorialRoute = {
  world: "village",
  // Off the pier's boat side.
  crossFrom: { x: 14, z: -46, yaw: -0.24 },
  crates: [{ at: { dock: [0, CRATE_Z] }, yaw: 0.03 }],
  stops: [
    // Beside the boat as you land; then over the crate, and he waits on the far side for you to hop it too.
    { id: "dock", stand: { dock: [-0.5, -1.95] },
      task: { kind: "reach", id: "crate", at: { dock: [0.05, CRATE_Z + 0.62] }, radius: 0.45, hint: "jump",
        wait: [{ dock: [0.05, CRATE_Z - 0.6] }, { dock: [0.05, CRATE_Z + 0.55], hop: true }, { dock: [0.45, CRATE_Z + 1.3] }] } },
    // The street: a building's front each, Bram a step to the side of its door.
    { id: "museum", stand: { landmark: "museum", point: "exit", offset: [1.2, -0.6] } },
    { id: "shop", stand: { landmark: "shop", point: "exit", offset: [1.2, -0.6] } },
    { id: "hq", stand: { landmark: "hq", point: "exit", offset: [1.2, -0.6] } },
    { id: "cafe", stand: { landmark: "cafe", point: "exit", offset: [1.2, -0.6] } },
    // The beach west of the wharf, on the sand by the water: the rod, then a catch.
    { id: "beach", stand: { landmark: "beach", offset: [-1.6, 0.3] }, gives: "rod", task: { kind: "catch", id: "catch" } },
    // Where you caught it: what you've collected (B), where fish sell (the wharf shack), the museum, the shop.
    { id: "collection", stand: { landmark: "beach", offset: [-1.6, 0.3] }, task: { kind: "bag", id: "bag" } },
  ],
};
