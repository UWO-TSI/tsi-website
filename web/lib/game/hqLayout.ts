/**
 * HQ's room (specs/interiors/hq.md, ledger row 316): every number the models stand on, the walker walks and the stations
 * sit at. David's layout is option B, the gallery (2026-10-19: "i said to do plan b, also make roofs taller for both
 * floors"), grown for more space on his phase 3 review (2026-10-22): a big room of two tall storeys (24 x 18, the floors
 * 4.6 apart, the ceiling at 9.2), the door in the middle of the front wall, the aquarium filling the back wall straight
 * ahead, the full height of the room. The upper floor wraps the double-height hall in a U: a bridge over the entrance
 * holds the big lounge under the walnut oval ceiling, facing the tank head on; an arm runs down each side, the yearly
 * banners hanging off their rails one after another toward the tank. Downstairs: the entry under the bridge (Wren's
 * desk, the coffee bar, the work lounge, a window nook), the big lounge before the tank (a sectional, beanbags, a big
 * rug), the library and co-working under the left arm, the notice board, the stair and the one admin door (under the
 * stair) under the right. Upstairs: the study on the left arm (a long table with monitors, shelves, a whiteboard), a
 * reading nook on each arm. Big modern windows, floor to ceiling where the wall is free.
 *
 * Room space: the door at z −9, the back wall at z 9; +x is screen left (the walking camera looks from the door towards
 * +z). Level 1 numbers are above its floor (F). The model build (art/interiors/build_hq.py) reads these through
 * art/interiors/hq_layout.json (web/scripts/hq-layout-json.mjs): change the layout here, never there.
 */
export type Level = 0 | 1;
export const HQ_ROOM = { halfW: 12, halfD: 9, wall: 0.3, lip: 0.9 } as const;
export const HQ_FLOOR_HEIGHT = 4.6;
export const HQ_SLAB = 0.3;
export const HQ_DOOR = { x: 0, half: 1.0 } as const;
export const HQ_SPAWN: [number, number] = [0, -7.4];
export const HQ_EXIT: [number, number] = [0, -8.2];
export const HQ_EXIT_RANGE = 1.1;
export const HQ_WALK_MARGIN = 0.7;
export const HQ_PAD = 0.25;
/** How far in from an open edge (a rail) you can stand. */
export const HQ_EDGE = 0.4;
/** The rail's top above its floor. */
export const HQ_RAIL = 1.05;
/**
 * The walking camera (components/game/interiorShared.tsx followInteriorCamera): this far over your floor and behind you
 * (toward −z), looking at you. The walker cuts away whatever part of the upper floor stands between it and you.
 */
export const HQ_CAMERA = { up: 8.4, back: 7.2 } as const;

export type Finish = "walnut" | "concrete" | "leather" | "velvet" | "marble" | "carpet" | "shag" | "books" | "stone" | "metal" | "plant"
  | "glass" | "banner" | "door" | "plaque" | "lamp" | "water" | "cork" | "screen" | "person" | "beanbag" | "board";
export interface Block { at: [number, number, number]; size: [number, number, number]; finish: Finish }
/** A footprint: centre x, z and half its width and depth. */
export type Footprint = [number, number, number, number];
/** Which way a piece faces (its front): the build turns a piece made facing −z to it. */
export type Facing = "-z" | "+z" | "-x" | "+x";
export type Zone = "entry" | "work" | "coffee" | "library" | "lounge" | "aquarium" | "founder" | "board" | "upper-lounge" | "study" | "admin" | "flags" | "stair";
export interface Fixture {
  id: string; level: Level; zone: Zone; label: string; blocks: Block[]; footprint?: Footprint[];
  /** Its front (−z when not given): the build makes it facing −z about its first block and turns it. */
  facing?: Facing;
  /** Upstairs: which part of the upper floor it belongs to (cut away with it); 0 when not given. */
  part?: number;
}
export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** The flight: in a lane x0..x1 along z, its foot at `foot` and its head (the upper floor's edge) at `head`. */
export interface Stair { x0: number; x1: number; foot: number; head: number; steps: number }
export interface Station { id: string; name: string; pos: [number, number]; level: Level; range: number; action: string }
export interface Path { id: string; level: Level | "stair"; label: string; points: [number, number][] }
/** A rail along an open edge of the upper floor: `slab` points from it toward the floor it guards. */
export interface Rail { from: [number, number]; to: [number, number]; slab: [number, number] }
/** A window in a side wall (x ±W), from z0 to z1 and y0 to y1 (absolute heights). */
export interface Window { wall: "left" | "right"; z0: number; z1: number; y0: number; y1: number }
/** A window in the front wall (z −D), from x0 to x1 and y0 to y1 (absolute heights). */
export interface FrontWindow { x0: number; x1: number; y0: number; y1: number }
/** A run of black track with its spots (y: under what ceiling), each spot aimed at a point. */
export interface Track { from: [number, number, number]; to: [number, number, number]; spots: { at: number; aim: [number, number, number] }[] }
/** Which wall a sconce is on, by the way it faces the room: "-x" the left wall (x +W), "+x" the right (or the admin
 * door's partition), "-z" the back, "+z" the front. */
export type WallFace = "-z" | "+z" | "-x" | "+x";
/**
 * A lamp: what it is, where its light comes from (above its floor), the height of what it stands on, and the radius of
 * the warm pool it throws on the floor (faked: lib/game/hqLight.ts, not a real light). Upstairs, its part. A sconce
 * hangs on a wall (`wall`) and washes it up and down.
 */
export interface Lamp {
  id: string; kind: "arc" | "mushroom" | "floor" | "desk" | "sconce"; level: Level; light: [number, number, number]; on: number; pool: number; part?: number;
  wall?: WallFace;
}
export interface HqOption {
  id: "b"; name: string; summary: string;
  /** The upper floor's parts (walkable on them, open below everywhere else): the bridge, the left arm, the right arm. */
  upper: Rect[];
  stair: Stair;
  aquarium: Rect & { y0: number; y1: number; facing: "-z" };
  rails: Rail[];
  /** The walnut ceiling with its oval cut-outs: over the bridge's lounge only (level 1, at the room's ceiling). */
  ovalCeiling: Rect;
  windows: Window[];
  frontWindows: FrontWindow[];
  tracks: Track[];
  lamps: Lamp[];
  fixtures: Fixture[];
  stations: Station[];
  paths: Path[];
}

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): Block => ({ at, size, finish });
const W = HQ_ROOM.halfW, D = HQ_ROOM.halfD, F = HQ_FLOOR_HEIGHT, TOP = 2 * F;
const fx = (id: string, level: Level, zone: Zone, label: string, blocks: Block[], footprint?: Footprint[], more: Partial<Fixture> = {}): Fixture =>
  ({ id, level, zone, label, blocks, footprint, ...more });
