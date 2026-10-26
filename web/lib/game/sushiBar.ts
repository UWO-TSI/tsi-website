/**
 * The sushi bar (game/sushi-bar; art/buildings/build_sushi_bar.py; David's plan, specs/launch/sushi-bar.md): on stilts
 * over the water, its pier to the sand; open in the evening and at night, when E at the entrance takes you in to a free
 * stool, seen first person; its light, its staff's work loops and where they stand while it's closed. All in the bar's
 * own frame (the origin at the middle of its kitchen core, on its floor; the guests' deck, the entrance and the pier
 * toward +z, the open window onto the sea toward -z), and where those are in the world for a placed bar.
 */
import type { OwnerStation } from "./cafe";
import type { Pool } from "./hqLight";
import type { IslandPhase } from "./islandTime";
import { objectsOf, village, type MapObject, type Village } from "./villageMap";

export const SUSHI_BAR = "sushi-bar";
/** The stools along the counter (the builder's SEATS, SEAT_Z, SEAT_TOP): x, their row's z, and the seat's top. */
export const STOOLS = [-2.25, -1.15, -0.05, 1.05, 2.15, 3.25] as const;
export const STOOL_Z = 2.05, STOOL_TOP = 0.6;
/** The order guests are seated in, from the middle outward: whoever comes in next sits beside the last one in. */
const SEAT_ORDER = [2, 3, 1, 4, 0, 5] as const;
/** The bar's floor in the world: on its stilts, 0.78 over the sea (the kitchen core's ground, so what stands on it). */
export const BAR_Y = 0.7;
/**
 * Where the bar is walked (defaultIsland barDecks; the builder's LAND_*, WALK_*): the kitchen core at BAR_Y (solid, its
 * footprint), the landing outside the entrance and the boardwalk falling `rise` to the sand. Not the guests' deck: you
 * come in by the entrance (barSeat).
 */
export const BAR_DECKS = [
  { x0: -4.05, x1: 4.05, z0: -1.5, z1: 1.5, y: BAR_Y },
  { x0: -1.4, x1: 1.4, z0: 4.4, z1: 6, y: BAR_Y + 0.04 },
  { x0: -0.8, x1: 0.8, z0: 6, z1: 12, y: BAR_Y + 0.04, rise: -0.4 },
] as const;
/** The entrance (on the landing, before the gate) and how near it E takes you in; where getting up puts you. */
export const ENTRY = [0, 5] as const, ENTRY_RANGE = 1.5;
const EXIT = [0, 5.3] as const;
/** The blinds' tops (the builder's HOURS_TOP): they roll up to it as the bar opens. */
export const HOURS_TOP = 2.87;
/** Open for dinner in the evening, a bar at night; closed by day (David: "day is closed ... eveing open, dinner, night more bar vibes"). */
export const barOpen = (phase: IslandPhase) => phase === "evening" || phase === "night";
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
  // Outside, under the lanterns: the landing before the entrance and the boardwalk's end on the sand.
  pool("landing", [0, 0.06, 5.1], "up", [2.2, 1.1], 0.5),
  pool("walk-end", [0, -0.3, 11.4], "up", [1.1, 0.9], 0.45),
];
/** The seated camera's eye and the point it looks at, in the world (written each frame while you sit at the bar). */
export interface BarView { eye: { x: number; y: number; z: number }; look: { x: number; y: number; z: number } }

/** Inside this (from the bar's middle) the bar's music plays; past BAR_MUSIC_OUT it lets go (no flicker at the edge). */
export const BAR_MUSIC_IN = 8, BAR_MUSIC_OUT = 10;

/**
 * The staff's work loops behind the counter (cafe.ts ownerAt; facing the guests is yaw 0, the back counter π). The chef
 * (David's "Bancha": cool and focused, he rarely talks) works the fish case and the cutting board; the server (a
 * cheerful diver, his name David's call) goes up and down the counter, picks up plates and serves.
 */
