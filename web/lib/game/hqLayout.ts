/**
 * HQ interior, phase 1: the layout (specs/interiors/hq.md, ledger row 316). Every number the greybox draws, the walker
 * walks and the stations sit at, for two options David picks between. Both are a big room of two storeys (20 x 16, the
 * floors 3.4 apart), the door in the middle of the front wall, the aquarium two storeys tall:
 *
 *   A, "the back mezzanine" (the shop's arrangement): the mezzanine over the back of the room faces the door, the yearly
 *     banners hang from its rail facing the entrance; the aquarium fills the left wall of the double-height front hall,
 *     the ground lounge in front of it, its top half seen from the mezzanine's front corner.
 *   B, "the gallery": the aquarium fills the back wall straight ahead of the door; the upper floor wraps the hall in a
 *     U (a bridge over the entrance and an arm down each side), the big lounge on the bridge facing the tank head on,
 *     the banners on poles off the arms' rails, one after another towards the tank as you walk in.
 *
 * Room space: the door at z −8, the back wall at z 8; +x is screen left (the walking camera looks from the door towards
 * +z). Level 1 numbers are above its floor (F).
 */
export type Option = "a" | "b";
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
export interface Fixture { id: string; level: Level; zone: Zone; label: string; blocks: Block[]; footprint?: Footprint[]; /** Upstairs: which part of the upper floor it belongs to (cut away with it); 0 by default. */ part?: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** The flight: in a lane x0..x1 along z, its foot at `foot` and its head (the upper floor's edge) at `head`. */
export interface Stair { x0: number; x1: number; foot: number; head: number; steps: number }
export interface Station { id: string; name: string; pos: [number, number]; level: Level; range: number; action: string }
export interface Path { id: string; level: Level | "stair"; label: string; points: [number, number][] }
export interface Rail { from: [number, number]; to: [number, number] }
export interface Window { wall: "front" | "left" | "right"; from: number; to: number; level: Level }
export interface HqOption {
  id: Option; name: string; summary: string;
  /** The upper floor: where it is (walkable on it, open below everywhere else). */
  upper: Rect[];
  stair: Stair;
  aquarium: Rect & { y0: number; y1: number; facing: "-x" | "+x" | "-z" };
  rails: Rail[];
  /** The walnut ceiling with its oval cut-outs: over the upper lounge only (level 1, at the room's ceiling). */
  ovalCeiling: Rect;
  windows: Window[];
  fixtures: Fixture[];
  stations: Station[];
  paths: Path[];
}

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): Block => ({ at, size, finish });
const W = HQ_ROOM.halfW, D = HQ_ROOM.halfD, F = HQ_FLOOR_HEIGHT;
const fx = (id: string, level: Level, zone: Zone, label: string, blocks: Block[], footprint?: Footprint[]): Fixture => ({ id, level, zone, label, blocks, footprint });
const st = (id: string, name: string, pos: [number, number], action: string, range = 1.6, level: Level = 0): Station => ({ id, name, pos, level, range, action });

// ── Pieces both options use, placed by each option ────────────────────────────────────────────────────────────────
/** Wren's front desk facing the door (its counter towards −z), the register on its ledge, Wren behind it. */
function frontDesk(x: number, z: number): Fixture[] {
  return [
    fx("front-desk", 0, "entry", "Wren's front desk", [b([x, 0, z], [2.6, 1.05, 0.8], "walnut"), b([x, 0, z + 0.65], [2.6, 0.76, 0.55], "walnut")], [[x, z + 0.3, 1.3, 0.75]]),
    fx("register", 0, "entry", "The island register", [b([x + 0.75, 1.05, z - 0.18], [0.55, 0.07, 0.38], "plaque")]),
    fx("wren", 0, "entry", "Wren", [b([x - 0.2, 0, z + 1.35], [0.48, 1.36, 0.36], "person")]),
  ];
}
/** The green marble coffee bar, its two tall stools on the −z side. */
function coffeeBar(x: number, z: number): Fixture {
  return fx("coffee-bar", 0, "coffee", "Coffee bar (green marble)", [
    b([x, 0, z], [2.6, 1.05, 0.95], "marble"), b([x - 0.6, 0, z - 1.0], [0.42, 0.78, 0.42], "leather"), b([x + 0.6, 0, z - 1.0], [0.42, 0.78, 0.42], "leather"),
  ], [[x, z - 0.25, 1.3, 0.75]]);
}
/** The Founder's desk against a back wall at z ≈ 8: its chair pushed back, the plaque above (blank until David writes it). */
function founder(x: number): Fixture {
  return fx("founder", 0, "founder", "The Founder's desk and plaque", [
    b([x, 0, 7.3], [1.6, 0.76, 0.8], "walnut"), b([x - 0.25, 0, 6.45], [0.5, 0.92, 0.5], "leather"), b([x, 1.75, 7.84], [0.9, 0.6, 0.05], "plaque"),
  ], [[x, 7.0, 0.85, 0.85]]);
}
/** The upper lounge's arc lamp: its foot, its pole and arm, the globe over the table. */
function arcLamp(foot: [number, number], over: [number, number]): Block[] {
  const [fx_, fz] = foot, [ox, oz] = over;
  const mx = (fx_ + ox) / 2, mz = (fz + oz) / 2;
  return [
    b([fx_, 0, fz], [0.45, 0.08, 0.45], "metal"), b([fx_, 0, fz], [0.06, 2.75, 0.06], "metal"),
    b([mx, 2.7, mz], [Math.abs(ox - fx_) + 0.06, 0.06, Math.abs(oz - fz) + 0.06], "metal"), b([ox, 1.85, oz], [0.55, 0.55, 0.55], "lamp"),
  ];
}
/** A blank yearly banner hanging from (x, z): `along` is the direction its face spans. */
function banner(i: number, x: number, z: number, along: "x" | "z", topY: number): Fixture {
  const size: [number, number, number] = along === "x" ? [1.0, 1.9, 0.04] : [0.04, 1.9, 1.0];
  return fx(`banner-${i + 1}`, 1, "flags", i === 0 ? "Yearly banners (blank until David's designs)" : "", [b([x, topY - 1.9, z], size, "banner")]);
}

// ── Option A: the back mezzanine ──────────────────────────────────────────────────────────────────────────────────
const A_UPPER: Rect = { x0: -W, x1: W, z0: 1.5, z1: D };
const A_STAIR: Stair = { x0: -W, x1: -8.2, foot: -4.0, head: 1.5, steps: 16 };
const OPTION_A: HqOption = {
  id: "a", name: "A · The back mezzanine",
  summary: "The mezzanine over the back faces the door, its rail hung with the banners; the aquarium fills the left wall of the double-height hall.",
  upper: [A_UPPER],
  stair: A_STAIR,
  aquarium: { x0: 8.6, x1: W, z0: -5.4, z1: 1.2, y0: 0.25, y1: 2 * F - 0.2, facing: "-x" },
  rails: [{ from: [A_STAIR.x1, A_UPPER.z0], to: [W, A_UPPER.z0] }],
  ovalCeiling: { x0: -3.5, x1: 7.6, z0: 1.9, z1: 7.8 },
  windows: [{ wall: "front", from: 3.4, to: 7.6, level: 0 }, { wall: "front", from: -7.6, to: -3.4, level: 0 }, { wall: "front", from: 3.4, to: 7.6, level: 1 }, { wall: "front", from: -7.6, to: -3.4, level: 1 }],
  fixtures: [
    // Ground floor, the double-height hall: Wren by the door, the coffee bar, the aquarium lounge.
    ...frontDesk(-3.6, -5.2),
    coffeeBar(-5.6, -0.6),
    fx("ground-lounge", 0, "lounge", "Lamp-lit lounge before the aquarium", [
      b([6.4, 0, -2.1], [3.6, 0.02, 4.6], "carpet"), b([4.95, 0, -2.1], [0.9, 0.82, 2.5], "velvet"), b([6.6, 0, -2.1], [0.85, 0.38, 1.4], "stone"),
      b([6.9, 0, -4.15], [0.85, 0.82, 0.85], "velvet"), b([4.9, 0, -3.95], [0.32, 1.55, 0.32], "lamp"),
    ], [[4.95, -2.1, 0.45, 1.25], [6.6, -2.1, 0.43, 0.7], [6.9, -4.15, 0.43, 0.43], [4.9, -3.95, 0.16, 0.16]]),
    fx("plant-a1", 0, "entry", "", [b([9.1, 0, -7.3], [0.8, 1.6, 0.8], "plant")], [[9.1, -7.3, 0.4, 0.4]]),
    fx("plant-a2", 0, "entry", "", [b([-9.1, 0, -7.3], [0.8, 1.6, 0.8], "plant")], [[-9.1, -7.3, 0.4, 0.4]]),
    // Under the mezzanine: the work floor.
    fx("coworking", 0, "work", "Co-working (long walnut desk, monitors)", [
      b([-3.8, 0, 4.3], [6.0, 0.76, 1.0], "walnut"),
      ...[-6.2, -4.6, -3.0, -1.4].map(x => b([x, 0.76, 4.62], [0.62, 0.42, 0.06], "screen")),
      ...[-6.2, -4.6, -3.0, -1.4].map(x => b([x, 0, 3.35], [0.52, 0.95, 0.52], "leather")),
    ], [[-3.8, 4.3, 3.0, 0.5], [-3.8, 3.35, 3.0, 0.26]]),
    fx("library", 0, "library", "Library wall (walnut, books face-out)", [b([-5.3, 0, 7.75], [8.4, 3.1, 0.45], "walnut"), b([-5.3, 0.35, 7.5], [8.1, 2.5, 0.06], "books")], [[-5.3, 7.7, 4.2, 0.3]]),
    fx("notice-board", 0, "board", "Notice board and club goals", [b([1.8, 1.0, 7.86], [2.1, 1.4, 0.08], "cork"), b([4.1, 1.0, 7.86], [1.6, 1.4, 0.08], "plaque")]),
    fx("clock", 0, "work", "Clock", [b([-0.2, 0, 7.75], [0.6, 2.1, 0.4], "walnut")], [[-0.2, 7.75, 0.3, 0.2]]),
    founder(7.4),
    fx("trophy-case", 0, "work", "Trophy case", [b([9.55, 0, 4.4], [0.7, 2.0, 2.0], "glass")], [[9.55, 4.4, 0.35, 1.0]]),
    fx("workbench", 0, "work", "Workbench (crafting)", [b([-9.35, 0, 3.7], [0.9, 0.9, 1.8], "walnut")], [[-9.35, 3.7, 0.45, 0.9]]),
    // The mezzanine: the big lounge under the oval ceiling, the admin doors, the banners on the rail.
    fx("upper-carpet", 1, "upper-lounge", "Big lounge: shag carpet, velvet sofas, beanbags", [b([2.0, 0, 4.8], [10.4, 0.03, 5.8], "shag")]),
    fx("upper-sofas", 1, "upper-lounge", "", [b([2.0, 0, 7.15], [4.2, 0.82, 0.9], "velvet"), b([6.75, 0, 4.6], [0.9, 0.82, 3.2], "velvet"), b([-1.8, 0, 5.6], [0.85, 0.82, 0.85], "velvet")],
      [[2.0, 7.15, 2.1, 0.45], [6.75, 4.6, 0.45, 1.6], [-1.8, 5.6, 0.43, 0.43]]),
    fx("upper-tables", 1, "upper-lounge", "", [b([2.0, 0, 4.9], [1.9, 0.36, 1.0], "stone"), b([4.7, 0, 5.8], [0.8, 0.45, 0.8], "leather")], [[2.0, 4.9, 0.95, 0.5], [4.7, 5.8, 0.4, 0.4]]),
    fx("beanbags", 1, "upper-lounge", "Beanbags by the rail", [-1.2, 0.6, 2.4, 4.2].map(x => b([x, 0, 2.75], [0.85, 0.5, 0.85], "beanbag")),
      [[1.5, 2.75, 3.15, 0.43]]),
    fx("arc-lamp", 1, "upper-lounge", "The arc lamp", arcLamp([-2.6, 6.9], [1.7, 4.9]), [[-2.6, 6.9, 0.25, 0.25]]),
    fx("admin-doors", 1, "admin", "Admins only (locked)", [
      b([-7.4, 0, 7.92], [1.1, 2.3, 0.1], "door"), b([-4.9, 0, 7.92], [1.1, 2.3, 0.1], "door"),
      b([-7.4, 1.65, 7.85], [0.42, 0.13, 0.03], "plaque"), b([-4.9, 1.65, 7.85], [0.42, 0.13, 0.03], "plaque"),
    ]),
    ...[-6.0, -3.4, -0.8, 1.8, 4.4, 7.0].map((x, i) => banner(i, x, A_UPPER.z0 - 0.05, "x", 1.05)),
    fx("upper-plants", 1, "upper-lounge", "", [b([9.2, 0, 7.2], [0.8, 1.7, 0.8], "plant"), b([9.2, 0, 5.6], [0.8, 1.2, 0.8], "plant")], [[9.2, 7.2, 0.4, 0.4], [9.2, 5.6, 0.4, 0.4]]),
  ],
  stations: [
    st("exit", "Island", HQ_EXIT, "exit", HQ_EXIT_RANGE),
    st("desk", "Front desk", [-3.6, -6.3], "desk", 1.8),
    st("board", "Notice board", [2.6, 6.75], "board", 2.3),
    st("founder", "The Founder's desk", [7.2, 5.55], "founder", 1.35),
    st("display", "Trophy display", [8.45, 4.4], "display", 1.6),
    st("shelf", "Library", [-5.3, 6.6], "shelf", 2.0),
    st("clock", "Clock", [-0.2, 6.9], "clock", 1.6),
    st("bench", "Workbench", [-8.2, 3.7], "bench", 1.3),
    st("coffee", "Coffee bar", [-5.6, -2.3], "coffee", 1.5),
    st("aquarium", "Aquarium", [7.9, -2.1], "aquarium", 1.4),
    st("admin-1", "Admins only", [-7.4, 7.0], "locked", 1.1, 1),
    st("admin-2", "Admins only", [-4.9, 7.0], "locked", 1.1, 1),
  ],
  paths: [
    { id: "aisle", level: 0, label: "From the door to the back", points: [HQ_SPAWN, [0, -3.0], [0, 1.0], [0, 6.0]] },
    { id: "to-desk", level: 0, label: "To Wren's desk", points: [[0, -6.3], [-3.6, -6.3]] },
    { id: "to-lounge", level: 0, label: "To the aquarium lounge", points: [[0, -3.0], [3.6, -3.0], [3.6, 0.6], [7.9, 0.6]] },
    { id: "to-stair", level: 0, label: "To the stair", points: [[0, -3.0], [-7.6, -3.0], [-7.6, -4.6], [-8.9, -4.6]] },
    { id: "work", level: 0, label: "The work floor", points: [[0, 2.4], [-7.6, 2.4], [-7.6, 6.5], [5.6, 6.5], [5.6, 2.6], [0, 2.4]] },
    { id: "flight", level: "stair", label: "Up the stair", points: [[-8.9, -4.0], [-8.9, 1.5]] },
    { id: "upper", level: 1, label: "The mezzanine", points: [[-8.9, 2.1], [-6.0, 2.1], [-6.0, 6.7], [-3.2, 6.7], [-3.2, 3.6], [5.6, 3.6], [5.6, 2.2], [8.9, 2.2]] },
  ],
};

// ── Option B: the gallery round the hall ──────────────────────────────────────────────────────────────────────────
const B_BRIDGE: Rect = { x0: -W, x1: W, z0: -D, z1: -3.5 };
const B_LEFT: Rect = { x0: 5.5, x1: W, z0: -3.5, z1: D };
const B_RIGHT: Rect = { x0: -W, x1: -5.5, z0: -3.5, z1: D };
const B_STAIR: Stair = { x0: -W, x1: -8.2, foot: 1.0, head: 6.5, steps: 16 };
const OPTION_B: HqOption = {
  id: "b", name: "B · The gallery",
  summary: "The aquarium fills the back wall straight ahead; the upper floor wraps the hall in a U, the lounge on the bridge over the door facing the tank, the banners off the arms.",
  upper: [B_BRIDGE, B_LEFT, B_RIGHT],
  stair: B_STAIR,
  aquarium: { x0: -5.0, x1: 5.0, z0: 6.6, z1: D, y0: 0.25, y1: 2 * F - 0.2, facing: "-z" },
  rails: [
    { from: [-5.5, -3.5], to: [5.5, -3.5] }, { from: [5.5, -3.5], to: [5.5, D] }, { from: [-5.5, -3.5], to: [-5.5, D] },
    { from: [B_STAIR.x1, B_STAIR.foot], to: [B_STAIR.x1, B_STAIR.head] },
  ],
  ovalCeiling: { x0: -7.6, x1: 7.6, z0: -7.8, z1: -3.7 },
  windows: [{ wall: "front", from: 3.4, to: 7.6, level: 0 }, { wall: "front", from: -7.6, to: -3.4, level: 0 }, { wall: "front", from: -7.0, to: -2.0, level: 1 }, { wall: "front", from: 2.0, to: 7.0, level: 1 }],
  fixtures: [
    // Ground floor: the entry under the bridge (Wren's desk left, the coffee bar right).
    ...frontDesk(4.2, -5.4),
    coffeeBar(-4.4, -5.0),
    // The hall: the lamp-lit lounge before the aquarium.
    fx("ground-lounge", 0, "lounge", "Lamp-lit lounge before the aquarium", [
      b([0, 0, 3.7], [7.0, 0.02, 4.6], "carpet"), b([0, 0, 1.9], [3.2, 0.82, 0.9], "velvet"), b([0, 0, 3.7], [1.6, 0.38, 0.85], "stone"),
      b([2.7, 0, 3.8], [0.85, 0.82, 0.85], "velvet"), b([-2.7, 0, 3.8], [0.85, 0.82, 0.85], "velvet"), b([3.7, 0, 2.0], [0.32, 1.55, 0.32], "lamp"), b([-3.7, 0, 2.0], [0.32, 1.55, 0.32], "lamp"),
    ], [[0, 1.9, 1.6, 0.45], [0, 3.7, 0.8, 0.43], [2.7, 3.8, 0.43, 0.43], [-2.7, 3.8, 0.43, 0.43], [3.7, 2.0, 0.16, 0.16], [-3.7, 2.0, 0.16, 0.16]]),
    fx("plant-b1", 0, "entry", "", [b([1.9, 0, -7.4], [0.7, 1.5, 0.7], "plant")], [[1.9, -7.4, 0.35, 0.35]]),
    // Under the left arm: the library and co-working; the Founder's desk and the trophy case at the back.
    fx("library", 0, "library", "Library wall (walnut, books face-out)", [b([9.75, 0, 0.2], [0.45, 3.1, 7.0], "walnut"), b([9.5, 0.35, 0.2], [0.06, 2.5, 6.7], "books")], [[9.72, 0.2, 0.3, 3.5]]),
    fx("coworking", 0, "work", "Co-working (long walnut desk, monitors)", [
      b([7.6, 0, 0.4], [1.0, 0.76, 5.8], "walnut"),
      ...[-1.6, -0.1, 1.4, 2.9].map(z => b([7.9, 0.76, z], [0.06, 0.42, 0.62], "screen")),
      ...[-1.6, -0.1, 1.4, 2.9].map(z => b([6.65, 0, z], [0.52, 0.95, 0.52], "leather")),
    ], [[7.6, 0.4, 0.5, 2.9], [6.65, 0.65, 0.26, 2.55]]),
    founder(8.0),
    fx("trophy-case", 0, "work", "Trophy case", [b([9.55, 0, 5.2], [0.7, 2.0, 1.8], "glass")], [[9.55, 5.2, 0.35, 0.9]]),
    // Under the right arm: the notice board by the stair, the workbench at the back.
    fx("notice-board", 0, "board", "Notice board and club goals", [b([-9.86, 1.0, -2.0], [0.08, 1.4, 2.1], "cork"), b([-9.86, 1.0, 0.0], [0.08, 1.4, 1.4], "plaque")]),
    fx("workbench", 0, "work", "Workbench (crafting)", [b([-7.0, 0, 7.4], [1.8, 0.9, 0.9], "walnut")], [[-7.0, 7.4, 0.9, 0.45]]),
    fx("clock", 0, "entry", "Clock", [b([-2.3, 0, -7.75], [0.6, 2.1, 0.4], "walnut")], [[-2.3, -7.75, 0.3, 0.2]]),
    // Upstairs: the big lounge on the bridge, facing the aquarium across the hall.
    fx("upper-carpet", 1, "upper-lounge", "Big lounge: shag carpet, velvet sofas, beanbags", [b([0, 0, -5.8], [14.5, 0.03, 4.0], "shag")]),
    fx("upper-sofas", 1, "upper-lounge", "", [b([-2.6, 0, -7.35], [3.8, 0.82, 0.9], "velvet"), b([2.6, 0, -7.35], [3.8, 0.82, 0.9], "velvet"), b([6.6, 0, -5.9], [0.85, 0.82, 0.85], "velvet")],
      [[-2.6, -7.35, 1.9, 0.45], [2.6, -7.35, 1.9, 0.45], [6.6, -5.9, 0.43, 0.43]]),
    fx("upper-tables", 1, "upper-lounge", "", [b([0, 0, -5.9], [2.0, 0.36, 1.0], "stone"), b([4.6, 0, -6.2], [0.8, 0.45, 0.8], "leather")], [[0, -5.9, 1.0, 0.5], [4.6, -6.2, 0.4, 0.4]]),
    fx("beanbags", 1, "upper-lounge", "Beanbags by the rail", [-3.9, -1.4, 1.4, 3.9].map(x => b([x, 0, -4.1], [0.85, 0.5, 0.85], "beanbag")), [[0, -4.1, 4.35, 0.43]]),
    fx("arc-lamp", 1, "upper-lounge", "The arc lamp", arcLamp([-6.4, -6.9], [-2.4, -5.9]), [[-6.4, -6.9, 0.25, 0.25]]),
    { ...fx("admin-doors", 1, "admin", "Admins only (locked)", [
      b([9.92, 0, 1.2], [0.1, 2.3, 1.1], "door"), b([9.92, 0, 3.7], [0.1, 2.3, 1.1], "door"),
      b([9.85, 1.65, 1.2], [0.03, 0.13, 0.42], "plaque"), b([9.85, 1.65, 3.7], [0.03, 0.13, 0.42], "plaque"),
    ]), part: 1 },
    // The banners: on poles off each arm's rail, hanging across the hall's edge, one after another towards the tank.
    ...[[5.5, -1.6], [5.5, 1.4], [5.5, 4.4], [-5.5, -1.6], [-5.5, 1.4], [-5.5, 4.4]].map(([x, z], i) => {
      const inward = x > 0 ? -1 : 1, mid = x + inward * 0.65;
      const f = banner(i, mid, z, "x", 1.0);
      f.blocks.unshift(b([x + inward * 0.6, 1.0, z], [1.3, 0.05, 0.05], "metal"));
      return { ...f, part: x > 0 ? 1 : 2 };
    }),
    fx("upper-plants", 1, "upper-lounge", "", [b([9.2, 0, -7.3], [0.8, 1.7, 0.8], "plant"), b([-9.2, 0, -7.3], [0.8, 1.7, 0.8], "plant")], [[9.2, -7.3, 0.4, 0.4], [-9.2, -7.3, 0.4, 0.4]]),
  ],
  stations: [
    st("exit", "Island", HQ_EXIT, "exit", HQ_EXIT_RANGE),
    st("desk", "Front desk", [4.2, -6.5], "desk", 1.8),
    st("board", "Notice board", [-8.6, -1.2], "board", 2.0),
    st("founder", "The Founder's desk", [7.8, 5.6], "founder", 1.35),
    st("display", "Trophy display", [8.45, 5.2], "display", 1.6),
    st("shelf", "Library", [8.9, -2.6], "shelf", 1.6),
    st("clock", "Clock", [-2.3, -6.9], "clock", 1.4),
    st("bench", "Workbench", [-7.0, 6.3], "bench", 1.3),
    st("coffee", "Coffee bar", [-4.4, -6.6], "coffee", 1.5),
    st("aquarium", "Aquarium", [0, 5.9], "aquarium", 1.6),
    st("admin-1", "Admins only", [9.0, 1.2], "locked", 1.1, 1),
    st("admin-2", "Admins only", [9.0, 3.7], "locked", 1.1, 1),
  ],
  paths: [
    { id: "aisle", level: 0, label: "From the door to the aquarium", points: [HQ_SPAWN, [0, -3.0], [0, 0.9], [4.6, 0.9], [4.6, 5.9], [0, 5.9]] },
    { id: "to-desk", level: 0, label: "To Wren's desk", points: [[0, -6.5], [4.2, -6.5]] },
    { id: "to-board-stair", level: 0, label: "To the board and the stair", points: [[0, -3.0], [-8.9, -3.0], [-8.9, 0.6]] },
    { id: "left-arm", level: 0, label: "Under the left arm", points: [[0, -3.0], [5.9, -3.0], [5.9, 5.6], [7.8, 5.6]] },
    { id: "to-bench", level: 0, label: "To the workbench", points: [[-4.6, 0.9], [-4.6, 6.0], [-7.0, 6.0]] },
    { id: "flight", level: "stair", label: "Up the stair", points: [[-8.9, 1.0], [-8.9, 6.5]] },
    { id: "upper", level: 1, label: "Round the gallery", points: [[-8.9, 7.2], [-6.9, 7.2], [-6.9, -4.95], [6.9, -4.95], [7.6, 2.4]] },
  ],
};

export const HQ_OPTIONS: Record<Option, HqOption> = { a: OPTION_A, b: OPTION_B };

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
export function zoneLabels(o: HqOption): { text: string; level: Level; at: [number, number] }[] {
  return o.id === "a" ? [
    { text: "ENTRY", level: 0, at: [-1.2, -5.0] }, { text: "AQUARIUM LOUNGE", level: 0, at: [6.4, 0.4] }, { text: "COFFEE", level: 0, at: [-5.6, 0.5] },
    { text: "WORK (under the mezzanine)", level: 0, at: [-1.0, 5.6] }, { text: "STAIR", level: 0, at: [-9.1, -1.2] },
    { text: "BIG LOUNGE", level: 1, at: [2.0, 3.6] }, { text: "ADMINS ONLY", level: 1, at: [-6.1, 6.2] }, { text: "OPEN TO BELOW", level: 1, at: [0, -3.0] },
  ] : [
    { text: "ENTRY (under the bridge)", level: 0, at: [1.6, -3.9] }, { text: "HALL: AQUARIUM LOUNGE", level: 0, at: [0, 0.2] }, { text: "LIBRARY + WORK", level: 0, at: [7.6, 4.0] },
    { text: "BOARD + STAIR", level: 0, at: [-7.9, 3.4] }, { text: "COFFEE", level: 0, at: [-4.6, -3.4] },
    { text: "BIG LOUNGE (the bridge)", level: 1, at: [-5.4, -5.2] }, { text: "OPEN TO BELOW", level: 1, at: [0, 1.0] }, { text: "ADMINS ONLY", level: 1, at: [7.9, 5.8] },
    { text: "GALLERY", level: 1, at: [-7.5, -1.0] },
  ];
}