const st = (id: string, name: string, pos: [number, number], action: string, range = 1.6, level: Level = 0): Station => ({ id, name, pos, level, range, action });
/** A plant in its pot: `h` tall, `w` across (the build picks a palm, a bush or a snake plant from its size). */
const plant = (id: string, level: Level, x: number, z: number, w: number, h: number, part?: number): Fixture =>
  fx(id, level, level ? "upper-lounge" : "entry", "", [b([x, 0, z], [w, h, w], "plant")], [[x, z, w * 0.45, w * 0.45]], part === undefined ? {} : { part });
/** A floor lamp: its foot on the floor, its light at the shade. */
const floorLamp = (id: string, level: Level, x: number, z: number, pool = 2.0, part?: number): [Lamp, Fixture] => [
  { id, kind: "floor", level, light: [x, 1.5, z], on: 0, pool, ...(part === undefined ? {} : { part }) },
  fx(id, level, level ? "upper-lounge" : "lounge", "", [b([x, 0, z], [0.32, 1.55, 0.32], "lamp")], [[x, z, 0.17, 0.17]], part === undefined ? {} : { part }),
];
const sconce = (id: string, level: Level, x: number, y: number, z: number, wall: WallFace, part?: number): Lamp =>
  ({ id, kind: "sconce", level, light: [x, y, z], on: 0, pool: 1.3, wall, ...(part === undefined ? {} : { part }) });

/** Wren's front desk facing the door (its counter towards −z), the register on its ledge, her post behind it. */
export const HQ_DESK = { x: 4.6, z: -6.4 } as const;
/** Where Wren stands and moves behind the desk (lib/game/keepers.ts reads these). */
export const HQ_WREN: { at: [number, number]; clip: "Idle" | "Trace" | "Forage"; stay: number }[] = [
  { at: [HQ_DESK.x - 0.15, HQ_DESK.z + 1.4], clip: "Idle", stay: 7 },
  { at: [HQ_DESK.x + 0.65, HQ_DESK.z + 1.4], clip: "Trace", stay: 6.5 },    // the register
  { at: [HQ_DESK.x - 0.85, HQ_DESK.z + 1.4], clip: "Forage", stay: 1.3 },   // under the counter
];
/** What the new stations say on E (drafts for David; the admin door's line is the lane brief's). */
export const HQ_LINES = {
  coffee: "Fresh coffee at the marble bar. The cups are already warm.",
  aquarium: "Silver fish turn together in the blue. A small orange one goes its own way.",
  admin: "Admins only. It's locked.",
} as const;
/** The trophy case, the clock, the workbench and the Founder's desk (their components read these). */
export const HQ_TROPHY = { x: 11.45, z: 4.6, yaw: Math.PI / 2 } as const;
export const HQ_CLOCK_AT = { x: 7.4, z: 8.6, yaw: Math.PI } as const;
/** The workbench against the right wall in the front corner (its working side faces +x: crafting/Workshop.tsx). */
export const HQ_BENCH = { x: -11.25, z: -7.9 } as const;
export const HQ_FOUNDER = { x: 9.6, z: 8.3 } as const;

const BRIDGE: Rect = { x0: -W, x1: W, z0: -D, z1: -4.0 };
const LEFT: Rect = { x0: 6.5, x1: W, z0: -4.0, z1: D };
const RIGHT: Rect = { x0: -W, x1: -6.5, z0: -4.0, z1: D };
/** Up the right wall under the right arm, toward the back: 22 steps of 0.21 rise and 0.3 run. */
const STAIR: Stair = { x0: -W, x1: -10.2, foot: 0.6, head: 7.2, steps: 22 };
const TANK = { x0: -5.5, x1: 5.5, z0: 7.6 };
const { x: DX, z: DZ } = HQ_DESK;
const CX = -4.8, CZ = -6.2;               // the coffee bar
/** The one admin door, under the stair's high end, in the walnut partition that closes the space under the flight. */
const ADMIN = { x: STAIR.x1, z: 5.4 } as const;
/** The banners: off each arm's rail, one after another toward the tank, hanging over the hall's edge, facing the door. */
const BANNER_Z = [-1.8, 1.8, 5.4];
const BANNER = { w: 1.2, h: 2.6, top: 1.3, reach: 0.85 } as const;
const UNDER = F - HQ_SLAB - 0.04;         // a track under the upper floor
/** Floor to ceiling: a ground-floor window under the arms' 4.3, an upper one under the room's 9.2. */
const LOW = [0.12, F - HQ_SLAB - 0.3] as const, HIGH = [F + 0.12, TOP - 0.25] as const;
/** The upstairs study on the left arm: the long table down the arm, three monitors a side, back to back. */
const STUDY = { x: 9.3, z: 3.5, len: 6.0, seats: [1.5, 3.5, 5.5] } as const;

