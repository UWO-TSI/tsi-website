/**
 * The shop's layout (specs/interiors/shop.md, row 313): one source for the room, its walking, the counter, the keeper's
 * post, the displays, the lights and the walking path. Phase 1 draws it as a greybox (ShopGreybox) for David's layout
 * review; phase 2 puts the models on the same numbers. Room space as every room's: walls at x ±halfW and z ±halfD, the
 * door in the cut-away near wall (−z), +x on screen left, the camera looking up +z.
 *
 * Two floors (David, 2026-10-17: "real merch is upstairs and in game merch is down stairs"). The ground floor, on
 * herringbone oak, holds the in-game items and the tiled cashier counter with the shopkeeper behind it, at the end of
 * an aisle from the door. A stair climbs the right wall (−x) away from the door to the upper floor, on polished
 * concrete, which holds the club merch round the pegboard wall. While you're downstairs the upper floor is cut away,
 * so the camera sees the floor you're on; it shows as you climb (createShopWalker).
 */

/** 12 x 10 on both floors. */
export const SHOP_ROOM = { halfW: 6, halfD: 5, wall: 0.3, lip: 0.9 } as const;
/** Floor to floor: the upper floor's level. Each floor's walls stand this high; the slab between is SHOP_SLAB thick. */
export const SHOP_FLOOR_HEIGHT = 3.2;
export const SHOP_SLAB = 0.2;
export type Level = 0 | 1;
/** The doorway in the near wall (its centre x and half its width). */
export const SHOP_DOOR = { x: 0, half: 0.95 } as const;
/** Where you arrive: a step in from the door, outside the exit prompt. */
export const SHOP_SPAWN: [number, number] = [0, -3.2];
export const SHOP_EXIT: [number, number] = [0, -4.4];
export const SHOP_EXIT_RANGE = 1.1;
/** Where you stand to talk to the shopkeeper across the counter. */
export const SHOP_COUNTER_SPOT: [number, number] = [0, 2.3];
export const SHOP_COUNTER_RANGE = 1.8;
/** The walker keeps this far off the walls (interiorShared WALK_MARGIN) and this far off anything solid. */
export const SHOP_WALK_MARGIN = 0.8;
export const SHOP_PAD = 0.25;
/** Phase 2's item tag shows within this distance of a displayed item. */
export const SHOP_TAG_RANGE = 1.6;

/**
 * The stair: a straight flight up the right wall, from its first step at z0 to the upper floor at z1, `steps` risers
 * of SHOP_FLOOR_HEIGHT / steps. The upper floor is open over the whole flight (the stairwell), railed round.
 */
export const SHOP_STAIR = { x0: -6, x1: -4.2, z0: -3.0, z1: 1.8, steps: 16 } as const;
/** Where you walk on it: off the wall by the walk margin, and clear of its railing. */
export const STAIR_LANE: [number, number] = [-SHOP_ROOM.halfW + SHOP_WALK_MARGIN, SHOP_STAIR.x1 - SHOP_PAD];

export type ShopZone = "items" | "merch" | "counter" | "stair";
export type Finish = "concrete" | "metal" | "pegboard" | "tile" | "timber" | "fabric" | "crate" | "plant" | "sign" | "glass";
/** A block: the centre of its base (x, y0 above its floor, z) and its size (x, y, z). */
export interface ShopBlock { at: [number, number, number]; size: [number, number, number]; finish: Finish }
/** Where the walker can't go, [cx, cz, halfW, halfD]. */
export type Footprint = [number, number, number, number];
export interface ShopFixture { id: string; level: Level; zone: ShopZone; label: string; blocks: ShopBlock[]; footprint?: Footprint[] }

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): ShopBlock => ({ at, size, finish });
const S = SHOP_STAIR, F = SHOP_FLOOR_HEIGHT, RUN = (S.z1 - S.z0) / S.steps, RISE = F / S.steps;

