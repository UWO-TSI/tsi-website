/**
 * The sushi bar (game/sushi-bar; art/buildings/build_sushi_bar.py; David's plan, specs/launch/sushi-bar.md): on stilts
 * over the water, its pier to the sand; open in the evening and at night, when E at the entrance takes you in to a free
 * stool, seen first person; its light, its staff's work loops and where they stand while it's closed. All in the bar's
 * own frame (the origin at the middle of its kitchen core, on its floor; the guests' deck, the entrance and the pier
 * toward +z, the open window onto the sea toward -z), and where those are in the world for a placed bar.
 */
import { walkOf, type OwnerStation } from "./cafe";
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
/**
 * The raised board floor behind the counter the staff stand on (the builder's STAFF_Y): high enough that their hands
 * work the boards on the ledge behind the fish case in the guests' view (David: "first person should be able to see the
 * npcs preparing the food").
 */
export const STAFF_Y = 0.3;
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
  pool("kitchen", [0.3, 0.16, -0.2], "up", [3.3, 0.9], 0.45),
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
 * The staff at work behind the counter (cafe.ts ownerAt on the world clock; facing the guests is yaw 0; David, round 3:
 * "refine sushi cooking movements"; their clips, build_clips.py `-- staff`). The chef (David's "Bancha": cool and
 * focused, he rarely talks) works his two boards on the ledge behind the fish case in turn: he slices the block of fish
 * there (SushiSlice, his knife in hand, a long pull a slice), then makes four nigiri of it, a pinch of rice from the tub
 * at his right shaped in his hand, a slice laid on, set on the geta at his left (SushiShape, one a loop: the hours
 * model's prep-<board>). The server (a cheerful diver, his name David's call) takes each full geta while the chef is at
 * his other board, carries it along the back of the kitchen and slides it onto the serving shelf before a stool
 * (SushiServe), where it stays a while (EAT_S). The builder's BOARDS, GETA_DX, BOARD_Z, TOP_Y and SERVE_* place these:
 * change both together.
 */
export type BarStation = OwnerStation & { board?: number; stool?: number; carry?: boolean };
const GUESTS = 0, AT_BOARD = -0.02;
export const BOARD_X = [-1.5, 0.4] as const;
/** The clips' lengths (build_clips.py staff clips): a slice, a nigiri, a reach across the counter. */
export const SLICE_S = 2, SHAPE_S = 2, SERVE_S = 1.4, PIECES = 4;
/** Where a board's geta sits (its foot), and where a served geta sits on the shelf before stool i (the builder's SERVE_*). */
export const PREP_AT = BOARD_X.map(x => [x + 0.44, 0.84, 0.37] as const);
export const SERVED_AT = STOOLS.map(x => [x, 0.98, 0.72] as const);
export const CHEF_STATIONS: readonly BarStation[] = BOARD_X.flatMap((x, board): BarStation[] => [
  { at: [x, AT_BOARD], yaw: GUESTS, stay: 3 * SLICE_S, clip: "SushiSlice", board },
  { at: [x, AT_BOARD], yaw: GUESTS, stay: PIECES * SHAPE_S, clip: "SushiShape", board },
]);
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Seconds walking from station i to station j along a loop's stations. */
const walking = (stations: readonly BarStation[], i: number, j: number) => { let w = 0; for (let n = i; n < j; n++) w += walkOf(stations, n); return w; };
export const CHEF_LOOP = walking(CHEF_STATIONS, 0, CHEF_STATIONS.length) + CHEF_STATIONS.reduce((t, s) => t + s.stay, 0);
/** A board's geta: when its slicing starts and its nigiri start, in the chef's loop, and when the server takes it up (3 s after the four are done: the chef is at his other board). */
const BOARD_T = BOARD_X.map((_, b) => {
  const slice = CHEF_STATIONS.slice(0, 2 * b).reduce((t, s) => t + s.stay, 0) + walking(CHEF_STATIONS, 0, 2 * b), shape = slice + CHEF_STATIONS[2 * b].stay;
  return { slice, shape, take: shape + PIECES * SHAPE_S + 3 };
});
/** The server's round, three of the chef's loops: from which board to which stool (never where the chef is at work then: the middle stools first). */
const SERVES = [[0, 1], [1, 2], [0, 5], [1, 3], [0, 0], [1, 4]] as const;
const HOME = [3.1, -0.05] as const, LANE_Z = -0.6, PICK_Z = -0.05, SERVE_Z = 0.0;
/** Where in a SushiServe reach the geta changes hands, and how long a served geta stays before it's eaten. */
export const HANDOFF = 0.45, EAT_S = 40;
/**
 * The server's round: from the server's end along the lane at the back of the kitchen to a board's geta, taken up,
 * carried to a stool, slid onto the shelf, and back to the end; each wait at the end timed so the pick-up lands on its
 * board's `take`, the rest of the round waited out at the end. `start` is the chef's loop time the round starts at.
 */
