/** Bram's walk-along per world (route.ts): the village today; the new map's file goes here when it moves. */
import type { TutorialRoute } from "../route";
import { VILLAGE_ROUTE } from "./village";

export const ROUTES: Readonly<Record<string, TutorialRoute>> = { village: VILLAGE_ROUTE };
/** The route for a world, or the village's. */
export const routeFor = (world: string): TutorialRoute => ROUTES[world] ?? VILLAGE_ROUTE;