export const SHOP_FIXTURES: ShopFixture[] = [
  // ════ Ground floor: in-game items and the counter ════
  // The counter closes the aisle at the back (ref 2). Hip-high: the shopkeeper shows from the chest up over it.
  { id: "counter", level: 0, zone: "counter", label: "Cashier counter: glazed tile, timber top", footprint: [[0, 3.3, 1.6, 0.375]], blocks: [
    b([0, 0, 3.3], [3.2, 0.68, 0.75], "tile"),
    b([0, 0.68, 3.3], [3.3, 0.06, 0.85], "timber"),
    b([-0.55, 0.74, 3.4], [0.36, 0.24, 0.3], "metal"),       // the till
  ] },
  { id: "tile-wall", level: 0, zone: "counter", label: "Glazed tile wall", blocks: [b([0, 0, 4.96], [4.0, F - SHOP_SLAB, 0.08], "tile")] },
  // The counter's two ends are closed by the crates and the plant, so nobody walks round behind it.
  { id: "crates", level: 0, zone: "counter", label: "Crate stack", footprint: [[2.05, 3.9, 0.31, 0.3]], blocks: [
    b([2.05, 0, 3.9], [0.62, 0.34, 0.6], "crate"), b([2.05, 0.35, 3.9], [0.62, 0.34, 0.6], "crate"), b([2.05, 0.7, 3.9], [0.62, 0.34, 0.6], "crate"),
  ] },
  { id: "plant", level: 0, zone: "counter", label: "Potted plant", footprint: [[-2.05, 3.9, 0.275, 0.275]], blocks: [
    b([-2.05, 0, 3.9], [0.45, 0.45, 0.45], "concrete"), b([-2.05, 0.45, 3.9], [0.7, 0.9, 0.7], "plant"),
  ] },
  { id: "curtains", level: 0, zone: "items", label: "Window, sheer curtains", blocks: [
    b([5.88, 0, -3.78], [0.1, 2.9, 0.45], "fabric"), b([5.88, 0, -2.02], [0.1, 2.9, 0.45], "fabric"),
  ] },
  { id: "seasonal-plinths", level: 0, zone: "items", label: "Seasonal plinths, by the window", footprint: [[3.0, -3.15, 0.4, 0.4], [3.85, -3.35, 0.4, 0.4], [4.65, -2.95, 0.3, 0.3]], blocks: [
    b([3.0, 0, -3.15], [0.8, 0.45, 0.8], "concrete"),
    b([3.85, 0, -3.35], [0.8, 0.8, 0.8], "concrete"),
    b([4.65, 0, -2.95], [0.6, 0.3, 0.6], "concrete"),
  ] },
  { id: "tools-table", level: 0, zone: "items", label: "Tools table (concrete)", footprint: [[3.5, 0.6, 0.9, 0.4]], blocks: [
    b([3.5, 0.62, 0.6], [1.8, 0.1, 0.8], "concrete"),
    b([2.7, 0, 0.6], [0.14, 0.62, 0.7], "concrete"), b([4.3, 0, 0.6], [0.14, 0.62, 0.7], "concrete"),
  ] },
  { id: "shelving", level: 0, zone: "items", label: "Metal shelving: dyes and accessories", footprint: [[5.75, 1.15, 0.25, 1.75]], blocks: [
    ...[-0.6, 1.15, 2.9].map(z => b([5.75, 0, z], [0.5, 2.4, 0.04], "metal")),
    ...[0.35, 0.95, 1.55, 2.15].map(y => b([5.75, y, 1.15], [0.5, 0.04, 3.5], "metal")),
  ] },
  { id: "dais", level: 0, zone: "items", label: "Furniture showroom dais (concrete)", footprint: [[4.25, 4.2, 1.75, 0.8]], blocks: [b([4.25, 0, 4.2], [3.5, 0.16, 1.6], "concrete")] },
  { id: "rail", level: 0, zone: "items", label: "Clothes rail (metal, face-out)", footprint: [[-2.6, -0.2, 0.7, 0.25]], blocks: [
    b([-2.6, 0, -0.2], [1.4, 0.06, 0.5], "concrete"),
    b([-3.25, 0.06, -0.2], [0.05, 1.5, 0.05], "metal"), b([-1.95, 0.06, -0.2], [0.05, 1.5, 0.05], "metal"),
    b([-2.6, 1.52, -0.2], [1.35, 0.05, 0.05], "metal"),
  ] },
  { id: "finishes", level: 0, zone: "items", label: "Wallpaper and flooring samples", footprint: [[-4.1, 4.25, 1.2, 0.35]], blocks: [
    b([-4.1, 0, 4.25], [2.4, 0.08, 0.7], "concrete"),
  ] },
  { id: "upstairs-sign", level: 0, zone: "stair", label: "\"Club merch upstairs\" sign", footprint: [[-3.6, -2.5, 0.25, 0.12]], blocks: [b([-3.6, 0, -2.5], [0.5, 1.3, 0.24], "sign")] },
  // The stair, solid concrete steps up the right wall, with a railing on its open side.
  { id: "stair", level: 0, zone: "stair", label: "Stair to the merch floor", blocks: [
    ...Array.from({ length: S.steps }, (_, i) => b([(S.x0 + S.x1) / 2, 0, S.z0 + (i + 0.5) * RUN], [S.x1 - S.x0, (i + 1) * RISE, RUN], "concrete")),
    ...[0.5, 7.5, 15.5].map(i => b([S.x1 - 0.04, ((i + 0.5) * RISE), S.z0 + i * RUN], [0.04, 0.95, 0.04], "metal")),
  ] },

  // ════ Upper floor: club merch (ref 1) ════
  { id: "stairwell-rail", level: 1, zone: "stair", label: "Railing round the stairwell", blocks: [
    b([S.x1 + 0.02, 0, (S.z0 + S.z1) / 2], [0.04, 1.0, S.z1 - S.z0], "glass"),
    b([(S.x0 + S.x1) / 2, 0, S.z0 - 0.02], [S.x1 - S.x0, 1.0, 0.04], "glass"),
  ] },
  { id: "pegboard", level: 1, zone: "merch", label: "Pegboard wall, round the back corner", blocks: [
    b([1.3, 0, 4.97], [9.4, 3.0, 0.06], "pegboard"),
    b([5.97, 0, 2.0], [0.06, 3.0, 6.0], "pegboard"),
  ] },
  { id: "merch-counter", level: 1, zone: "merch", label: "Long metal counter with drawers", footprint: [[1.175, 4.66, 4.175, 0.31], [5.66, 2.185, 0.31, 2.785]], blocks: [
    b([1.175, 0, 4.66], [8.35, 0.85, 0.62], "metal"),
    b([5.66, 0, 2.185], [0.62, 0.85, 5.57], "metal"),
  ] },
  { id: "merch-shelf", level: 1, zone: "merch", label: "Metal shelf on the pegboard", blocks: [b([0.4, 1.55, 4.8], [2.6, 0.04, 0.3], "metal")] },
  { id: "merch-sign", level: 1, zone: "merch", label: "Club merch sign", blocks: [b([0.4, 2.62, 4.93], [2.6, 0.32, 0.04], "sign")] },
  { id: "merch-plinths", level: 1, zone: "merch", label: "Featured drop: concrete plinths", footprint: [[0.4, 0.2, 0.45, 0.45], [1.25, 1.05, 0.325, 0.325]], blocks: [
    b([0.4, 0, 0.2], [0.9, 0.75, 0.9], "concrete"),
    b([1.25, 0, 1.05], [0.65, 0.4, 0.65], "concrete"),
  ] },
];

