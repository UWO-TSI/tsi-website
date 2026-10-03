/**
 * Café interior layout (specs/cafe-polish.md), shared by the room, its
 * prompts and the tests. Room space: walls at x ±halfW and z ±halfD, the door
 * in the near (−z) wall, +x on screen left. Seats live in lib/study/seats.ts.
 */
import { studySolid } from "@/lib/study/seats";

export const CAFE_ROOM = { halfW: 8.5, halfD: 6, ceiling: 4 };
/** The doorway (in the near wall, z −6) and the exit prompt around it. */
export const CAFE_DOOR: [number, number] = [0, -5.6];
/** "Return to the island" shows inside this distance of the door. */
export const CAFE_EXIT_RANGE = 1.4;
/** Where you arrive: a step in from the door, outside its prompt. */
export const CAFE_SPAWN: [number, number] = [0, -3.95];

/**
 * Solid room furniture, [cx, cz, halfW, halfD] (mirrors art/cafe/build_cafe.py): the whole bar (order
 * counter, pastry case, pick-up bar, the staff aisle and back counter), the window counter, the retail
 * shelf, the floor plants and the coat rack. Tables come from lib/study/seats.ts.
 */
export const CAFE_SOLIDS: [number, number, number, number][] = [
  [3.5, 4.85, 5.0, 1.15],
  [-8.22, -1.85, 0.28, 2.35],
  [8.25, 0.9, 0.25, 1.3],
  [-8.0, 2.3, 0.3, 0.3], [8.0, -5.4, 0.3, 0.3], [-8.0, -5.4, 0.3, 0.3],
  [-1.5, -5.6, 0.22, 0.22],
];
/** The study board on the +x wall (its centre) and where you stand to read it. */
export const CAFE_BOARD = { at: [8.45, 1.85, -2.8] as [number, number, number], spot: [7.4, -2.8] as [number, number] };
/** The window wall's glass (−x wall): what the outside backdrop fills, per phase. */
export const CAFE_WINDOW = { x: -8.62, z0: -5.2, z1: 1.4, y0: 0.78, y1: 3.58 };

/**
 * The café owner (cafe-polish §6; row 122's `cafe_owner` post). Proposed for
 * David's OK in specs/cafe-polish-questions.md: the name and lines are the
 * defaults until a Residents-editor persona with the `cafe_owner` post exists
 * (its name and canned lines then win). The look is fixed: a cream collared
 * shirt under dark-wood bib overalls that read as a barista's apron, a top
 * bun, round glasses and loafers.
 */
export const CAFE_OWNER = {
  slug: "cafe-owner",
  name: "Rosa",
  look: {
    skin: 6, hair: 1, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [],
    bangs: "bangs_curtain", back: "back_bun", top: "top_collar_shirt", bottom: "bottom_overall_shorts", onepiece: null, shoes: "shoes_loafers",
    acc: { face: "acc_glasses_round" }, colors: { top_collar_shirt: 0, bottom_overall_shorts: 5, shoes_loafers: 14, acc_glasses_round: 5 },
  },
  lines: [
    "Welcome in! Take any seat. The window stools get the best light.",
    "Croissants just came out of the oven. Study hard, I'll keep the coffee coming.",
    "It took the whole club to get those boards off. I'm so glad you're here.",
  ],
};

export type OwnerClip = "Idle" | "Walk" | "Forage" | "Trace";
/** Where the owner works behind the bar, in walking order: x, z, the way she faces while there, how long she stays, and what she does. */
export interface OwnerStation { at: [number, number]; yaw: number; stay: number; clip: OwnerClip }
export const OWNER_STATIONS: OwnerStation[] = [
  { at: [-0.85, 4.8], yaw: Math.PI, stay: 7, clip: "Idle" },   // the register on the order counter
  { at: [0.9, 4.95], yaw: 0, stay: 6, clip: "Trace" },         // the espresso machine on the back counter
  { at: [3.4, 4.8], yaw: Math.PI, stay: 1.3, clip: "Forage" }, // a pastry from the case
  { at: [6.6, 4.8], yaw: Math.PI, stay: 4, clip: "Idle" },     // the pick-up end
];
export const OWNER_WALK = 1.15;
/** Where the player stands to talk to her across the order counter, and how close. */
export const OWNER_TALK: { at: [number, number]; range: number } = { at: [-0.4, 3.15], range: 1.5 };

