/**
 * Bram's walk-along on the new world (web/data/world): the village's stops, which are all the wharf's dock frame and
 * landmarks by id, so they land wherever the new world puts its wharf, shop, museum, HQ, café and beach. Only the
 * crossing differs: the boat side of the new wharf has an islet out to sea, so the boat comes in off the other side.
 * Tuned to the terrain as of 2026-10-23; routes.test.ts checks it again on whatever world is committed.
 */
import type { TutorialRoute } from "../route";
import { VILLAGE_ROUTE } from "./village";

export const NEW_ROUTE: TutorialRoute = { ...VILLAGE_ROUTE, world: "new", crossFrom: { x: -14, z: -46, yaw: 0.24 } };