export type ItemKind = "seasonal" | "clothes" | "accessories" | "tools" | "dyes" | "furniture" | "finishes"
  | "merch-wear" | "merch-bags" | "merch-small" | "merch-prints" | "merch-featured";
/** Where one displayed item sits: its floor, its fixture and the box it fills (the greybox's placeholder; phase 2's model fits it). */
export interface DisplaySlot { id: string; kind: ItemKind; level: Level; fixture: string; at: [number, number, number]; size: [number, number, number] }
export const ITEM_KINDS: Record<ItemKind, { level: Level; label: string }> = {
  seasonal: { level: 0, label: "Seasonal" },
  clothes: { level: 0, label: "Clothes" },
  accessories: { level: 0, label: "Accessories" },
  tools: { level: 0, label: "Tools" },
  dyes: { level: 0, label: "Dyes" },
  furniture: { level: 0, label: "Furniture" },
  finishes: { level: 0, label: "Wallpaper, flooring" },
  "merch-wear": { level: 1, label: "Tees and hoodies" },
  "merch-bags": { level: 1, label: "Totes" },
  "merch-small": { level: 1, label: "Stickers, pins, caps" },
  "merch-prints": { level: 1, label: "Posters" },
  "merch-featured": { level: 1, label: "Featured drop" },
};