const GUESTS = 0, BACK = Math.PI;
export const CHEF_STATIONS: readonly OwnerStation[] = [
  { at: [-1.6, 0.25], yaw: GUESTS, stay: 6, clip: "Trace" }, { at: [-1.6, -0.5], yaw: BACK, stay: 4, clip: "Trace" },
  { at: [-0.3, 0.25], yaw: GUESTS, stay: 6, clip: "Trace" }, { at: [0.3, -0.5], yaw: BACK, stay: 4, clip: "Trace" },
  { at: [-0.8, 0.2], yaw: GUESTS, stay: 3, clip: "Idle" },
];
export const SERVER_STATIONS: readonly OwnerStation[] = [
  { at: [2.9, 0.3], yaw: GUESTS, stay: 4, clip: "Idle" }, { at: [1.5, -0.5], yaw: BACK, stay: 1.3, clip: "Forage" },
  { at: [1.1, 0.3], yaw: GUESTS, stay: 3, clip: "Trace" }, { at: [2.2, -0.5], yaw: BACK, stay: 3, clip: "Trace" },
  { at: [3.3, 0.3], yaw: GUESTS, stay: 3, clip: "Trace" },
];
/** While it's closed the chef stands on the landing beside the entrance, looking up the beach (his quests come later). */
export const CHEF_OUTSIDE = { at: [-1.75, 5.05] as const, yaw: 0 };
/**
 * Their looks (the shared rig's parts; palette.json outfit colours): the chef in a white shirt and indigo trousers,
 * gold shades, his hair full; the server in a navy diving suit, yellow boots for fins, all smiles. Our own designs.
 */
export const CHEF_LOOK = {
  skin: 10, hair: 0, back: "hair_fluffy_boy", eyes: "focused", mouth: "deadpan", acc: { face: "acc_gold_rimless_shades" },
  top: "top_collar_shirt", bottom: "bottom_trousers", shoes: "shoes_slipon", colors: { top_collar_shirt: 1, bottom_trousers: 12, shoes_slipon: 14 },
} as const;
export const SERVER_LOOK = {
  skin: 4, hair: 1, back: "hair_short_tufts", eyes: "F1.1", mouth: "open_smile", extras: ["blush"],
  top: "top_raincoat", bottom: "bottom_trousers", shoes: "shoes_rainboots", colors: { top_raincoat: 12, bottom_trousers: 12, shoes_rainboots: 6 },
} as const;

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

/** A stool as a `tsi:sit` detail: facing the window, its claim key, first person (your own avatar hidden), getting up at the entrance. */
export interface BarSeat { x: number; z: number; yaw: number; key: string; top: number; hide: true; exit: { x: number; z: number; yaw: number } }

/**
 * What E sits you on at the bar: the stool you're on (E again gets you up), or, at the entrance while it's open, the
 * next free stool in SEAT_ORDER (friends side by side); null when none.
 */
export function barSeat(bar: Bar, x: number, z: number, open: boolean, taken?: (key: string) => boolean): BarSeat | null {
  let i = stoolAt(bar, x, z);
  if (i < 0) {
    const [ex, ez] = barPoint(bar, ...ENTRY);
    if (!open || Math.hypot(ex - x, ez - z) > ENTRY_RANGE) return null;
    i = SEAT_ORDER.find(j => !taken?.(stoolKey(bar, j))) ?? -1;
    if (i < 0) return null;
  }
  const [sx, sz] = barPoint(bar, STOOLS[i], STOOL_Z), [ox, oz] = barPoint(bar, ...EXIT), yaw = bar.yaw ?? 0;
  return { x: sx, z: sz, yaw: yaw + Math.PI, key: stoolKey(bar, i), top: STOOL_TOP, hide: true, exit: { x: ox, z: oz, yaw } };
}

/** The stool (x, z) is on (a seated player is set exactly on it), or -1. */
export const stoolAt = (bar: Bar, x: number, z: number) => STOOLS.findIndex(lx => { const [sx, sz] = barPoint(bar, lx, STOOL_Z); return Math.hypot(sx - x, sz - z) < 0.05; });

/**
 * The seated view, first person (David: "first person at the bar ... seeking the food infront of you"): from your eyes on
 * the stool at lx, level across the counter at the chef, the sea through the window behind him. The eye and the point it
 * looks at in the bar's frame (x, y over its floor, z).
 */
export function seatView(lx: number): { eye: [number, number, number]; look: [number, number, number] } {
  return { eye: [lx, STOOL_TOP + 0.82, STOOL_Z - 0.08], look: [lx * 0.85, STOOL_TOP + 0.66, -2.5] };
}