export const SERVER = (() => {
  const stations: BarStation[] = [];
  const add = (x: number, z: number, more: Partial<BarStation> = {}) => stations.push({ at: [x, z], yaw: GUESTS, stay: 0, clip: "Idle", ...more }) - 1;
  const homes = SERVES.map(([board, stool]) => {
    const gx = PREP_AT[board][0], sx = STOOLS[stool], home = add(HOME[0], HOME[1]);
    add(HOME[0], LANE_Z); add(gx, LANE_Z); add(gx, PICK_Z, { stay: SERVE_S, clip: "SushiServe", board });
    add(gx, LANE_Z, { carry: true }); add(sx, LANE_Z, { carry: true }); add(sx, SERVE_Z, { stay: SERVE_S, clip: "SushiServe", stool, carry: true });
    add(sx, LANE_Z); add(HOME[0], LANE_Z);
    return home;
  });
  const end = add(HOME[0], HOME[1]);
  const due = SERVES.map(([board], k) => Math.floor(k / 2) * CHEF_LOOP + BOARD_T[board].take);
  const start = due[0] - 1 - walking(stations, homes[0], homes[0] + 3);
  const picks: { at: number; board: number }[] = [], serves: { at: number; stool: number }[] = [];
  let t = 0;
  stations.forEach((s, i) => {
    const k = homes.indexOf(i);
    if (k >= 0) s.stay = due[k] - start - t - walking(stations, i, i + 3);
    if (i === end) s.stay = 3 * CHEF_LOOP - t;
    if (s.board !== undefined) picks.push({ at: t, board: s.board });
    if (s.stool !== undefined) serves.push({ at: t, stool: s.stool });
    t += s.stay + walkOf(stations, i);
  });
  return { stations: stations as readonly BarStation[], start, picks, serves, loop: 3 * CHEF_LOOP };
})();

/** How many of board b's nigiri are on its geta at chef loop time t (0 to PIECES), or -1 when the server has taken it. */
export function prepAt(b: number, t: number): number {
  const { slice, shape, take } = BOARD_T[b], u = mod(t, CHEF_LOOP), gone = take + SERVE_S * HANDOFF;
  if (mod(u - gone, CHEF_LOOP) < mod(slice - gone, CHEF_LOOP)) return -1;
  if (mod(u - slice, CHEF_LOOP) < shape - slice) return 0;
  return Math.min(PIECES, Math.floor(mod(u - shape, CHEF_LOOP) / SHAPE_S + 0.12));
}
/** Whether a served geta is on the shelf before stool i at chef loop time t (set down mid-reach, eaten EAT_S later). */
export function servedAt(i: number, t: number): boolean {
  const r = mod(t - SERVER.start, SERVER.loop);
  for (const s of SERVER.serves) if (s.stool === i && mod(r - s.at - SERVE_S * HANDOFF, SERVER.loop) < EAT_S) return true;
  return false;
}
/** While it's closed the chef stands on the landing beside the entrance, looking up the beach (his quests come later). */
export const CHEF_OUTSIDE = { at: [-1.75, 5.05] as const, yaw: 0 };
/**
 * Their looks (the shared rig's parts; palette.json outfit colours): the chef in a white shirt and indigo trousers,
 * gold shades, his hair full; the server in a navy diving suit, yellow boots for fins, all smiles. Our own designs.
 */
export const CHEF_LOOK = { acc: { face: "acc_gold_rimless_shades" }, back: "hair_freeform_afro", bottom: "bottom_trousers", colors: { bottom_trousers: 12, shoes_slipon: 14, top_collar_shirt: 1 }, eyes: "focused", hair: 0, mouth: "deadpan", skin: 9, top: "top_collar_shirt" } as const;
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

/**
 * A stool as a `tsi:sit` detail: facing the window, its claim key, first person (your own avatar hidden), getting up at
 * the entrance. `clash`: another's claim outranks yours on the stool you're on, so it's sent at once (another stool
 * moves you there, your own gets you up).
 */