const slot = (id: string, kind: ItemKind, fixture: string, at: [number, number, number], size: [number, number, number]): DisplaySlot =>
  ({ id, kind, level: ITEM_KINDS[kind].level, fixture, at, size });
export const SHOP_SLOTS: DisplaySlot[] = [
  // Ground floor: in-game items
  slot("seasonal-1", "seasonal", "seasonal-plinths", [3.0, 0.45, -3.15], [0.45, 0.45, 0.45]),
  slot("seasonal-2", "seasonal", "seasonal-plinths", [3.85, 0.8, -3.35], [0.45, 0.5, 0.45]),
  slot("seasonal-3", "seasonal", "seasonal-plinths", [4.65, 0.3, -2.95], [0.35, 0.35, 0.35]),
  ...[-3.0, -2.6, -2.2].map((x, i) => slot(`clothes-${i + 1}`, "clothes", "rail", [x, 0.6, -0.2], [0.36, 0.85, 0.1])),
  slot("tools-1", "tools", "tools-table", [3.25, 0.72, 0.45], [1.1, 0.05, 0.08]),     // a rod, laid along the table
  slot("tools-2", "tools", "tools-table", [3.9, 0.72, 0.75], [0.35, 0.08, 0.5]),      // a net
  slot("tools-3", "tools", "tools-table", [2.95, 0.72, 0.8], [0.6, 0.06, 0.18]),      // a shovel
  slot("tools-4", "tools", "tools-table", [4.05, 0.72, 0.35], [0.3, 0.2, 0.25]),      // the bag upgrade
  ...[0.95, 1.55].flatMap((y, l) => [-0.25, 0.25, 0.75].map((z, i) => slot(`dyes-${l * 3 + i + 1}`, "dyes", "shelving", [5.7, y + 0.04, z], [0.18, 0.28, 0.3]))),
  ...[0.95, 1.55].flatMap((y, l) => [1.6, 2.4].map((z, i) => slot(`accessories-${l * 2 + i + 1}`, "accessories", "shelving", [5.7, y + 0.04, z], [0.3, 0.25, 0.3]))),
  slot("furniture-1", "furniture", "dais", [4.3, 0.16, 4.55], [1.6, 0.7, 0.65]),      // a sofa
  slot("furniture-2", "furniture", "dais", [5.6, 0.16, 4.6], [0.3, 1.4, 0.3]),        // a floor lamp
  slot("furniture-3", "furniture", "dais", [3.1, 0.16, 4.2], [0.55, 0.5, 0.55]),      // a chair or side table
  slot("furniture-4", "furniture", "dais", [4.2, 0.16, 3.85], [2.2, 0.02, 0.6]),      // a rug
  ...[-5.25, -4.5, -3.75, -3.0].map((x, i) => slot(`wallpaper-${i + 1}`, "finishes", "finishes", [x, 0.6, 4.93], [0.6, 1.6, 0.04])),
  ...[-4.9, -4.1, -3.3].map((x, i) => slot(`flooring-${i + 1}`, "finishes", "finishes", [x, 0.08, 4.25], [0.6, 0.02, 0.5])),
  // Upper floor: club merch
  ...[2.5, 3.5, 4.5].map((x, i) => slot(`merch-wear-${i + 1}`, "merch-wear", "pegboard", [x, 1.2, 4.88], [0.75, 0.9, 0.12])),
  ...[0.4, 1.4].map((z, i) => slot(`merch-wear-${i + 4}`, "merch-wear", "pegboard", [5.88, 1.3, z], [0.12, 0.95, 0.75])),
  ...[2.6, 3.4].map((z, i) => slot(`merch-wear-${i + 6}`, "merch-wear", "merch-counter", [5.62, 0.85, z], [0.42, 0.2, 0.5])),   // folded
  slot("merch-bags-1", "merch-bags", "pegboard", [-2.6, 1.3, 4.9], [0.55, 0.75, 0.08]),
  slot("merch-bags-2", "merch-bags", "pegboard", [-1.8, 1.3, 4.9], [0.55, 0.75, 0.08]),
  ...[-0.2, 0.6, 1.4].map((x, i) => slot(`merch-small-${i + 1}`, "merch-small", "merch-counter", [x, 0.85, 4.62], [0.55, 0.18, 0.42])),
  slot("merch-small-4", "merch-small", "merch-counter", [2.9, 0.85, 4.62], [0.45, 0.22, 0.4]),
  slot("merch-small-5", "merch-small", "merch-counter", [4.1, 0.85, 4.62], [0.45, 0.22, 0.4]),
  slot("merch-prints-1", "merch-prints", "pegboard", [-0.25, 1.72, 4.91], [1.0, 0.85, 0.04]),
  slot("merch-prints-2", "merch-prints", "pegboard", [1.05, 1.72, 4.91], [1.0, 0.85, 0.04]),
  slot("merch-featured-1", "merch-featured", "merch-plinths", [0.4, 0.75, 0.2], [0.5, 0.9, 0.35]),
  slot("merch-featured-2", "merch-featured", "merch-plinths", [1.25, 0.4, 1.05], [0.4, 0.3, 0.4]),
];

