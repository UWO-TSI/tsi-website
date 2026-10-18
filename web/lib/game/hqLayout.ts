/**
 * HQ's room (specs/interiors/hq.md, ledger row 316): every number the models stand on, the walker walks and the stations
 * sit at. David picked option A in phase 1, the back mezzanine: a big room of two storeys (20 x 16, the floors 3.4
 * apart), the door in the middle of the front wall, the mezzanine over the back third facing the door with the yearly
 * banners on its rail, the aquarium two storeys tall on the left wall of the double-height hall, the lamp-lit lounge in
 * front of it. Work downstairs (Wren's desk, the coffee bar, co-working, the library, the notice board, the Founder's
 * desk); lounging upstairs (the big lounge under the walnut oval ceiling, the admin doors).
 *
 * Room space: the door at z −8, the back wall at z 8; +x is screen left (the walking camera looks from the door towards
 * +z). Level 1 numbers are above its floor (F). The model build (art/interiors/build_hq.py) reads these through
 * art/interiors/hq_layout.json (web/scripts/hq-layout-json.mjs): change the layout here, never there.
 */
export type Level = 0 | 1;
export const HQ_ROOM = { halfW: 10, halfD: 8, wall: 0.3, lip: 0.9 } as const;
export const HQ_FLOOR_HEIGHT = 3.4;
export const HQ_SLAB = 0.25;
export const HQ_DOOR = { x: 0, half: 1.0 } as const;
export const HQ_SPAWN: [number, number] = [0, -6.4];
export const HQ_EXIT: [number, number] = [0, -7.2];
export const HQ_EXIT_RANGE = 1.1;
export const HQ_WALK_MARGIN = 0.7;
export const HQ_PAD = 0.25;
/** How far in from an open edge (a rail) you can stand. */
export const HQ_EDGE = 0.4;

export type Finish = "walnut" | "concrete" | "leather" | "velvet" | "marble" | "carpet" | "shag" | "books" | "stone" | "metal" | "plant"
  | "glass" | "banner" | "door" | "plaque" | "lamp" | "water" | "cork" | "screen" | "person" | "beanbag";