export interface BarSeat { x: number; z: number; yaw: number; key: string; top: number; hide: true; exit: { x: number; z: number; yaw: number }; clash?: true }

/** How far from the bar's middle its entrance and stools are within: beyond it barSeat answers at once. */
export const BAR_REACH = 8;
/** (x, z) in the bar's frame (barPoint's inverse), in one object reused (called every frame). */
const local = { x: 0, z: 0 };
function toBar(bar: Bar, x: number, z: number) {
  const c = Math.cos(bar.yaw ?? 0), s = Math.sin(bar.yaw ?? 0), dx = x - bar.x, dz = z - bar.z;
  local.x = dx * c - dz * s; local.z = dx * s + dz * c;
  return local;
}
/** The next free stool in SEAT_ORDER (friends side by side), or -1. */
function freeStool(bar: Bar, taken?: (key: string) => boolean) {
  for (const j of SEAT_ORDER) if (!taken?.(stoolKey(bar, j))) return j;
  return -1;
}

/**
 * What E sits you on at the bar: the stool you're on (E again gets you up), or, at the entrance while it's open, the
 * next free stool; null when none. Two who press E together claim the same stool: whoever `outranked` says yields
 * (active.ts remoteSeatOutranks: the uid that sorts later) and is moved to the next free one, or gets up if none is.
 */
export function barSeat(bar: Bar, x: number, z: number, open: boolean, taken?: (key: string) => boolean, outranked?: (key: string) => boolean): BarSeat | null {
  if (Math.hypot(x - bar.x, z - bar.z) > BAR_REACH) return null;
  let i = stoolAt(bar, x, z), clash = false;
  if (i >= 0 && outranked?.(stoolKey(bar, i))) { clash = true; const j = freeStool(bar, taken); if (j >= 0) i = j; }
  else if (i < 0) {
    const p = toBar(bar, x, z);
    if (!open || Math.hypot(p.x - ENTRY[0], p.z - ENTRY[1]) > ENTRY_RANGE) return null;
    i = freeStool(bar, taken);
    if (i < 0) return null;
  }
  const [sx, sz] = barPoint(bar, STOOLS[i], STOOL_Z), [ox, oz] = barPoint(bar, ...EXIT), yaw = bar.yaw ?? 0;
  const seat: BarSeat = { x: sx, z: sz, yaw: yaw + Math.PI, key: stoolKey(bar, i), top: STOOL_TOP, hide: true, exit: { x: ox, z: oz, yaw } };
  if (clash) seat.clash = true;
  return seat;
}

/** The stool (x, z) is on (a seated player is set exactly on it), or -1. */
export function stoolAt(bar: Bar, x: number, z: number): number {
  const p = toBar(bar, x, z);
  for (let i = 0; i < STOOLS.length; i++) if (Math.hypot(p.x - STOOLS[i], p.z - STOOL_Z) < 0.05) return i;
  return -1;
}

/**
 * The seated view, first person (David: "first person at the bar ... seeking the food infront of you"; round 2: "see the
 * npcs preparing the food ... make fov higher slightly"): from your eyes on the stool at lx (a touch back and up, so the
 * sea shows over the back counter), a little down across the counter at the chefs' hands on their boards, the sea and
 * its islands through the window behind them (the builder's EYE, which the islands are raised for). The eye and the
 * point it looks at in the bar's frame (x, y over its floor, z). The camera sees wider there (movement/moveFx SEAT_FOV).
 */
export function seatView(lx: number): { eye: [number, number, number]; look: [number, number, number] } {
  return { eye: [lx, STOOL_TOP + 1.1, STOOL_Z + 0.4], look: [lx * 0.85, STOOL_TOP + 0.45, -2.5] };
}

/**
 * The seated view with the menu picked up (David, 2026-10-28: "you can pick it up first person"): at `k` 1 you lean in
 * a little and look down at it in your hands; at 0, the stool's own view. Written into `out`.
 */
export function readingView(base: BarView, k: number, out: BarView): BarView {
  const { eye, look } = base, lean = 0.22 * k;
  out.eye.x = eye.x + (look.x - eye.x) * lean * 0.25;
  out.eye.y = eye.y - 0.05 * k;
  out.eye.z = eye.z + (look.z - eye.z) * lean * 0.25;
  out.look.x = look.x + (eye.x - look.x) * 0.55 * k;
  out.look.y = look.y - 0.55 * k;
  out.look.z = look.z + (eye.z - look.z) * 0.55 * k;
  return out;
}