/** A light strip along an edge (the edge lighting), on a floor, from one end to the other. */
export interface LightStrip { level: Level; fixture: string; from: [number, number, number]; to: [number, number, number] }
const strip = (level: Level, fixture: string, from: [number, number, number], to: [number, number, number]): LightStrip => ({ level, fixture, from, to });
export const SHOP_STRIPS: LightStrip[] = [
  // Ground: each shelf's front lip, round the tools table under its top, floor glow along the dais and the plinths.
  ...[0.35, 0.95, 1.55, 2.15].map(y => strip(0, "shelving", [5.49, y + 0.01, -0.6], [5.49, y + 0.01, 2.9])),
  strip(0, "tools-table", [2.6, 0.6, 0.2], [4.4, 0.6, 0.2]), strip(0, "tools-table", [2.6, 0.6, 1.0], [4.4, 0.6, 1.0]),
  strip(0, "tools-table", [2.6, 0.6, 0.2], [2.6, 0.6, 1.0]), strip(0, "tools-table", [4.4, 0.6, 0.2], [4.4, 0.6, 1.0]),
  strip(0, "dais", [2.5, 0.05, 3.39], [6.0, 0.05, 3.39]), strip(0, "dais", [2.49, 0.05, 3.4], [2.49, 0.05, 5.0]),
  strip(0, "seasonal-plinths", [2.6, 0.04, -3.56], [3.4, 0.04, -3.56]),
  strip(0, "seasonal-plinths", [3.45, 0.04, -3.76], [4.25, 0.04, -3.76]),
  strip(0, "seasonal-plinths", [4.35, 0.04, -3.26], [4.95, 0.04, -3.26]),
  strip(0, "finishes", [-5.3, 0.05, 3.89], [-2.9, 0.05, 3.89]),
  // Upper: under the merch counter's top lip and the pegboard shelf (ref 1), floor glow along the plinths.
  strip(1, "merch-counter", [-3.0, 0.8, 4.34], [5.35, 0.8, 4.34]),
  strip(1, "merch-counter", [5.34, 0.8, -0.6], [5.34, 0.8, 4.34]),
  strip(1, "merch-shelf", [-0.9, 1.53, 4.7], [1.7, 1.53, 4.7]),
  strip(1, "merch-plinths", [-0.05, 0.04, -0.26], [0.85, 0.04, -0.26]),
  strip(1, "merch-plinths", [0.925, 0.04, 0.715], [1.575, 0.04, 0.715]),
];
/** The linear pendant over the counter (ref 2): a bar from x0 to x1 at height y, hung on two wires from the ceiling. */
export const SHOP_PENDANT = { x0: -1.5, x1: 1.5, y: 2.6, z: 3.3, wires: [-1.3, 1.3] } as const;

