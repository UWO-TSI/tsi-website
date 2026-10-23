/** Bram's walk-along per world (route.ts, lib/game/world/active.ts). */
import type { TutorialRoute } from "../route";
import { NEW_ROUTE } from "./new";
import { VILLAGE_ROUTE } from "./village";

export const ROUTES: Readonly<Record<string, TutorialRoute>> = { village: VILLAGE_ROUTE, new: NEW_ROUTE };
/** The route for a world, or the village's. */
export const routeFor = (world: string): TutorialRoute => ROUTES[world] ?? VILLAGE_ROUTE;
