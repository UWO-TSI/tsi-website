/**
 * Bram's walk-along as data (playtest round 1, decision 5): where each stop is, what happens there, and the crates on
 * the way (routes/new.ts), so moving it is a data change only: new places for the same stops, or new stops (their lines
 * and tracker labels are lib/game/arrival/lines.ts, by stop id).
 *
 * A stop: Bram walks to `stand` (after any fixed `via` waypoints: the pier, a crate's hop, a building he points out in
 * passing) with a "!" over his head and waits. You talk to him (E); he says the stop's lines (in his bubble, or with
 * the route's `talk: "box"` in the dialogue box, the camera conversation, each line maybe framing a place: `shots`);
 * if the stop `gives` something he hands it over; then its `task` if it has one (hop the crate, Alice's visit at HQ,
 * catch a fish, open the sell barrel, open your collection), then on to the next stop.
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
  /** A map prop by id (the sell barrel, the tackle shop), then an offset in world axes. */
  | { prop: string; offset?: readonly [number, number] }
  | { world: readonly [number, number] };
/** A waypoint on Bram's way; `hop`: the leg to it is a jump (over a crate). */
export type Waypoint = Place & { hop?: boolean };
type Way = XZ & { hop?: boolean };

export type TutorialTask =
  /** Get to `at` (within `radius`): the dock's crate hop. Bram waits at the end of `wait` (his way over it). */
  | { kind: "reach"; id: string; at: Place; radius: number; wait?: readonly Waypoint[]; hint: "jump" | "follow";
    /** Reached once you're past `at` (the way from the first `wait` point to it), anywhere within `radius` across: a hop
     *  over the box counts wherever on the dock you land (a spot to stand on missed real hops, David's playtest). */
    past?: boolean }
  /** Land a fish (the rod is out of the bag by now). */
  | { kind: "catch"; id: string }
  /** Open your collection (B). */
  | { kind: "bag"; id: string }
  /** Go into HQ and do Alice's visit; Bram waits outside (t-short: HQ first). */
  | { kind: "hq"; id: string }
  /** Dash once (Q; David's v2 review: the dock teaches the dash too). */
  | { kind: "dash"; id: string }
  /** Sell something at the sell barrel (t-sell; David's v2 review: the first fish is sold). */
  | { kind: "sell"; id: string };

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
  /** With `talk: "box"`: the place each line frames (by line index; none: the two of you; "bram": close on him). */
  shots?: readonly (Place | null | "bram")[];
  /** He starts it himself once he's there: no E (a beat that follows straight on from the last, the hand-over cutscene). */
  auto?: boolean;
  /** He has this in his hands through the talk and holds it out while the camera's close on him (a `"bram"` shot: the hand-over of his rod). */
  holds?: "rod";
  /** A lesson on the tutorial dock's dressing (the box, the dash run): passed over once the dock is cleared (you've been into HQ). */
  dock?: boolean;
}

export interface TutorialRoute {
  /** Where the first login's crossing starts, far out at sea in the dock's frame, heading in (lib/game/boatTrip.ts). */
  crossFrom: { x: number; z: number; yaw: number };
  stops: readonly TutorialStop[];
  /**
   * How he talks at a stop: "bubble" (the default), his lines over his head, a line at a time; "box", one E opens the
   * camera conversation (the dialogue box, t-short) and the box moves his lines on.
   */
  talk?: "bubble" | "box";
  /** His last word as the walk ends (lines.ts END_LINES); the default END_LINE. */
  end?: string;
  /** Crates on the way (the dock's movement bit): each solid, its lid a hop high, turned `yaw`. */
  crates: readonly { at: Place; yaw?: number }[];
}

/** What a place needs resolved against: the wharf's dock (its frame) and the landmarks' points. */
export interface PlaceWorld {
  dock: { x: number; z: number; yaw: number } | null;
  landmark: (id: LandmarkId, point?: "door" | "exit") => XZ | null;
  prop?: (id: string) => XZ | null;
  /** A place moved off anything walkers keep off (the volleyball court and its free zone); none: as it is. */
  clear?: (p: XZ) => XZ;
}

/** A place in world XZ (null when the world hasn't got it: no wharf, the landmark isn't placed). */
export function resolvePlace(p: Place, w: PlaceWorld): XZ | null {
  if ("world" in p) return { x: p.world[0], z: p.world[1] };
  if ("prop" in p) { const at = w.prop?.(p.prop); return at ? { x: at.x + (p.offset?.[0] ?? 0), z: at.z + (p.offset?.[1] ?? 0) } : null; }
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
  id: string; stand: XZ; via: Way[]; gives?: "rod";
  task?: { kind: "reach"; id: string; at: XZ; radius: number; wait: Way[]; hint: "jump" | "follow"; from?: XZ } | { kind: "catch" | "bag" | "hq" | "dash" | "sell"; id: string };
  /** The camera conversation (the route's `talk: "box"`): his lines go in the dialogue box, a line framing `shots[i]`. */
  box?: boolean; shots?: (XZ | null | "bram")[];
  auto?: boolean; holds?: "rod"; dock?: boolean;
}

/** The route in world XZ. A stop or waypoint its world can't place falls back to the last place before it. */
export function resolveRoute(route: TutorialRoute, w: PlaceWorld, origin: XZ): ResolvedStop[] {
  let last = origin;
  const at = (p: Place) => { const q = resolvePlace(p, w), r = q && w.clear ? w.clear(q) : q ?? last; last = r; return r; };
  const way = (ws: readonly Waypoint[] = []) => ws.map((p): Way => ({ ...at(p), ...(p.hop ? { hop: true } : {}) }));
  return route.stops.map(s => {
    const via = way(s.via), stand = at(s.stand);
    const t = s.task;
    const task: ResolvedStop["task"] = !t ? undefined
      : t.kind === "reach" ? (() => {
        const wait = way(t.wait), to = at(t.at);
        return { kind: "reach" as const, id: t.id, wait, at: to, radius: t.radius, hint: t.hint, ...(t.past && wait[0] ? { from: { x: wait[0].x, z: wait[0].z } } : {}) };
      })()
      : { kind: t.kind, id: t.id };
    const box = route.talk === "box";
    return { id: s.id, stand, via, ...(s.gives ? { gives: s.gives } : {}), ...(task ? { task } : {}), ...(s.auto ? { auto: true } : {}), ...(s.holds ? { holds: s.holds } : {}), ...(s.dock ? { dock: true } : {}),
      ...(box ? { box, ...(s.shots ? { shots: s.shots.map(p => (p === "bram" ? p : p ? resolvePlace(p, w) : null)) } : {}) } : {}) };
  });
}