/** The floors: herringbone oak downstairs, polished concrete up. */
export const SHOP_FLOORS = [
  { level: 0, id: "oak", label: "Herringbone oak" },
  { level: 1, id: "concrete", label: "Polished concrete" },
] as const;
/** The windows in the +x wall, one a floor (the ground floor's behind the seasonal plinths): z0..z1 along it, sill to head above the floor. */
export const SHOP_WINDOWS = [
  { level: 0, x: 6, z0: -4.0, z1: -1.8, y0: 0.9, y1: 2.8 },
  { level: 1, x: 6, z0: -4.0, z1: -1.8, y0: 0.8, y1: 2.4 },
] as const;

/** The walking path: the aisle, the way to the stair and up it, and a loop through each part of each floor. */
export const SHOP_PATHS: { id: string; level: Level | "stair"; label: string; points: [number, number][] }[] = [
  { id: "aisle", level: 0, label: "Aisle: door to counter", points: [[0, -4.2], [0, 2.3]] },
  { id: "to-stair", level: 0, label: "To the stair", points: [[0, -3.6], [-4.85, -3.6], [-4.85, -3.05]] },
  { id: "stair", level: "stair", label: "Up the stair", points: [[-4.85, S.z0], [-4.85, S.z1]] },
  { id: "items-loop", level: 0, label: "Items loop", points: [[0.9, -1.9], [5.0, -1.9], [5.0, 2.55], [0.9, 2.55]] },
  { id: "items-cross", level: 0, label: "Past the tools table", points: [[0.9, -0.6], [5.0, -0.6]] },
  { id: "right-loop", level: 0, label: "Round the clothes rail", points: [[-0.9, -1.2], [-3.75, -1.2], [-3.75, 2.5], [-0.9, 2.5]] },
  { id: "finishes", level: 0, label: "To the samples", points: [[-3.75, 2.5], [-5.0, 2.5], [-5.0, 3.4]] },
  { id: "merch-loop", level: 1, label: "Merch loop", points: [[-4.85, 2.3], [-4.85, 3.7], [4.85, 3.7], [4.85, -1.4], [-3.7, -1.4], [-3.7, 2.3], [-4.85, 2.3]] },
];

export const SHOP_SOLIDS: Record<Level, Footprint[]> = {
  0: SHOP_FIXTURES.filter(f => f.level === 0).flatMap(f => f.footprint ?? []),
  1: SHOP_FIXTURES.filter(f => f.level === 1).flatMap(f => f.footprint ?? []),
};