export interface Block { at: [number, number, number]; size: [number, number, number]; finish: Finish }
/** A footprint: centre x, z and half its width and depth. */
export type Footprint = [number, number, number, number];
export type Zone = "entry" | "work" | "coffee" | "library" | "lounge" | "aquarium" | "founder" | "board" | "upper-lounge" | "admin" | "flags" | "stair";
export interface Fixture { id: string; level: Level; zone: Zone; label: string; blocks: Block[]; footprint?: Footprint[]; /** Upstairs: which part of the upper floor it belongs to; 0 by default. */ part?: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** The flight: in a lane x0..x1 along z, its foot at `foot` and its head (the upper floor's edge) at `head`. */
export interface Stair { x0: number; x1: number; foot: number; head: number; steps: number }
export interface Station { id: string; name: string; pos: [number, number]; level: Level; range: number; action: string }
export interface Path { id: string; level: Level | "stair"; label: string; points: [number, number][] }
export interface Rail { from: [number, number]; to: [number, number] }
/** A window in a side wall (x ±W), from z0 to z1 and y0 to y1 above the floor (level 0: the ground's floor). */
export interface Window { wall: "left" | "right"; z0: number; z1: number; y0: number; y1: number }
/** A run of black track with its spots (y: under what ceiling), each spot aimed at a point. */
export interface Track { from: [number, number, number]; to: [number, number, number]; spots: { at: number; aim: [number, number, number] }[] }
/** A lamp: what it is, where its light comes from (above its floor), the height of what it stands on, and the radius of
 * the warm pool it throws on the floor (faked: lib/game/hqLight.ts, not a real light). */
export interface Lamp { id: string; kind: "arc" | "mushroom" | "floor"; level: Level; light: [number, number, number]; on: number; pool: number }
export interface HqOption {
  id: "a"; name: string; summary: string;
  /** The upper floor: where it is (walkable on it, open below everywhere else). */
  upper: Rect[];
  stair: Stair;
  aquarium: Rect & { y0: number; y1: number; facing: "-x" };
  rails: Rail[];
  /** The walnut ceiling with its oval cut-outs: over the upper lounge only (level 1, at the room's ceiling). */
  ovalCeiling: Rect;
  windows: Window[];
  tracks: Track[];
  lamps: Lamp[];
  fixtures: Fixture[];
  stations: Station[];
  paths: Path[];
}

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): Block => ({ at, size, finish });
const W = HQ_ROOM.halfW, D = HQ_ROOM.halfD, F = HQ_FLOOR_HEIGHT;
const fx = (id: string, level: Level, zone: Zone, label: string, blocks: Block[], footprint?: Footprint[]): Fixture => ({ id, level, zone, label, blocks, footprint });
const st = (id: string, name: string, pos: [number, number], action: string, range = 1.6, level: Level = 0): Station => ({ id, name, pos, level, range, action });

/** Wren's front desk facing the door (its counter towards −z), the register on its ledge, her post behind it. */
export const HQ_DESK = { x: -3.6, z: -5.2 } as const;
/** Where Wren stands and moves behind the desk (lib/game/keepers.ts reads these). */
export const HQ_WREN: { at: [number, number]; clip: "Idle" | "Trace" | "Forage"; stay: number }[] = [
  { at: [HQ_DESK.x - 0.15, HQ_DESK.z + 1.4], clip: "Idle", stay: 7 },
  { at: [HQ_DESK.x + 0.65, HQ_DESK.z + 1.4], clip: "Trace", stay: 6.5 },    // the register
  { at: [HQ_DESK.x - 0.85, HQ_DESK.z + 1.4], clip: "Forage", stay: 1.3 },   // under the counter
];
/** What the new stations say on E (drafts for David; the admin doors' line is the lane brief's). */
export const HQ_LINES = {
  coffee: "Fresh coffee at the marble bar. The cups are already warm.",
  aquarium: "Silver fish turn together in the blue. A small orange one goes its own way.",
  admin: "Admins only. It's locked.",
} as const;
/** The trophy case, the clock, the workbench and the Founder's desk (their components read these). */
export const HQ_TROPHY = { x: 9.45, z: 4.4, yaw: Math.PI / 2 } as const;
export const HQ_CLOCK_AT = { x: -0.2, z: 7.6 } as const;
export const HQ_BENCH = { x: -9.25, z: 3.7 } as const;
export const HQ_FOUNDER = { x: 7.4, z: 7.3 } as const;

const UPPER: Rect = { x0: -W, x1: W, z0: 1.5, z1: D };
const STAIR: Stair = { x0: -W, x1: -8.2, foot: -4.0, head: 1.5, steps: 16 };
const { x: DX, z: DZ } = HQ_DESK;

export const HQ: HqOption = {
  id: "a", name: "The back mezzanine",
  summary: "The mezzanine over the back faces the door, its rail hung with the banners; the aquarium fills the left wall of the double-height hall.",
  upper: [UPPER],
  stair: STAIR,
  aquarium: { x0: 8.6, x1: W, z0: -5.4, z1: 1.2, y0: 0.25, y1: 2 * F - 0.2, facing: "-x" },
  rails: [{ from: [STAIR.x1, UPPER.z0], to: [W, UPPER.z0] }],
  ovalCeiling: { x0: -3.5, x1: 7.6, z0: 1.9, z1: 7.8 },
  windows: [
    { wall: "right", z0: -7.3, z1: -4.7, y0: 0.9, y1: 6.1 },              // tall, both storeys, by the door
    { wall: "right", z0: 2.6, z1: 4.4, y0: F + 0.9, y1: F + 2.7 },         // upstairs
    { wall: "right", z0: 5.1, z1: 6.9, y0: F + 0.9, y1: F + 2.7 },
    { wall: "left", z0: 2.4, z1: 4.4, y0: F + 0.95, y1: F + 2.65 },
  ],
  tracks: [
    // The hall's ceiling: spots on the desk, the coffee bar and the lounge.
    { from: [-6.5, 2 * F - 0.06, -5.6], to: [5.5, 2 * F - 0.06, -5.6], spots: [{ at: -3.6, aim: [DX, 1.1, DZ] }, { at: 0.0, aim: [0, 0, -4.5] }, { at: 4.4, aim: [6.6, 0.4, -3.6] }] },
    { from: [-6.5, 2 * F - 0.06, -1.6], to: [5.5, 2 * F - 0.06, -1.6], spots: [{ at: -5.6, aim: [-5.6, 1.1, -0.6] }, { at: 4.6, aim: [6.6, 0.4, -1.4] }, { at: -1.0, aim: [-1.0, 0, 0.6] }] },
    // Under the mezzanine: the library, the board, the Founder's plaque.
    { from: [-9.0, F - HQ_SLAB - 0.04, 6.2], to: [8.6, F - HQ_SLAB - 0.04, 6.2], spots: [{ at: -7.6, aim: [-7.6, 1.6, 7.6] }, { at: -4.0, aim: [-4.0, 1.6, 7.6] }, { at: 2.0, aim: [2.0, 1.7, 7.8] }, { at: 7.4, aim: [7.4, 1.9, 7.8] }] },
    // Upstairs: the art and the lounge.
    { from: [-2.5, 2 * F - 0.06, 7.2], to: [8.0, 2 * F - 0.06, 7.2], spots: [{ at: -1.6, aim: [-1.6, F + 1.6, 7.9] }, { at: 4.4, aim: [4.4, F + 1.7, 7.9] }] },
  ],
  lamps: [
    { id: "desk-lamp", kind: "mushroom", level: 0, light: [DX - 0.95, 1.18, DZ + 0.62], on: 0.76, pool: 1.4 },
    { id: "lounge-lamp", kind: "mushroom", level: 0, light: [6.6, 0.68, -1.75], on: 0.38, pool: 1.8 },
    { id: "lounge-floor", kind: "floor", level: 0, light: [4.9, 1.5, -4.3], on: 0, pool: 1.7 },
    { id: "work-lamp", kind: "mushroom", level: 0, light: [3.2, 0.62, 4.65], on: 0.4, pool: 1.6 },
    { id: "arc", kind: "arc", level: 1, light: [1.7, 1.85, 4.9], on: 0, pool: 2.6 },
    { id: "upper-mushroom", kind: "mushroom", level: 1, light: [4.7, 0.75, 5.8], on: 0.45, pool: 1.4 },
  ],
  fixtures: [
    // ── Ground floor, the double-height hall: Wren by the door, the coffee bar, the aquarium lounge. ──
    // Its footprint takes in the space behind it, where Wren works: visitors stay on the door's side.
    fx("front-desk", 0, "entry", "Wren's front desk", [b([DX, 0, DZ], [2.6, 1.05, 0.8], "walnut"), b([DX, 0, DZ + 0.65], [2.6, 0.76, 0.55], "walnut")], [[DX, DZ + 0.55, 1.4, 1.0]]),
    fx("register", 0, "entry", "The island register", [b([DX + 0.75, 1.05, DZ - 0.18], [0.55, 0.07, 0.38], "plaque")]),
    fx("coffee-bar", 0, "coffee", "Coffee bar (green marble)", [
      b([-5.6, 0, -0.6], [2.6, 1.05, 0.95], "marble"), b([-6.2, 0, -1.6], [0.42, 0.78, 0.42], "leather"), b([-5.0, 0, -1.6], [0.42, 0.78, 0.42], "leather"),
    ], [[-5.6, -0.85, 1.3, 0.75]]),
    fx("ground-lounge", 0, "lounge", "Lamp-lit lounge before the aquarium", [
      b([6.4, 0, -2.1], [3.6, 0.02, 4.6], "shag"), b([4.95, 0, -2.1], [0.9, 0.82, 2.5], "velvet"), b([6.6, 0, -2.1], [0.85, 0.38, 1.4], "stone"),
      b([6.9, 0, -4.15], [0.85, 0.82, 0.85], "velvet"), b([4.9, 0, -4.3], [0.32, 1.55, 0.32], "lamp"),
    ], [[4.95, -2.1, 0.45, 1.25], [6.6, -2.1, 0.43, 0.7], [6.9, -4.15, 0.43, 0.43], [4.9, -4.3, 0.16, 0.16]]),
    fx("palm-front-left", 0, "entry", "", [b([9.0, 0, -7.2], [1.1, 2.4, 1.1], "plant")], [[9.0, -7.2, 0.45, 0.45]]),
    fx("palm-front-right", 0, "entry", "", [b([-9.0, 0, -7.2], [1.1, 2.4, 1.1], "plant")], [[-9.0, -7.2, 0.45, 0.45]]),
    fx("plant-aquarium", 0, "lounge", "", [b([7.9, 0, 1.75], [0.8, 1.6, 0.8], "plant")], [[7.9, 1.75, 0.35, 0.35]]),
    // ── Under the mezzanine: the work floor. ──
    fx("coworking", 0, "work", "Co-working (long walnut desk, monitors)", [
      b([-3.8, 0, 4.3], [6.0, 0.76, 1.0], "walnut"),
      ...[-6.2, -4.6, -3.0, -1.4].map(x => b([x, 0.76, 4.62], [0.62, 0.42, 0.06], "screen")),
      ...[-6.2, -4.6, -3.0, -1.4].map(x => b([x, 0, 3.35], [0.52, 0.95, 0.52], "leather")),
    ], [[-3.8, 4.3, 3.0, 0.5], [-3.8, 3.35, 3.0, 0.26]]),
    // The work lounge on the deep blue rug (ref 1): the black leather daybed, the brown leather sofa, a glass table of books.
    fx("work-lounge", 0, "work", "Work lounge on the deep blue rug", [
      b([3.2, 0, 4.5], [5.0, 0.02, 3.2], "carpet"), b([3.2, 0, 3.6], [2.0, 0.42, 0.72], "leather"), b([3.2, 0, 5.55], [2.3, 0.82, 0.9], "velvet"),
      b([3.2, 0, 4.6], [1.25, 0.4, 0.62], "glass"),
    ], [[3.2, 3.6, 1.0, 0.36], [3.2, 5.55, 1.15, 0.45], [3.2, 4.6, 0.63, 0.31]]),
    fx("library", 0, "library", "Library wall (walnut, books face-out)", [b([-5.3, 0, 7.75], [8.4, 3.1, 0.45], "walnut"), b([-5.3, 0.35, 7.5], [8.1, 2.5, 0.06], "books")], [[-5.3, 7.7, 4.2, 0.3]]),
    fx("notice-board", 0, "board", "Notice board and club goals", [b([1.8, 1.0, 7.86], [2.1, 1.4, 0.08], "cork"), b([4.1, 1.0, 7.86], [1.6, 1.4, 0.08], "plaque")]),
    fx("clock", 0, "work", "Clock", [b([HQ_CLOCK_AT.x, 0, 7.75], [0.6, 2.1, 0.4], "walnut")], [[HQ_CLOCK_AT.x, 7.75, 0.3, 0.2]]),
    fx("founder", 0, "founder", "The Founder's desk and plaque", [
      b([HQ_FOUNDER.x, 0, HQ_FOUNDER.z], [1.9, 0.78, 0.9], "walnut"), b([HQ_FOUNDER.x - 0.3, 0, 6.4], [0.6, 1.05, 0.6], "leather"), b([HQ_FOUNDER.x, 1.75, 7.84], [0.9, 0.6, 0.05], "plaque"),
    ], [[HQ_FOUNDER.x, 7.0, 0.95, 0.9]]),
    fx("trophy-case", 0, "work", "Trophy case", [b([HQ_TROPHY.x, 0, HQ_TROPHY.z], [0.7, 2.0, 2.0], "glass")], [[9.5, HQ_TROPHY.z, 0.4, 1.0]]),
    fx("workbench", 0, "work", "Workbench (crafting)", [b([HQ_BENCH.x, 0, HQ_BENCH.z], [0.9, 0.9, 1.8], "walnut")], [[HQ_BENCH.x, HQ_BENCH.z, 0.5, 0.95]]),
    fx("plant-work", 0, "work", "", [b([9.2, 0, 6.3], [0.7, 1.3, 0.7], "plant")], [[9.2, 6.3, 0.3, 0.3]]),
    // ── The mezzanine: the big lounge under the oval ceiling, the admin doors, the banners on the rail. ──
    fx("upper-carpet", 1, "upper-lounge", "Big lounge: shag carpet, velvet sofas, beanbags", [b([2.0, 0, 4.8], [10.4, 0.03, 5.8], "shag")]),
    fx("upper-sofas", 1, "upper-lounge", "", [b([2.0, 0, 7.15], [4.2, 0.82, 0.9], "velvet"), b([6.75, 0, 4.6], [0.9, 0.82, 3.2], "velvet"), b([-1.8, 0, 5.6], [0.85, 0.82, 0.85], "velvet")],
      [[2.0, 7.15, 2.1, 0.45], [6.75, 4.6, 0.45, 1.6], [-1.8, 5.6, 0.43, 0.43]]),
    fx("upper-tables", 1, "upper-lounge", "", [b([2.0, 0, 4.9], [1.9, 0.36, 1.0], "stone"), b([4.7, 0, 5.8], [0.8, 0.45, 0.8], "leather")], [[2.0, 4.9, 0.95, 0.5], [4.7, 5.8, 0.4, 0.4]]),
    fx("beanbags", 1, "upper-lounge", "Beanbags by the rail", [-1.2, 0.6, 2.4, 4.2].map(x => b([x, 0, 2.75], [0.85, 0.5, 0.85], "beanbag")), [[1.5, 2.75, 3.15, 0.43]]),
    fx("arc-lamp", 1, "upper-lounge", "The arc lamp", [b([-2.6, 0, 6.9], [0.45, 2.75, 0.45], "metal"), b([1.7, 1.85, 4.9], [0.55, 0.55, 0.55], "lamp")], [[-2.6, 6.9, 0.25, 0.25]]),
    fx("art", 1, "upper-lounge", "Lit art", [b([-1.6, 1.0, 7.92], [1.1, 1.2, 0.06], "plaque")]),
    fx("admin-doors", 1, "admin", "Admins only (locked)", [
      b([-7.4, 0, 7.92], [1.1, 2.3, 0.1], "door"), b([-4.9, 0, 7.92], [1.1, 2.3, 0.1], "door"),
    ]),
    ...[-6.0, -3.4, -0.8, 1.8, 4.4, 7.0].map((x, i) => fx(`banner-${i + 1}`, 1, "flags", i === 0 ? "Yearly banners (blank until David's designs)" : "", [b([x, 1.05 - 1.9, UPPER.z0 - 0.16], [1.0, 1.9, 0.04], "banner")])),
    fx("upper-plants", 1, "upper-lounge", "", [b([9.2, 0, 7.2], [0.8, 1.7, 0.8], "plant"), b([9.2, 0, 5.6], [0.8, 1.2, 0.8], "plant"), b([-9.25, 0, 7.35], [0.8, 1.7, 0.8], "plant")],
      [[9.2, 7.2, 0.4, 0.4], [9.2, 5.6, 0.4, 0.4], [-9.25, 7.35, 0.4, 0.4]]),
  ],
  stations: [
    st("exit", "Island", HQ_EXIT, "exit", HQ_EXIT_RANGE),
    st("desk", "Front desk", [DX, DZ - 1.1], "desk", 1.8),
    st("board", "Notice board", [2.6, 6.75], "board", 2.3),
    st("founder", "The Founder's desk", [HQ_FOUNDER.x - 0.2, 5.55], "founder", 1.35),
    st("display", "Trophy display", [8.45, HQ_TROPHY.z], "display", 1.6),
    st("shelf", "Library", [-5.3, 6.6], "shelf", 2.0),
    st("clock", "Clock", [HQ_CLOCK_AT.x, 6.8], "clock", 1.6),
    st("coffee", "Coffee bar", [-5.6, -2.3], "coffee", 1.5),
    st("aquarium", "Aquarium", [7.9, -2.1], "aquarium", 1.4),
    st("admin", "Admins only", [-7.4, 7.0], "admin", 1.1, 1),
    st("admin-2", "Admins only", [-4.9, 7.0], "admin", 1.1, 1),
  ],
  paths: [
    { id: "aisle", level: 0, label: "From the door to the back", points: [HQ_SPAWN, [0, -3.0], [0, 1.0], [0, 6.0]] },
    { id: "to-desk", level: 0, label: "To Wren's desk", points: [[0, -6.3], [DX, -6.3]] },
    { id: "to-lounge", level: 0, label: "To the aquarium lounge", points: [[0, -3.0], [3.6, -3.0], [3.6, 0.6], [7.9, 0.6]] },
    { id: "to-stair", level: 0, label: "To the stair", points: [[0, -3.0], [-7.6, -3.0], [-7.6, -4.6], [-8.9, -4.6]] },
    { id: "work", level: 0, label: "The work floor", points: [[0, 2.4], [-7.6, 2.4], [-7.6, 6.5], [5.9, 6.5], [6.1, 2.6], [0, 2.4]] },
    { id: "flight", level: "stair", label: "Up the stair", points: [[-8.9, -4.0], [-8.9, 1.5]] },
    { id: "upper", level: 1, label: "The mezzanine", points: [[-8.9, 2.1], [-6.0, 2.1], [-6.0, 6.7], [-3.2, 6.7], [-3.2, 3.6], [5.6, 3.6], [5.6, 2.2], [8.9, 2.2]] },
  ],
};

// ── Walking ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Whether a floor's solids cover (x, z), grown by `pad`. */
export function solidAt(o: HqOption, level: Level, x: number, z: number, pad = HQ_PAD): boolean {
  for (const f of o.fixtures) {
    if (f.level !== level || !f.footprint) continue;
    for (const [cx, cz, w, d] of f.footprint) if (Math.abs(x - cx) < w + pad && Math.abs(z - cz) < d + pad) return true;
  }
  if (level === 0) {
    const a = o.aquarium;
    if (x > a.x0 - pad && x < a.x1 + pad && z > a.z0 - pad && z < a.z1 + pad) return true;
  }
  return false;
}
const dirOf = (s: Stair) => Math.sign(s.head - s.foot);
/** The stair from a floor: downstairs its flight (you can't walk under or beside it past its foot), upstairs its well. */
export function stairBlocks(o: HqOption, level: Level, x: number, z: number, pad = HQ_PAD): boolean {
  const s = o.stair;
  if (x > s.x1 + pad || x < s.x0 - pad) return false;
  if (level === 0) {
    // From the foot onwards the flight is solid (with its pad on the far side; you step onto it at the foot).
    return dirOf(s) > 0 ? z > s.foot && z < s.head + pad : z < s.foot && z > s.head - pad;
  }
  // Upstairs: the open well over the flight, up to the head (where you step off it).
  return dirOf(s) > 0 ? z < s.head && z > s.foot - pad : z > s.head && z < s.foot + pad;
}
/** Whether (x, z) is over the upper floor's slab (or past the room's walls, which count as solid, not open). */
const overSlab = (o: HqOption, x: number, z: number) => Math.abs(x) >= W || Math.abs(z) >= D || o.upper.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
/** Whether a point is on the upper floor, at least `inset` in from any open edge (a rail): its parts join seamlessly. */
export function onUpper(o: HqOption, x: number, z: number, inset = HQ_EDGE): boolean {
  for (const [ox, oz] of [[0, 0], [inset, 0], [-inset, 0], [0, inset], [0, -inset], [inset, inset], [inset, -inset], [-inset, inset], [-inset, -inset]]) {
    if (!overSlab(o, x + ox, z + oz)) return false;
  }
  return true;
}
/** The landing at the stair's head: in its lane, the step off the flight onto the slab. */
const onLanding = (o: HqOption, x: number, z: number) => {
  const s = o.stair, [l0, l1] = stairLane(o), d = dirOf(s);
  return x >= l0 - 1e-9 && x <= l1 + 1e-9 && (d > 0 ? z >= s.head && z <= s.head + 1.0 : z <= s.head && z >= s.head - 1.0) && overSlab(o, x, z);
};
/** Where you can stand on a floor: in the room (on the slab, upstairs), clear of the solids and the stair. */
export function walkable(o: HqOption, level: Level, x: number, z: number, pad = HQ_PAD): boolean {
  const mx = W - HQ_WALK_MARGIN, mz = D - HQ_WALK_MARGIN;
  const inRoom = Math.abs(x) <= mx + 1e-9 && Math.abs(z) <= mz + 1e-9;
  return inRoom && (level === 0 || onUpper(o, x, z) || onLanding(o, x, z)) && !solidAt(o, level, x, z, pad) && !stairBlocks(o, level, x, z, pad);
}
/** Under a part of the upper floor (the walker hides that part there): inside it by `by` (negative: grown). */
export function underPart(r: Rect, x: number, z: number, by: number): boolean {
  return x > r.x0 + by && x < r.x1 - by && z > r.z0 + by && z < r.z1 - by;
}
/** Your feet's height on the flight at z. */
export function stairHeight(o: HqOption, z: number): number {
  const s = o.stair, t = (z - s.foot) / (s.head - s.foot);
  return F * Math.min(1, Math.max(0, t));
}
export const stairLane = (o: HqOption): [number, number] => [Math.max(o.stair.x0, -W + HQ_WALK_MARGIN), o.stair.x1 - HQ_PAD];

export type WalkZone = "ground" | "stair" | "upper";
export interface HqWalker {
  zone: WalkZone;
  height: number;
  /** Each part of the upper floor is drawn: on the upper floor or the stair, or downstairs out from under that part
   * (with hysteresis, so it never flickers); cut away while you're under it, so the walking camera sees your floor. */
  shown: boolean[];
  constrain(x: number, z: number, nx: number, nz: number): [number, number];
}

export function createHqWalker(o: HqOption): HqWalker {
  const s = o.stair, dir = dirOf(s), [l0, l1] = stairLane(o);
  const inLane = (x: number) => x >= l0 - 1e-9 && x <= l1 + 1e-9;
  const clampLane = (x: number) => Math.min(l1, Math.max(l0, x));
  // Past the foot (onto the flight from below) and past the head (off it above), along the flight's direction.
  const pastFoot = (z: number) => dir > 0 ? z > s.foot : z < s.foot;
  const pastHead = (z: number) => dir > 0 ? z >= s.head : z <= s.head;
  const out: [number, number] = [0, 0];
  const w: HqWalker = {
    // You come in at the door: the parts overhead there start cut away.
    zone: "ground", height: 0, shown: o.upper.map(r => !underPart(r, HQ_SPAWN[0], HQ_SPAWN[1], 0.5)),
    constrain(x, z, nx, nz) {
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.1));
      const dx = (nx - x) / steps, dz = (nz - z) / steps;
      for (let i = 0; i < steps; i++) {
        const tx = x + dx, tz = z + dz;
        if (w.zone === "stair") {
          const lx = clampLane(tx);
          if (!pastFoot(tz)) { if (walkable(o, 0, lx, tz)) { w.zone = "ground"; x = lx; z = tz; } else break; }
          else if (pastHead(tz)) { if (walkable(o, 1, lx, tz)) { w.zone = "upper"; x = lx; z = tz; } else break; }
          else { x = lx; z = tz; }
          continue;
        }
        const level: Level = w.zone === "ground" ? 0 : 1;
        // Onto the flight: from the floor at its foot going up, or from the landing at its head going down.
        const onto = level === 0 ? !pastFoot(z) && pastFoot(tz) : pastHead(z) && !pastHead(tz);
        if (onto && inLane(tx)) { w.zone = "stair"; x = tx; z = tz; continue; }
        if (walkable(o, level, tx, tz)) { x = tx; z = tz; }
        else if (walkable(o, level, tx, z)) x = tx;
        else if (walkable(o, level, x, tz)) z = tz;
        else break;
      }
      w.height = w.zone === "ground" ? 0 : w.zone === "upper" ? F : stairHeight(o, z);
      o.upper.forEach((r, i) => { w.shown[i] = w.zone !== "ground" || (w.shown[i] ? !underPart(r, x, z, 0.5) : !underPart(r, x, z, -0.25)); });
      out[0] = x; out[1] = z;
      return out;
    },
  };
  return w;
}