const LAMPS_FIXTURES = [
  floorLamp("lounge-floor-l", 0, 4.6, 1.2, 2.3), floorLamp("lounge-floor-r", 0, -4.6, 1.2, 2.3),
  floorLamp("work-floor", 0, 11.3, -8.35, 2.0), floorLamp("nook-floor", 0, -9.3, -8.45, 2.0),
  floorLamp("founder-floor", 0, 11.3, 8.3, 2.0), floorLamp("stair-floor", 0, -7.2, 8.35, 2.0),
  floorLamp("bridge-floor-l", 1, 10.9, -5.0, 2.0, 0), floorLamp("bridge-floor-r", 1, -10.9, -5.0, 2.0, 0), floorLamp("bridge-floor-front", 1, -8.2, -8.45, 2.0, 0),
  floorLamp("reading-floor", 1, 11.35, -0.3, 1.8, 1), floorLamp("study-floor", 1, 7.3, 8.35, 2.0, 1),
  floorLamp("right-nook-floor", 1, -11.35, -0.3, 1.8, 2), floorLamp("landing-floor", 1, -8.2, 8.4, 1.8, 2),
  floorLamp("well-floor", 1, -9.75, 4.2, 1.8, 2),
] as const;

export const HQ: HqOption = {
  id: "b", name: "The gallery",
  summary: "The aquarium fills the back wall straight ahead; the upper floor wraps the hall in a U, the lounge on the bridge over the door facing the tank, the study on the left arm, the banners off the arms.",
  upper: [BRIDGE, LEFT, RIGHT],
  stair: STAIR,
  aquarium: { ...TANK, z1: D, y0: 0.25, y1: TOP - 0.2, facing: "-z" },
  rails: [
    { from: [RIGHT.x1, BRIDGE.z1], to: [LEFT.x0, BRIDGE.z1], slab: [0, -1] },
    { from: [LEFT.x0, BRIDGE.z1], to: [LEFT.x0, TANK.z0], slab: [1, 0] },
    { from: [RIGHT.x1, BRIDGE.z1], to: [RIGHT.x1, TANK.z0], slab: [-1, 0] },
    // round the stair's well: along its open side and across its foot
    { from: [STAIR.x1, STAIR.foot], to: [STAIR.x1, STAIR.head], slab: [1, 0] },
    { from: [-W, STAIR.foot], to: [STAIR.x1, STAIR.foot], slab: [0, -1] },
  ],
  ovalCeiling: { x0: -9.6, x1: 9.6, z0: -8.8, z1: -4.25 },
  // Big modern panes, thin black frames, upright mullions only (David, 2026-10-22: "big clear windows like in modern
  // appartments and not the curtain with the + kinda window"): floor to ceiling where the wall is free.
  windows: [
    { wall: "left", z0: -8.5, z1: -4.6, y0: LOW[0], y1: LOW[1] },          // behind the work lounge
    { wall: "left", z0: 6.1, z1: 8.5, y0: LOW[0], y1: LOW[1] },            // the Founder's corner
    { wall: "right", z0: -6.7, z1: -4.3, y0: LOW[0], y1: LOW[1] },         // the window nook
    { wall: "left", z0: -8.5, z1: -4.4, y0: HIGH[0], y1: HIGH[1] },        // the bridge's ends
    { wall: "right", z0: -8.5, z1: -4.4, y0: HIGH[0], y1: HIGH[1] },
    { wall: "left", z0: -3.6, z1: -0.1, y0: HIGH[0], y1: HIGH[1] },        // the left arm's reading nook
    { wall: "left", z0: 0.5, z1: 6.5, y0: F + 1.1, y1: HIGH[1] },          // over the study's shelves
    { wall: "right", z0: -3.6, z1: 6.4, y0: HIGH[0], y1: HIGH[1] },        // the right arm's nook and over the stair
  ],
  frontWindows: [
    { x0: 6.3, x1: 11.2, y0: LOW[0], y1: LOW[1] }, { x0: -10.3, x1: -6.3, y0: LOW[0], y1: LOW[1] },
    { x0: 6.2, x1: 11.4, y0: HIGH[0], y1: HIGH[1] }, { x0: -11.4, x1: -6.2, y0: HIGH[0], y1: HIGH[1] },
  ],
  tracks: [
    // The hall's ceiling: spots on the lounge before the tank.
    { from: [-5.6, TOP - 0.06, 1.2], to: [5.6, TOP - 0.06, 1.2], spots: [{ at: -3.6, aim: [-2.4, 0.5, 3.4] }, { at: -1.2, aim: [-0.6, 0.4, 3.4] }, { at: 1.2, aim: [0.6, 0.4, 3.4] }, { at: 3.6, aim: [2.4, 0.5, 3.4] }] },
    // Under the bridge: the nook, the coffee bar, Wren's desk, the work lounge.
    { from: [-10.8, UNDER, -6.6], to: [10.8, UNDER, -6.6], spots: [{ at: -9.6, aim: [-10.2, 0.8, -5.4] }, { at: CX, aim: [CX, 1.1, CZ] }, { at: DX, aim: [DX, 1.1, DZ] }, { at: 9.8, aim: [9.8, 0.5, -6.6] }] },
    // Under the left arm: the library, the trophy case, the Founder's plaque.
    { from: [10.6, UNDER, -3.6], to: [10.6, UNDER, 8.4], spots: [{ at: -2.5, aim: [11.55, 1.9, -2.5] }, { at: -0.3, aim: [11.55, 1.9, -0.3] }, { at: 1.9, aim: [11.55, 1.9, 1.9] }, { at: 4.6, aim: [11.6, 1.4, 4.6] }, { at: 7.6, aim: [9.6, 2.0, 8.9] }] },
    // Under the right arm: the notice board and the club goals, the admin door under the stair.
    { from: [-9.0, UNDER, -3.6], to: [-9.0, UNDER, 6.4], spots: [{ at: -2.6, aim: [-11.85, 1.7, -2.6] }, { at: -0.8, aim: [-11.85, 1.7, -0.8] }, { at: ADMIN.z, aim: [ADMIN.x + 0.05, 1.6, ADMIN.z] }] },
    // Upstairs, under the oval ceiling: the lit art over the bridge's sofas.
    { from: [-2.6, TOP - 0.06, -8.2], to: [2.6, TOP - 0.06, -8.2], spots: [{ at: -1.6, aim: [0, F + 1.75, -8.95] }, { at: 1.6, aim: [0, F + 1.75, -8.95] }] },
    // Upstairs, down each arm: the banners; the study's whiteboard at the left arm's end, the canvas over the landing.
    { from: [7.6, TOP - 0.06, -3.4], to: [7.6, TOP - 0.06, 8.2], spots: [...BANNER_Z.map(z => ({ at: z - 0.9, aim: [LEFT.x0 - BANNER.reach, F + 0.2, z] as [number, number, number] })), { at: 7.6, aim: [9.2, F + 1.7, 8.95] }] },
    { from: [-7.6, TOP - 0.06, -3.4], to: [-7.6, TOP - 0.06, 8.2], spots: [...BANNER_Z.map(z => ({ at: z - 0.9, aim: [RIGHT.x1 + BANNER.reach, F + 0.2, z] as [number, number, number] })), { at: 7.6, aim: [-10.1, F + 2.0, 8.95] }] },
  ],
  lamps: [
    { id: "desk-lamp", kind: "mushroom", level: 0, light: [DX - 0.95, 1.18, DZ + 0.62], on: 0.76, pool: 1.7 },
    { id: "lounge-lamp", kind: "mushroom", level: 0, light: [0.5, 0.68, 3.4], on: 0.38, pool: 2.3 },
    { id: "work-lamp", kind: "mushroom", level: 0, light: [9.9, 0.62, -6.9], on: 0.4, pool: 1.8 },
    { id: "cowork-lamp-1", kind: "desk", level: 0, light: [9.25, 1.2, -1.6], on: 0.76, pool: 1.5 },
    { id: "cowork-lamp-2", kind: "desk", level: 0, light: [9.25, 1.2, 1.1], on: 0.76, pool: 1.5 },
    { id: "founder-lamp", kind: "desk", level: 0, light: [10.25, 1.22, 8.45], on: 0.78, pool: 1.5 },
    sconce("tank-sconce-l", 0, 6.0, 2.6, 7.56, "-z"), sconce("tank-sconce-r", 0, -6.0, 2.6, 7.56, "-z"),
    sconce("admin-sconce", 0, ADMIN.x + 0.06, 2.75, ADMIN.z - 0.95, "+x"),
    sconce("door-sconce-l", 0, 3.4, 2.6, -8.94, "+z"), sconce("door-sconce-r", 0, -3.4, 2.6, -8.94, "+z"),
    { id: "arc", kind: "arc", level: 1, light: [-1.0, 2.2, -6.9], on: 0, pool: 2.4, part: 0 },
    { id: "upper-mushroom", kind: "mushroom", level: 1, light: [5.6, 0.75, -7.4], on: 0.45, pool: 1.6, part: 0 },
    { id: "study-lamp-1", kind: "desk", level: 1, light: [STUDY.x, 1.2, 2.5], on: 0.76, pool: 1.6, part: 1 },
    { id: "study-lamp-2", kind: "desk", level: 1, light: [STUDY.x, 1.2, 4.5], on: 0.76, pool: 1.6, part: 1 },
    sconce("landing-sconce", 1, -11.94, 2.4, 8.1, "+x", 2),
    ...LAMPS_FIXTURES.map(([lamp]) => lamp),
  ],
  fixtures: [
    // ── Ground floor, the entry under the bridge: Wren's desk left of the door, the coffee bar right, the work lounge
    // in the left corner, the window nook and the workbench in the right. ──
    // Its footprint takes in the space behind it, where Wren works: visitors stay on the door's side.
    fx("front-desk", 0, "entry", "Wren's front desk", [b([DX, 0, DZ], [2.6, 1.05, 0.8], "walnut"), b([DX, 0, DZ + 0.65], [2.6, 0.76, 0.55], "walnut")], [[DX, DZ + 0.55, 1.4, 1.0]]),
    fx("register", 0, "entry", "The island register", [b([DX + 0.75, 1.05, DZ - 0.18], [0.55, 0.07, 0.38], "plaque")]),
    fx("coffee-bar", 0, "coffee", "Coffee bar (green marble)", [
      b([CX, 0, CZ], [2.6, 1.05, 0.95], "marble"), b([CX - 0.6, 0, CZ - 1.0], [0.42, 0.78, 0.42], "leather"), b([CX + 0.6, 0, CZ - 1.0], [0.42, 0.78, 0.42], "leather"),
    ], [[CX, CZ - 0.25, 1.3, 0.75]]),
    // The work lounge on the deep blue rug (ref 1): the black leather daybed, the brown leather sofa against the left
    // wall under the window, a glass table of books between them. Facing −x, into the room.
    fx("work-lounge", 0, "work", "Work lounge on the deep blue rug", [
      b([9.7, 0, -6.6], [3.8, 0.02, 3.6], "carpet"), b([8.7, 0, -6.6], [0.72, 0.42, 2.0], "leather"), b([11.15, 0, -6.6], [0.95, 0.82, 2.4], "velvet"),
      b([9.9, 0, -6.6], [0.62, 0.4, 1.25], "glass"),
    ], [[8.7, -6.6, 0.36, 1.0], [11.15, -6.6, 0.48, 1.2], [9.9, -6.6, 0.31, 0.63]], { facing: "-x" }),
    // The window nook (more lounging): a leather lounge chair and its ottoman before the big pane, turned to the room.
    fx("nook", 0, "entry", "Window nook", [b([-10.6, 0, -5.5], [0.95, 0.82, 0.95], "leather"), b([-9.55, 0, -5.5], [0.62, 0.4, 0.52], "leather")],
      [[-10.6, -5.5, 0.48, 0.48], [-9.55, -5.5, 0.31, 0.26]], { facing: "+x" }),
    fx("workbench", 0, "work", "Workbench (crafting)", [b([HQ_BENCH.x, 0, HQ_BENCH.z], [0.9, 0.9, 1.8], "walnut")], [[HQ_BENCH.x, HQ_BENCH.z, 0.5, 0.95]]),
    plant("palm-door-left", 0, 2.0, -8.4, 1.0, 2.6), plant("palm-door-right", 0, -2.0, -8.4, 1.0, 2.6),
    plant("palm-front-left", 0, 6.9, -8.35, 0.9, 2.4), plant("palm-front-right", 0, -6.9, -8.35, 0.9, 2.4),
    plant("snake-nook", 0, -11.45, -4.3, 0.5, 1.1),
    // ── The hall: the big lounge before the aquarium (David, 2026-10-22: "utilize the first floor space infront of the
    // fishtank to use for lounging, big cozy sofa and bean bag with bigger rug"): a deep U sectional facing the tank,
    // its travertine table and mushroom lamp, five beanbags between it and the glass, a big cream shag rug. ──
    fx("ground-lounge", 0, "lounge", "Big lounge before the aquarium: the sectional, beanbags, the big rug", [
      b([0, 0, 4.0], [10.4, 0.02, 6.2], "shag"),
      b([0, 0, 1.9], [6.0, 0.86, 1.1], "velvet"), b([3.55, 0, 2.975], [1.1, 0.86, 3.25], "velvet"), b([-3.55, 0, 2.975], [1.1, 0.86, 3.25], "velvet"),
      b([0, 0, 3.4], [2.0, 0.38, 1.0], "stone"),
    ], [[0, 1.9, 3.0, 0.55], [3.55, 2.975, 0.55, 1.625], [-3.55, 2.975, 0.55, 1.625], [0, 3.4, 1.0, 0.5]], { facing: "+z" }),
    fx("lounge-beanbags", 0, "lounge", "Beanbags by the glass", [[-2.7, 5.45], [-1.3, 5.85], [0.15, 5.6], [1.55, 5.9], [2.9, 5.45]].map(([x, z]) => b([x, 0, z], [0.92, 0.55, 0.92], "beanbag")),
      [[0, 5.65, 3.35, 0.46]]),
    plant("plant-tank", 0, -5.0, 6.8, 1.0, 2.4),
    // The tank's walnut cladding between its ends and the arms (solid, floor to ceiling).
    fx("tank-ends", 0, "aquarium", "", [b([6.0, 0, 8.3], [1.0, TOP, 1.4], "walnut"), b([-6.0, 0, 8.3], [1.0, TOP, 1.4], "walnut")], [[6.0, 8.3, 0.5, 0.7], [-6.0, 8.3, 0.5, 0.7]]),
    // ── Under the left arm: the library on the wall, co-working before it; the trophy case, the clock and the Founder's
    // desk at the back. ──
    fx("library", 0, "library", "Library wall (walnut, books face-out)", [b([11.775, 0, -0.3], [0.45, 3.6, 6.6], "walnut"), b([11.5, 0.35, -0.3], [0.06, 2.9, 6.3], "books")],
      [[11.75, -0.3, 0.3, 3.3]], { facing: "-x" }),
    fx("coworking", 0, "work", "Co-working (long walnut desk, monitors)", [
      b([9.0, 0, -0.3], [1.0, 0.76, 5.4], "walnut"),
      ...[-2.2, -0.9, 0.4, 1.7].map(z => b([9.3, 0.76, z], [0.06, 0.42, 0.62], "screen")),
      ...[-2.2, -0.9, 0.4, 1.7].map(z => b([7.95, 0, z], [0.52, 0.95, 0.52], "leather")),
    ], [[9.0, -0.3, 0.5, 2.7], [7.95, -0.25, 0.26, 2.21]], { facing: "-x" }),
    fx("trophy-case", 0, "work", "Trophy case", [b([HQ_TROPHY.x, 0, HQ_TROPHY.z], [0.7, 2.0, 2.0], "glass")], [[11.5, HQ_TROPHY.z, 0.4, 1.0]]),
    fx("clock", 0, "work", "Clock", [b([HQ_CLOCK_AT.x, 0, 8.75], [0.6, 2.1, 0.4], "walnut")], [[HQ_CLOCK_AT.x, 8.75, 0.3, 0.2]]),
    fx("founder", 0, "founder", "The Founder's desk and plaque", [
      b([HQ_FOUNDER.x, 0, HQ_FOUNDER.z], [1.9, 0.78, 0.9], "walnut"), b([HQ_FOUNDER.x - 0.3, 0, 7.4], [0.6, 1.05, 0.6], "leather"), b([HQ_FOUNDER.x, 1.75, 8.84], [0.9, 0.6, 0.05], "plaque"),
    ], [[HQ_FOUNDER.x, 8.0, 0.95, 0.9]]),
    // ── Under the right arm: the notice board and the club goals on the walnut wall before the stair's foot; the one
    // admin door (David, 2026-10-22: "make it 1, and place it like under the stairs") in the walnut partition closing
    // the space under the flight, locked. ──
    fx("notice-board", 0, "board", "Notice board and club goals", [b([-11.86, 1.0, -2.6], [0.08, 1.4, 2.1], "cork"), b([-11.86, 1.0, -0.75], [0.08, 1.4, 1.4], "plaque")], undefined, { facing: "+x" }),
    fx("admin-door", 0, "admin", "Admins only (locked), under the stair", [b([ADMIN.x, 0, ADMIN.z], [0.1, 2.3, 1.05], "door")],
      [[(STAIR.x0 + STAIR.x1) / 2, (2.2 + D) / 2, (STAIR.x1 - STAIR.x0) / 2, (D - 2.2) / 2]], { facing: "+x" }),
    plant("plant-stair", 0, -9.4, 8.35, 0.9, 2.0),
    // ── Upstairs, the bridge: the big lounge facing the tank across the hall, under the walnut oval ceiling. ──
    fx("upper-carpet", 1, "upper-lounge", "Big lounge: shag carpet, velvet sofas, beanbags", [b([0, 0, -6.6], [16.0, 0.03, 4.2], "shag")]),
    fx("upper-sofas", 1, "upper-lounge", "", [b([-2.9, 0, -8.35], [4.0, 0.86, 1.0], "velvet"), b([2.9, 0, -8.35], [4.0, 0.86, 1.0], "velvet"), b([7.6, 0, -6.9], [0.9, 0.82, 0.9], "velvet")],
      [[-2.9, -8.35, 2.0, 0.5], [2.9, -8.35, 2.0, 0.5], [7.6, -6.9, 0.45, 0.45]]),
    fx("upper-tables", 1, "upper-lounge", "", [b([0, 0, -6.9], [2.2, 0.36, 1.1], "stone"), b([5.6, 0, -7.4], [0.8, 0.45, 0.8], "leather")], [[0, -6.9, 1.1, 0.55], [5.6, -7.4, 0.4, 0.4]]),
    fx("beanbags", 1, "upper-lounge", "Beanbags by the rail", [-4.5, -1.5, 1.5, 4.5].map(x => b([x, 0, -4.75], [0.92, 0.55, 0.92], "beanbag")), [[0, -4.75, 4.96, 0.46]]),
    fx("arc-lamp", 1, "upper-lounge", "The arc lamp", [b([-5.9, 0, -8.3], [0.45, 3.6, 0.45], "metal"), b([-1.0, 2.2, -6.9], [0.55, 0.55, 0.55], "lamp")], [[-5.9, -8.3, 0.25, 0.25]]),
    // On the front wall over the sofas (the front wall is the ceiling model's: seen from inside only).
    fx("art", 1, "upper-lounge", "Lit art", [b([0, 1.15, -8.92], [1.2, 1.3, 0.06], "plaque")], undefined, { facing: "+z" }),
    plant("upper-plant-l", 1, 11.2, -8.4, 0.9, 2.0, 0), plant("upper-plant-r", 1, -11.2, -8.4, 0.9, 2.0, 0),
    plant("upper-snake", 1, 9.0, -8.55, 0.5, 1.1, 0),
    // ── The left arm, the study (David: "second floor can utilize space better by adding like study fixtures on the
    // left side ... and add like long table with monitor and chairs and stuff"): the reading nook by the bridge, the long
    // walnut table down the arm with three monitors a side and six chairs, low shelves along the wall under the window,
    // the whiteboard on the back wall. ──
    { ...fx("arm-chairs", 1, "study", "", [b([10.9, 0, -3.2], [0.9, 0.82, 0.9], "velvet"), b([10.9, 0, -1.2], [0.9, 0.82, 0.9], "velvet"), b([11.35, 0, -2.2], [0.55, 0.5, 0.55], "stone")],
      [[10.9, -3.2, 0.45, 0.45], [10.9, -1.2, 0.45, 0.45], [11.35, -2.2, 0.28, 0.28]]), part: 1 },
    { ...fx("study-table", 1, "study", "Study: the long table, monitors and chairs", [
      b([STUDY.x, 0, STUDY.z], [1.3, 0.76, STUDY.len], "walnut"),
      ...STUDY.seats.flatMap(z => [b([STUDY.x - 0.09, 0.76, z], [0.06, 0.42, 0.62], "screen"), b([STUDY.x + 0.09, 0.76, z], [0.06, 0.42, 0.62], "screen")]),
      ...STUDY.seats.flatMap(z => [b([STUDY.x - 1.1, 0, z], [0.52, 0.95, 0.52], "leather"), b([STUDY.x + 1.1, 0, z], [0.52, 0.95, 0.52], "leather")]),
    ], [[STUDY.x, STUDY.z, 0.65, STUDY.len / 2], [STUDY.x - 1.1, STUDY.z, 0.26, 2.26], [STUDY.x + 1.1, STUDY.z, 0.26, 2.26]]), part: 1 },
    { ...fx("study-shelves", 1, "study", "Study shelves under the window", [b([11.78, 0, 3.5], [0.42, 0.95, 6.2], "walnut"), b([11.6, 0.1, 3.5], [0.06, 0.8, 6.0], "books")],
      [[11.78, 3.5, 0.25, 3.1]], { facing: "-x" }), part: 1 },
    { ...fx("whiteboard", 1, "study", "Whiteboard", [b([9.2, 1.0, 8.95], [3.4, 1.3, 0.04], "board")]), part: 1 },
    plant("arm-plant-left", 1, 11.3, 7.5, 0.9, 1.9, 1),
    // ── The right arm: a reading nook by the bridge before the big pane, the landing at the stair's head. ──
    { ...fx("right-nook", 1, "upper-lounge", "Reading nook", [b([-10.9, 0, -3.2], [0.9, 0.82, 0.9], "velvet"), b([-10.9, 0, -1.2], [0.9, 0.82, 0.9], "velvet"), b([-11.35, 0, -2.2], [0.55, 0.5, 0.55], "stone")],
      [[-10.9, -3.2, 0.45, 0.45], [-10.9, -1.2, 0.45, 0.45], [-11.35, -2.2, 0.28, 0.28]], { facing: "+x" }), part: 2 },
    plant("arm-plant-right", 1, -7.0, 8.45, 0.8, 1.8, 2), plant("well-plant", 1, -9.75, 2.4, 0.7, 1.4, 2),
    // ── The banners: on poles off each arm's rail, hanging over the hall's edge, one after another toward the tank. ──
    ...[LEFT.x0, RIGHT.x1].flatMap((rx, side) => BANNER_Z.map((z, j) => {
      const inward = rx > 0 ? -1 : 1, mid = rx + inward * BANNER.reach;
      return fx(`banner-${side * 3 + j + 1}`, 1, "flags", side + j === 0 ? "Yearly banners (blank until David's designs)" : "", [
        b([rx + inward * (BANNER.reach + BANNER.w / 2 + 0.1) / 2, BANNER.top, z], [BANNER.reach + BANNER.w / 2 + 0.1, 0.05, 0.05], "metal"),
        b([mid, BANNER.top - BANNER.h, z], [BANNER.w, BANNER.h, 0.04], "banner"),
      ], undefined, { part: side + 1 });
    })),
    ...LAMPS_FIXTURES.map(([, f]) => f),
  ],
  stations: [
    st("exit", "Island", HQ_EXIT, "exit", HQ_EXIT_RANGE),
    st("desk", "Front desk", [DX, DZ - 1.1], "desk", 1.8),
    st("coffee", "Coffee bar", [CX, CZ - 1.7], "coffee", 1.5),
    st("board", "Notice board", [-10.6, -1.6], "board", 2.0),
    st("shelf", "Library", [10.7, -3.0], "shelf", 1.8),
    st("display", "Trophy display", [10.4, HQ_TROPHY.z], "display", 1.4),
    st("founder", "The Founder's desk", [HQ_FOUNDER.x - 0.2, 6.5], "founder", 1.2),
    st("clock", "Clock", [HQ_CLOCK_AT.x, 7.6], "clock", 1.3),
    st("aquarium", "Aquarium", [0, 6.95], "aquarium", 1.6),
    st("admin", "Admins only", [ADMIN.x + 0.85, ADMIN.z], "admin", 1.2),
  ],
  paths: [
    { id: "aisle", level: 0, label: "From the door round the sectional to the aquarium", points: [HQ_SPAWN, [0, -3.4], [0, 0.5], [5.8, 0.5], [5.8, 6.95], [0, 6.95]] },
    { id: "to-desk", level: 0, label: "To Wren's desk", points: [[0, -7.5], [DX, -7.5]] },
    { id: "to-coffee", level: 0, label: "To the coffee bar", points: [[0, -7.6], [CX, -7.6], [CX, CZ - 1.7]] },
    { id: "to-stair", level: 0, label: "To the board and the stair", points: [[0, -3.4], [-10.9, -3.4], [-10.9, 0.3]] },
    { id: "left-arm", level: 0, label: "Under the left arm", points: [[0, -3.4], [7.0, -3.4], [7.0, 6.4], [9.4, 6.5]] },
    { id: "library", level: 0, label: "Along the library", points: [[7.0, -3.4], [10.7, -3.4], [10.7, 2.8]] },
    { id: "to-clock", level: 0, label: "To the clock", points: [[0, -3.4], [7.0, -3.4], [7.0, 6.4], [HQ_CLOCK_AT.x, 7.6]] },
    { id: "right-arm", level: 0, label: "Under the right arm, beside the stair, to the admin door", points: [[0, -3.4], [-7.4, -3.4], [-7.4, ADMIN.z], [ADMIN.x + 0.85, ADMIN.z]] },
    { id: "flight", level: "stair", label: "Up the stair", points: [[-10.9, STAIR.foot], [-10.9, STAIR.head]] },
    { id: "upper", level: 1, label: "Round the gallery to the study", points: [[-10.9, 7.75], [-7.4, 7.75], [-7.4, -5.8], [7.25, -5.8], [7.25, 7.35], [9.3, 7.35]] },
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
/** The stair's well: the upper floor is open over the whole flight. */
export const stairWell = (o: HqOption): Rect => ({ x0: o.stair.x0, x1: o.stair.x1, z0: Math.min(o.stair.foot, o.stair.head), z1: Math.max(o.stair.foot, o.stair.head) });
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
/** Under a part of the upper floor: inside it by `by` (negative: grown). */
export function underPart(r: Rect, x: number, z: number, by: number): boolean {
  return x > r.x0 + by && x < r.x1 - by && z > r.z0 + by && z < r.z1 - by;
}
/** Your feet's height on the flight at z. */
export function stairHeight(o: HqOption, z: number): number {
  const s = o.stair, t = (z - s.foot) / (s.head - s.foot);
  return F * Math.min(1, Math.max(0, t));
}
export const stairLane = (o: HqOption): [number, number] => [Math.max(o.stair.x0, -W + HQ_WALK_MARGIN), o.stair.x1 - HQ_PAD];

// ── The cut-away ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A box in room space (absolute heights). */
export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
/** A rect less a hole: up to four rects. */
function less(r: Rect, h: Rect): Rect[] {
  if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) return [r];
  const out: Rect[] = [];
  if (h.x0 > r.x0) out.push({ ...r, x1: h.x0 });
  if (h.x1 < r.x1) out.push({ ...r, x0: h.x1 });
  const x0 = Math.max(r.x0, h.x0), x1 = Math.min(r.x1, h.x1);
  if (h.z0 > r.z0) out.push({ x0, x1, z0: r.z0, z1: h.z0 });
  if (h.z1 < r.z1) out.push({ x0, x1, z0: h.z1, z1: r.z1 });
  return out;
}
/**
 * What of each part of the upper floor can stand between the walking camera and you: its slab up to the rail's top
 * (the stair's well left open), and every block of its fixtures (the banners hanging off the arms over the hall).
 */
export function partBoxes(o: HqOption): Box[][] {
  const well = stairWell(o);
  return o.upper.map((r, i) => [
    ...less(r, well).map(q => ({ ...q, y0: F - HQ_SLAB, y1: F + HQ_RAIL })),
    ...o.fixtures.filter(f => f.level === 1 && (f.part ?? 0) === i).flatMap(f => f.blocks.map(k => ({
      x0: k.at[0] - k.size[0] / 2, x1: k.at[0] + k.size[0] / 2, z0: k.at[2] - k.size[2] / 2, z1: k.at[2] + k.size[2] / 2, y0: F + k.at[1], y1: F + k.at[1] + k.size[1],
    }))),
  ]);
}
/** Whether the segment (z0, y0)–(z1, y1) crosses the rect [za, zb] × [ya, yb] (Liang–Barsky). */
function crosses(z0: number, y0: number, z1: number, y1: number, za: number, zb: number, ya: number, yb: number): boolean {
  let t0 = 0, t1 = 1;
  const dz = z1 - z0, dy = y1 - y0;
  for (const [p, q] of [[-dz, z0 - za], [dz, zb - z0], [-dy, y0 - ya], [dy, yb - y0]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 <= t1;
}
/**
 * Whether any of a part's boxes (grown by `grow`) stands between the walking camera and you, feet to head: you at
 * (x, z) on a floor at height h, the camera over you and behind (HQ_CAMERA), in your x.
 */
export function hidesYou(boxes: readonly Box[], x: number, z: number, h: number, grow = 0): boolean {
  const cy = h + HQ_CAMERA.up, cz = z - HQ_CAMERA.back;
  for (const k of boxes) {
    if (x < k.x0 - grow || x > k.x1 + grow) continue;
    for (const py of [h + 0.1, h + 1.6]) if (crosses(cz, cy, z, py, k.z0 - grow, k.z1 + grow, k.y0 - grow, k.y1 + grow)) return true;
  }
  return false;
}

export type WalkZone = "ground" | "stair" | "upper";
export interface HqWalker {
  zone: WalkZone;
  height: number;
  /** Each part of the upper floor is drawn unless you're under it or it stands between the walking camera and you
   * (downstairs or on the stair): cut away then, so the camera sees you and your floor, with hysteresis so it never
   * flickers. Upstairs, all of it. */
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
  const boxes = partBoxes(o);
  /** Downstairs or on the stair, a part goes while it's overhead (so the walking camera, looking in under its edge, sees
   * the hall) or in the way; shown parts hide once they're in the way, hidden ones come back once well clear of it. */
  const show = (w: HqWalker, x: number, z: number) => {
    o.upper.forEach((r, i) => {
      const was = w.shown[i], under = w.zone === "ground" && underPart(r, x, z, was ? 0.5 : -0.25);
      w.shown[i] = w.zone === "upper" || !(under || hidesYou(boxes[i], x, z, w.height, was ? 0 : 0.35));
    });
  };
  const out: [number, number] = [0, 0];
  const w: HqWalker = {
    zone: "ground", height: 0, shown: o.upper.map(() => true),
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
      show(w, x, z);
      out[0] = x; out[1] = z;
      return out;
    },
  };
  // You come in at the door: what's overhead there starts cut away.
  show(w, HQ_SPAWN[0], HQ_SPAWN[1]);
  return w;
}

/** The plan's zone labels: where each floor's areas are (the evidence script prints them on the top-down plans). */
export const HQ_ZONES: { text: string; level: Level; at: [number, number] }[] = [
  { text: "ENTRY (under the bridge)", level: 0, at: [0, -5.2] }, { text: "HALL: THE BIG LOUNGE", level: 0, at: [0, -1.4] },
  { text: "LIBRARY + WORK (under the left arm)", level: 0, at: [9.2, -3.7] }, { text: "BOARD + STAIR (under the right arm)", level: 0, at: [-8.6, -0.6] },
  { text: "COFFEE", level: 0, at: [-4.8, -4.6] }, { text: "ADMIN DOOR (under the stair)", level: 0, at: [-8.4, 4.4] },
  { text: "BIG LOUNGE (the bridge)", level: 1, at: [-2.6, -5.5] }, { text: "OPEN TO THE HALL", level: 1, at: [0, 1.0] },
  { text: "STUDY (the left arm)", level: 1, at: [8.6, 0.2] }, { text: "RIGHT ARM", level: 1, at: [-8.2, 2.6] },
];

/**
 * The layout as the model build reads it (art/interiors/build_hq.py reads art/interiors/hq_layout.json, written by
 * scripts/hq-layout-json.mjs): every number the room's models stand on, so the models and the walking never drift.
 */
export function hqLayoutJson(): string {
  const { room, floorHeight, slab, door, rail } = { room: HQ_ROOM, floorHeight: HQ_FLOOR_HEIGHT, slab: HQ_SLAB, door: HQ_DOOR, rail: HQ_RAIL };
  return JSON.stringify({ room, floorHeight, slab, door, rail, desk: HQ_DESK, trophy: HQ_TROPHY, clock: HQ_CLOCK_AT, bench: HQ_BENCH, founder: HQ_FOUNDER, ...HQ }, null, 1) + "\n";
}
