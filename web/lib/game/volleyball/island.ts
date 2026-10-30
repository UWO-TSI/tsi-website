/**
 * The court on an island, for everything that isn't the match: its footprint (the court and its free zone), which the
 * residents' routes keep off (lib/game/residentRoutine NavGrid), and the leaderboard board beside it. Pure.
 */
import { COURT, toLocal, toWorld, type CourtPlace } from "./court";
import { objectsOf, type Village } from "@/lib/game/villageMap";

/** Every volleyball court on this island (its net prop's middle and turn). */
export const courtsOf = (v: Village): CourtPlace[] =>
  objectsOf("prop", v).filter(o => o.model === "volleyball-net").map(o => ({ x: o.x, z: o.z, yaw: o.yaw ?? 0 }));

/** The footprint's half sizes in the court's frame (across the net, along the court): the court and its free zone. */
const HALF = { x: COURT.halfWidth + COURT.free, z: COURT.halfLength + COURT.free } as const;

/** Whether a point is on a court or its free zone (grown by `margin`). */
export function onCourt(courts: readonly CourtPlace[], x: number, z: number, margin = 0): boolean {
  for (const c of courts) {
    const [lx, lz] = toLocal(c, x, z);
    if (Math.abs(lx) <= HALF.x + margin && Math.abs(lz) <= HALF.z + margin) return true;
  }
  return false;
}

/** The point itself if it's off every court, else the nearest point just outside the footprint it's on. */
export function offCourt(courts: readonly CourtPlace[], x: number, z: number, margin = 0.8): [number, number] {
  for (const c of courts) {
    const [lx, lz] = toLocal(c, x, z), hx = HALF.x + margin, hz = HALF.z + margin;
    if (Math.abs(lx) > hx || Math.abs(lz) > hz) continue;
    // Out across the nearer edge.
    const [ox, oz] = hx - Math.abs(lx) < hz - Math.abs(lz) ? [Math.sign(lx || 1) * hx, lz] : [lx, Math.sign(lz || 1) * hz];
    return toWorld(c, ox, oz);
  }
  return [x, z];
}

/** The leaderboard board beside the court (generate.ts places it as the prop `volley-board`). */
export const BOARD_ID = "volley-board";
/** The board's model (the plaza's catch board, propModels CATCH_BOARD_URL): its origin at the left end, 1.68 along +x. */
export const BOARD_WIDTH = 1.68;
/** Where you read it from: in front of the board's middle (world), or null when this island has none. */
export function boardSpot(v: Village): { x: number; z: number } | null {
  const b = objectsOf("prop", v).find(o => o.id === BOARD_ID);
  if (!b) return null;
  const yaw = b.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw), h = BOARD_WIDTH / 2;
  // The board's local +x is (cos, -sin) in the world, its front (+z) is (sin, cos).
  return { x: b.x + h * c + 0.9 * s, z: b.z - h * s + 0.9 * c };
}
