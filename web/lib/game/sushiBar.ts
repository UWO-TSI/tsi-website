/**
 * The sushi bar (game/sushi-bar; art/buildings/build_sushi_bar.py, David's R2c note): its stools, its light, its chefs'
 * work loops and the seated view, in the bar's own frame (the origin at the middle of its solid core, the guests' deck
 * and stools toward +z, the open window onto the sea toward -z), and where those are in the world for a placed bar.
 */
import type { OwnerStation } from "./cafe";
import type { Pool } from "./hqLight";
import { objectsOf, village, type MapObject, type Village } from "./villageMap";

export const SUSHI_BAR = "sushi-bar";
/** The stools along the counter (the builder's SEATS, SEAT_Z, SEAT_TOP): x, their row's z, and the seat's top. */
export const STOOLS = [-2.25, -1.15, -0.05, 1.05, 2.15, 3.25] as const;
export const STOOL_Z = 2.05, STOOL_TOP = 0.6;
/** How close a free stool must be to offer "Sit". */
export const STOOL_RANGE = 0.9;
/** The bar's pool of light at night (one of the LampPool's points), over the counter's middle. */
export const BAR_LIGHT = [0.5, 2.7, 1.8] as const;
/**
 * The bar's warm light at night, faked as HQ's is (lib/game/hqLight.ts, components/game/hq/LampPools.tsx: soft additive
 * patches, one draw, no lights; the coordinator for David: "a glow homey feel ... light up larger area"): the guests'
 * deck and the kitchen floor, the counter top under its lanterns, the counter's face over the stools, the wall over the
 * window with its bottles (kept off the window, the sea shows through it) and the pillars either side of it.
 */
const pool = (id: string, at: [number, number, number], face: Pool["face"], half: [number, number], strength: number, color = "#ffc98a"): Pool =>
  ({ id, level: 0, part: 0, at, face, half, color, strength });
export const BAR_POOLS: readonly Pool[] = [
  pool("deck", [0.4, 0.075, 2.6], "up", [4.6, 1.8], 0.55),
  pool("kitchen", [0.3, 0.07, -0.2], "up", [3.9, 1.3], 0.45),
  ...[-2, 0, 2].map((x, i) => pool(`top-${i}`, [x + 0.5, 0.848, 1.25], "up", [1.5, 0.75], 0.5)),
  pool("face", [0.5, 0.42, 1.52], "+z", [3.7, 0.45], 0.35),
  pool("bottles", [0, 2.97, -1.37], "+z", [4.1, 0.47], 0.45),
  ...[-1, 1].map(sx => pool(`pillar-${sx}`, [sx * 3.62, 1.75, -1.36], "+z", [0.48, 0.8], 0.4)),
];
/** The seated camera's eye and the point it looks at, in the world (written each frame while you sit at the bar). */
export interface BarView { eye: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } }

/** Inside this (from the bar's middle) the bar's music plays; past BAR_MUSIC_OUT it lets go (no flicker at the edge). */
export const BAR_MUSIC_IN = 8, BAR_MUSIC_OUT = 10;

/**
 * The two chefs' work loops behind the counter (cafe.ts ownerAt): facing the guests (0) at the fish case, turned to the
 * back counter (π) at the rice tub, the cutting board and the plates.
 */
const GUESTS = 0, BACK = Math.PI;
export const CHEF_STATIONS: readonly OwnerStation[][] = [
  [{ at: [-1.6, 0.25], yaw: GUESTS, stay: 6, clip: "Trace" }, { at: [-1.6, -0.5], yaw: BACK, stay: 4, clip: "Trace" },
    { at: [-0.5, 0.25], yaw: GUESTS, stay: 5, clip: "Trace" }, { at: [-2.4, 0.2], yaw: GUESTS, stay: 3, clip: "Idle" }],
  [{ at: [1.8, 0.25], yaw: GUESTS, stay: 5, clip: "Trace" }, { at: [0.3, -0.5], yaw: BACK, stay: 5, clip: "Trace" },
    { at: [2.7, 0.25], yaw: GUESTS, stay: 4, clip: "Idle" }, { at: [1.5, -0.5], yaw: BACK, stay: 1.3, clip: "Forage" }],
];
/** Their looks (the shared rig's outfits, palette.json outfit colours): white shirts, an indigo apron and trousers. No names. */
export const CHEF_LOOKS = [
  { skin: 3, hair: 0, back: "hair_short_tufts", top: "top_collar_shirt", bottom: "bottom_trousers", shoes: "shoes_slipon",
    colors: { top_collar_shirt: 1, bottom_trousers: 12, shoes_slipon: 14 } },
  { skin: 7, hair: 1, back: "hair_wispy_ponytail", top: "top_tee", bottom: "bottom_overall_shorts", shoes: "shoes_slipon",
    colors: { top_tee: 1, bottom_overall_shorts: 12, shoes_slipon: 14 } },
] as const;

export type Bar = Pick<MapObject, "id" | "x" | "z" | "yaw">;
/** The world's sushi bar, if it has one. */
export const barOf = (v: Village = village()): Bar | null => objectsOf("prop", v).find(o => o.model === SUSHI_BAR) ?? null;

/** A point of the bar's frame in world XZ (turned as the props are: three's rotation about +y). */
export function barPoint(bar: Bar, lx: number, lz: number): [number, number] {
  const c = Math.cos(bar.yaw ?? 0), s = Math.sin(bar.yaw ?? 0);
  return [bar.x + lx * c + lz * s, bar.z - lx * s + lz * c];
}

/** A stool's claim key (protocol isSeatKey): `sushi:<map id>#<stool>`. */
export const stoolKey = (bar: Bar, i: number) => `sushi:${bar.id}#${i}`;

/**
 * The free stool within reach of (x, z), as a `tsi:sit` spot facing the window, with its claim key and its seat's top
 * over the bar's floor; null when none is free in reach.
 */
export function barSeat(bar: Bar, x: number, z: number, taken?: (key: string) => boolean): { x: number; z: number; yaw: number; key: string; top: number } | null {
  let best: { x: number; z: number; yaw: number; key: string; top: number } | null = null, d = STOOL_RANGE;
  for (let i = 0; i < STOOLS.length; i++) {
    const [sx, sz] = barPoint(bar, STOOLS[i], STOOL_Z), ds = Math.hypot(sx - x, sz - z), key = stoolKey(bar, i);
    if (ds < d && !taken?.(key)) { d = ds; best = { x: sx, z: sz, yaw: (bar.yaw ?? 0) + Math.PI, key, top: STOOL_TOP }; }
  }
  return best;
}

/** The stool (x, z) is on (a seated player is set exactly on it), or -1. */
export const stoolAt = (bar: Bar, x: number, z: number) => STOOLS.findIndex(lx => { const [sx, sz] = barPoint(bar, lx, STOOL_Z); return Math.hypot(sx - x, sz - z) < 0.05; });

/**
 * The seated view (David: "it changes camera anger to more first person"): low and close, just behind and over the
 * shoulder of a guest on a stool, looking across the counter to the open window and the sea. In the bar's frame, from
 * the stool at lx: the eye and the point it looks at (x, y over the bar's floor, z).
 */
export function seatView(lx: number): { eye: [number, number, number]; look: [number, number, number] } {
  return { eye: [lx + 0.3, 1.75, STOOL_Z + 0.75], look: [lx * 0.6, 1.55, -2.0] };
}