/** The plan's zone labels: where each floor's areas are (the evidence script prints them on the top-down plans). */
export const HQ_ZONES: { text: string; level: Level; at: [number, number] }[] = [
  { text: "ENTRY", level: 0, at: [-1.2, -5.0] }, { text: "AQUARIUM LOUNGE", level: 0, at: [6.4, 0.4] }, { text: "COFFEE", level: 0, at: [-5.6, 0.5] },
  { text: "WORK (under the mezzanine)", level: 0, at: [-1.0, 5.6] }, { text: "STAIR", level: 0, at: [-9.1, -1.2] },
  { text: "BIG LOUNGE", level: 1, at: [2.0, 3.6] }, { text: "ADMINS ONLY", level: 1, at: [-6.1, 6.2] }, { text: "OPEN TO BELOW", level: 1, at: [0, -3.0] },
];

/**
 * The layout as the model build reads it (art/interiors/build_hq.py reads art/interiors/hq_layout.json, written by
 * scripts/hq-layout-json.mjs): every number the room's models stand on, so the models and the walking never drift.
 */
export function hqLayoutJson(): string {
  const { room, floorHeight, slab, door } = { room: HQ_ROOM, floorHeight: HQ_FLOOR_HEIGHT, slab: HQ_SLAB, door: HQ_DOOR };
  return JSON.stringify({ room, floorHeight, slab, door, desk: HQ_DESK, trophy: HQ_TROPHY, clock: HQ_CLOCK_AT, bench: HQ_BENCH, founder: HQ_FOUNDER, ...HQ }, null, 1) + "\n";
}