/** Whether a footprint on a floor covers (x, z), grown by `pad`. */
export function shopSolidAt(level: Level, x: number, z: number, pad = SHOP_PAD): boolean {
  for (const [cx, cz, w, d] of SHOP_SOLIDS[level]) if (Math.abs(x - cx) < w + pad && Math.abs(z - cz) < d + pad) return true;
  return false;
}
/** The stair, from a floor: downstairs its flight (you can't walk under or beside it), upstairs the open stairwell. */
export function stairBlocks(level: Level, x: number, z: number, pad = SHOP_PAD): boolean {
  return x < S.x1 + pad && (level === 0 ? z > S.z0 && z < S.z1 + pad : z > S.z0 - pad && z < S.z1);
}
/** Where you can stand on a floor: inside the walker's bounds, clear of everything solid and of the stair. */
export function shopWalkable(level: Level, x: number, z: number, pad = SHOP_PAD): boolean {
  const mx = SHOP_ROOM.halfW - SHOP_WALK_MARGIN, mz = SHOP_ROOM.halfD - SHOP_WALK_MARGIN;
  return Math.abs(x) <= mx + 1e-9 && Math.abs(z) <= mz + 1e-9 && !shopSolidAt(level, x, z, pad) && !stairBlocks(level, x, z, pad);
}
/** Your feet's height on the flight at z. */
export const stairHeight = (z: number) => F * Math.min(1, Math.max(0, (z - S.z0) / (S.z1 - S.z0)));

export type WalkZone = "ground" | "stair" | "upper";
/** The walker's state in the shop: which floor (or the stair) you're on, your height, and whether the upper floor shows. */
export interface ShopWalker {
  zone: WalkZone;
  height: number;
  /** The upper floor is drawn: on it, or high enough up the stair (with a little hysteresis, so it never flickers). */
  upperShown: boolean;
  /** The walker's constrainMove: one step from (x, z) toward (nx, nz), sliding along what it meets, up and down the stair. */
  constrain(x: number, z: number, nx: number, nz: number): [number, number];
}

const inLane = (x: number) => x >= STAIR_LANE[0] - 1e-9 && x <= STAIR_LANE[1] + 1e-9;
const clampLane = (x: number) => Math.min(STAIR_LANE[1], Math.max(STAIR_LANE[0], x));

export function createShopWalker(): ShopWalker {
  const out: [number, number] = [0, 0];
  const w: ShopWalker = {
    zone: "ground", height: 0, upperShown: false,
    constrain(x, z, nx, nz) {
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.1));
      const dx = (nx - x) / steps, dz = (nz - z) / steps;
      for (let i = 0; i < steps; i++) {
        const tx = x + dx, tz = z + dz;
        if (w.zone === "stair") {
          const lx = clampLane(tx);
          if (tz <= S.z0) { if (shopWalkable(0, lx, tz)) { w.zone = "ground"; x = lx; z = tz; } else break; }
          else if (tz >= S.z1) { if (shopWalkable(1, lx, tz)) { w.zone = "upper"; x = lx; z = tz; } else break; }
          else { x = lx; z = tz; }
          continue;
        }
        const level: Level = w.zone === "ground" ? 0 : 1;
        // Onto the flight: from the floor at its foot going up, or from the landing at its head going down.
        const onto = level === 0 ? z <= S.z0 && tz > S.z0 : z >= S.z1 && tz < S.z1;
        if (onto && inLane(tx)) { w.zone = "stair"; x = tx; z = tz; continue; }
        if (shopWalkable(level, tx, tz)) { x = tx; z = tz; }
        else if (shopWalkable(level, tx, z)) x = tx;
        else if (shopWalkable(level, x, tz)) z = tz;
        else break;
      }
      w.height = w.zone === "ground" ? 0 : w.zone === "upper" ? F : stairHeight(z);
      w.upperShown = w.zone === "upper" || (w.zone === "stair" && (w.upperShown ? w.height > F * 0.4 : w.height > F * 0.6));
      out[0] = x; out[1] = z;
      return out;
    },
  };
  return w;
}
