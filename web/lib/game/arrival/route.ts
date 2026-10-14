/**
 * Bram's walk-along as data (playtest round 1, decision 5): where each stop is, what happens there, and the crates on
 * the way. One route file per world (routes/), so moving the tutorial to the new map is a data change only: new
 * places for the same stops, or new stops (their lines and tracker labels are lib/game/arrival/lines.ts, by stop id).
 *
 * A stop: Bram walks to `stand` (after any fixed `via` waypoints: the pier, a crate's hop) with a "!" over his head and
 * waits. You talk to him (E); he says the stop's lines; if the stop `gives` something he hands it over; then its `task`
 * if it has one (hop the crate, catch a fish, open your collection), then on to the next stop.
 */
import type { LandmarkId } from "@/lib/game/defaultIsland";

export type XZ = { x: number; z: number };
/**
 * A place in a world: in the wharf's dock frame (x across the pier, z toward the land), at a landmark (its door or
 * exit point, or its middle, then an offset in world axes), or a plain world point.
 */
export type Place =
  | { dock: readonly [number, number] }
  | { landmark: LandmarkId; point?: "door" | "exit"; offset?: readonly [number, number] }
  | { world: readonly [number, number] };
/** A waypoint on Bram's way; `hop`: the leg to it is a jump (over a crate). */
export type Waypoint = Place & { hop?: boolean };

export type TutorialTask =
  /** Get to `at` (within `radius`): the dock's crate hop. Bram waits at the end of `wait` (his way over it). */
  | { kind: "reach"; id: string; at: Place; radius: number; wait?: readonly Waypoint[]; hint: "jump" | "follow" }
  /** Land a fish (the rod is out of the bag by now). */
  | { kind: "catch"; id: string }
  /** Open your collection (B). */
  | { kind: "bag"; id: string };

export interface TutorialStop {
  /** Its lines (lines.ts STOP_LINES) and its tracker label (TRACKER) go by this id. */
  id: string;
  /** Where Bram waits with the "!" to be talked to. */
  stand: Place;
  /** Fixed waypoints he walks first (the pier, a hop); after them he finds his own way round every solid. */
  via?: readonly Waypoint[];
  /** What he hands over at the end of the talk (the wheel holds only what he has given until the walk is done). */
  gives?: "rod";
  task?: TutorialTask;
}

export interface TutorialRoute {
  /** The world it belongs to (the village today; the new map later). */
  world: string;
  stops: readonly TutorialStop[];
  /** Crates on the way (the dock's movement bit): each solid, its lid a hop high, turned `yaw`. */
  crates: readonly { at: Place; yaw?: number }[];
}

/** What a place needs resolved against: the wharf's dock (its frame) and the landmarks' points. */
export interface PlaceWorld {
  dock: { x: number; z: number; yaw: number } | null;
  landmark: (id: LandmarkId, point?: "door" | "exit") => XZ | null;
}

/** A place in world XZ (null when the world hasn't got it: no wharf, the landmark isn't placed). */
export function resolvePlace(p: Place, w: PlaceWorld): XZ | null {
  if ("world" in p) return { x: p.world[0], z: p.world[1] };
  if ("dock" in p) {
    if (!w.dock) return null;
    const c = Math.cos(w.dock.yaw), s = Math.sin(w.dock.yaw), [x, z] = p.dock;
    return { x: w.dock.x + x * c + z * s, z: w.dock.z - x * s + z * c };
  }
  const at = w.landmark(p.landmark, p.point);
  return at && { x: at.x + (p.offset?.[0] ?? 0), z: at.z + (p.offset?.[1] ?? 0) };
}

/** A stop with its places resolved (what the tutorial's pure state machine reads). */
export interface ResolvedStop {
  id: string; stand: XZ; via: (XZ & { hop?: boolean })[]; gives?: "rod";
  task?: { kind: "reach"; id: string; at: XZ; radius: number; wait: (XZ & { hop?: boolean })[]; hint: "jump" | "follow" } | { kind: "catch"; id: string } | { kind: "bag"; id: string };
}

/** The route in world XZ. A stop or waypoint its world can't place falls back to the last place before it. */
export function resolveRoute(route: TutorialRoute, w: PlaceWorld, origin: XZ): ResolvedStop[] {
  let last = origin;
  const at = (p: Place) => { const r = resolvePlace(p, w) ?? last; last = r; return r; };
  const way = (ws: readonly Waypoint[] = []) => ws.map(p => ({ ...at(p), ...(p.hop ? { hop: true } : {}) }));
  return route.stops.map(s => {
    const via = way(s.via), stand = at(s.stand);
    const t = s.task;
    const task: ResolvedStop["task"] = !t ? undefined
      : t.kind === "reach" ? { kind: "reach", id: t.id, wait: way(t.wait), at: at(t.at), radius: t.radius, hint: t.hint }
      : { kind: t.kind, id: t.id };
    return { id: s.id, stand, via, ...(s.gives ? { gives: s.gives } : {}), ...(task ? { task } : {}) };
  });
}
