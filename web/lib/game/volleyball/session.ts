/**
 * This player's volleyball match (specs/minigames/beach-volleyball.md): whether one is on, the match itself (stepped by
 * VolleyMatch in the scene, read by the HUD) and where its court is. Phase 1 is local: your bot partner and the two bots
 * exist only here, so a passer-by just sees your avatar moving (it syncs as always, through the avatar's ride).
 */
import { useSyncExternalStore } from "react";
import type { CourtPlace } from "./court";
import { createMatch, type Match } from "./match";
import type { Ground } from "./ball";
import type { MoveWorld } from "@/lib/game/movement/sim";
import { objectsOf, type Village } from "@/lib/game/villageMap";

/** The court in the world: its frame, and the sand's height under the net (the frame's y 0). */
export type CourtSpot = CourtPlace & { y: number };

export const volley = {
  match: null as Match | null,
  spot: null as CourtSpot | null,
  /** HUD-rate state, changed on a phase or a point (not per frame). */
  version: 0,
};

const listeners = new Set<() => void>();
let queued = false;
/** Tell React something the HUD shows changed (a phase, a point); deferred out of the frame loop. */
export function volleyChanged() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; volley.version++; listeners.forEach(l => l()); }, 0);
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Re-renders on volleyChanged; returns whether a match is on. */
export function useVolley(): boolean {
  useSyncExternalStore(subscribe, () => volley.version, () => 0);
  return !!volley.match;
}

let last: { spot: CourtSpot; ground: Ground; world: MoveWorld } | null = null;
/** Start a match on the court at `spot`: you and a bot partner against two bots. `ground`/`world` are the world's. */
export function startVolley(spot: CourtSpot, ground: Ground, world: MoveWorld, seed = Date.now() % 100000, human = true) {
  last = { spot, ground, world };
  const c = Math.cos(spot.yaw), s = Math.sin(spot.yaw);
  const wx = (x: number, z: number) => spot.x + x * c + z * s, wz = (x: number, z: number) => spot.z - x * s + z * c;
  volley.spot = spot;
  volley.match = createMatch({
    seed, human,
    ground: (x, z) => ground(wx(x, z), wz(x, z)) - spot.y,
    world: { top: (x, z) => world.top(wx(x, z), wz(x, z)) - spot.y, wet: (x, z) => world.wet(wx(x, z), wz(x, z)) },
  });
  volleyChanged();
}

/** Play again on the same court. */
export function startVolleyAgain() { if (last) startVolley(last.spot, last.ground, last.world); }

export function stopVolley() {
  volley.match = null;
  volleyChanged();
}

/** The court on an island: the volleyball net's prop (its middle, its turn) and the sand's height there. */
export function courtOf(v: Village, ground: Ground): CourtSpot | null {
  const net = objectsOf("prop", v).find(o => o.model === "volleyball-net");
  return net ? { x: net.x, z: net.z, yaw: net.yaw ?? 0, y: ground(net.x, net.z) } : null;
}