/** Where a station routine has someone: the spot, the facing, the clip, and the station they're at or leaving. */
export interface OwnerPose { x: number; z: number; yaw: number; clip: OwnerClip; moving: boolean; station: number }
function pose(out: OwnerPose, x: number, z: number, yaw: number, clip: OwnerClip, moving: boolean, station: number): OwnerPose {
  out.x = x; out.z = z; out.yaw = yaw; out.clip = clip; out.moving = moving; out.station = station;
  return out;
}
/** Seconds from station i to the next, at the owner's pace. */
function walkOf(stations: readonly OwnerStation[], i: number): number {
  const a = stations[i].at, b = stations[(i + 1) % stations.length].at;
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / OWNER_WALK;
}
/**
 * The owner's routine at `t` seconds of the shared world clock: a loop of stations joined by walks. Pass `out` to
 * reuse one pose (a frame loop allocates nothing); the indoor keepers walk their own stations (lib/game/keepers.ts).
 */
export function ownerAt(t: number, stations: readonly OwnerStation[] = OWNER_STATIONS, out: OwnerPose = { x: 0, z: 0, yaw: 0, clip: "Idle", moving: false, station: 0 }): OwnerPose {
  const n = stations.length;
  let loop = 0;
  for (let i = 0; i < n; i++) loop += stations[i].stay + walkOf(stations, i);
  let u = ((t % loop) + loop) % loop;
  for (let i = 0; i < n; i++) {
    const s = stations[i];
    if (u < s.stay) return pose(out, s.at[0], s.at[1], s.yaw, s.clip, false, i);
    u -= s.stay;
    const walk = walkOf(stations, i);
    if (u < walk) {
      const next = stations[(i + 1) % n], k = u / walk, dx = next.at[0] - s.at[0], dz = next.at[1] - s.at[1];
      return pose(out, s.at[0] + dx * k, s.at[1] + dz * k, Math.atan2(dx, dz), "Walk", true, i);
    }
    u -= walk;
  }
  return pose(out, stations[0].at[0], stations[0].at[1], stations[0].yaw, stations[0].clip, false, 0);
}

/** Where you can stand in the café: inside the walls, clear of the room's furniture and the study tables. */
export function cafeWalkable(x: number, z: number, pad = 0): boolean {
  const { halfW, halfD } = CAFE_ROOM;
  return Math.abs(x) < halfW - 0.45 - pad && z > -halfD + 0.25 + pad && z < halfD - 0.3 - pad
    && !CAFE_SOLIDS.some(([cx, cz, w, d]) => Math.abs(x - cx) < w + pad && Math.abs(z - cz) < d + pad)
    && !studySolid("cafe", x, z, pad);
}

/**
 * The café's lightboxes (refs 1–4): two hanging signs over the front bar and three backlit menu boards on the back
 * wall. `at` is the box centre, `size` its face (w, h); the face looks toward −z. Menu boards list drinks and
 * pastries only: no prices, ever (the play currency has no menu price, and no money rate is ever shown).
 */
export type CafeSign =
  | { id: string; kind: "sign"; at: [number, number, number]; size: [number, number]; text: string; hang: true }
  | { id: string; kind: "menu"; at: [number, number, number]; size: [number, number]; title: string; items: string[]; note?: string };
export const CAFE_SIGNS: CafeSign[] = [
  { id: "order", kind: "sign", at: [0.2, 2.5, 3.92], size: [1.9, 0.42], text: "ORDER & PAY HERE", hang: true },
  { id: "pickup", kind: "sign", at: [6.8, 2.5, 3.92], size: [1.3, 0.42], text: "PICK UP", hang: true },
  // Read left to right on screen (+x is screen left): coffee, then not coffee, then the oven.
  { id: "coffee", kind: "menu", at: [3.45, 2.58, 5.93], size: [1.75, 0.78], title: "COFFEE", items: ["Espresso", "Americano", "Flat white", "Cappuccino", "Latte", "Cortado"], note: "Oat or whole milk" },
  { id: "not-coffee", kind: "menu", at: [1.6, 2.58, 5.93], size: [1.75, 0.78], title: "NOT COFFEE", items: ["Matcha latte", "Hot chocolate", "Chai latte", "Earl Grey tea", "Sencha", "Chamomile"] },
  { id: "oven", kind: "menu", at: [-0.25, 2.58, 5.93], size: [1.75, 0.78], title: "FROM THE OVEN", items: ["Butter croissant", "Almond croissant", "Pain au chocolat", "Cinnamon bun", "Cardamom bun"], note: "Baked every morning" },
];

/** The café's light (cafe-polish §7): warm, dim amber; the grade a touch warmer and darker than the clubhouse's. */
export const CAFE_GRADE = { exposure: 1.02, warmth: 0.34, vignette: 0.2 };
