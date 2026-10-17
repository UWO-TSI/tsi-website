/**
 * The shop's layout (specs/interiors/shop.md, row 313): one source for the room, its walking, the counter, the keeper's
 * post, the displays, the lights and the walking path. Phase 1 draws it as a greybox (ShopGreybox) for David's layout
 * review; phase 2 puts the models on the same numbers. Room space as every room's: walls at x ±halfW and z ±halfD, the
 * door in the cut-away near wall (−z), +x on screen left, the camera looking up +z.
 *
 * Two sections either side of a central aisle that runs from the door to the counter: in-game items on the left (+x,
 * herringbone oak) and real club merch on the right (−x, polished concrete). The tiled cashier counter closes the aisle
 * at the back, with the shopkeeper behind it and the linear pendant over it.
 */

/** 12 x 10, one step wider than the old 10 x 10 general store: room for two sections and an aisle with space round every table. */
export const SHOP_ROOM = { halfW: 6, halfD: 5, height: 3.5, wall: 0.3, lip: 0.9 } as const;
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

export type ShopZone = "items" | "merch" | "counter";
export type Finish = "concrete" | "metal" | "pegboard" | "tile" | "timber" | "fabric" | "crate" | "plant" | "sign";
/** A block: the centre of its base (x, y0, z) and its size (x, y, z). */
export interface ShopBlock { at: [number, number, number]; size: [number, number, number]; finish: Finish }
/** Where the walker can't go, [cx, cz, halfW, halfD]. */
export type Footprint = [number, number, number, number];
export interface ShopFixture { id: string; zone: ShopZone; label: string; blocks: ShopBlock[]; footprint?: Footprint[] }

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): ShopBlock => ({ at, size, finish });

export const SHOP_FIXTURES: ShopFixture[] = [
  // ── The counter, closing the aisle at the back (ref 2) ──
  { id: "counter", zone: "counter", label: "Cashier counter: glazed tile, timber top", footprint: [[0, 3.3, 1.6, 0.375]], blocks: [
    // Hip-high, as in ref 2: the shopkeeper shows from the chest up over it.
    b([0, 0, 3.3], [3.2, 0.68, 0.75], "tile"),
    b([0, 0.68, 3.3], [3.3, 0.06, 0.85], "timber"),
    b([-0.55, 0.74, 3.4], [0.36, 0.24, 0.3], "metal"),       // the till
  ] },
  { id: "tile-wall", zone: "counter", label: "Glazed tile wall", blocks: [b([0, 0, 4.96], [4.0, 3.5, 0.08], "tile")] },
  // The counter's two ends are closed by the crates and the plant, so nobody walks round behind it.
  { id: "crates", zone: "counter", label: "Crate stack", footprint: [[2.05, 3.9, 0.31, 0.3]], blocks: [
    b([2.05, 0, 3.9], [0.62, 0.34, 0.6], "crate"), b([2.05, 0.35, 3.9], [0.62, 0.34, 0.6], "crate"), b([2.05, 0.7, 3.9], [0.62, 0.34, 0.6], "crate"),
  ] },
  { id: "plant", zone: "counter", label: "Potted plant", footprint: [[-2.05, 3.9, 0.275, 0.275]], blocks: [
    b([-2.05, 0, 3.9], [0.45, 0.45, 0.45], "concrete"), b([-2.05, 0.45, 3.9], [0.7, 0.9, 0.7], "plant"),
  ] },

  // ── Club merch (−x, screen right; ref 1) ──
  { id: "pegboard", zone: "merch", label: "Pegboard wall", blocks: [
    b([-5.97, 0, 0.4], [0.06, 3.2, 9.2], "pegboard"),
    b([-4.05, 0, 4.97], [3.9, 3.2, 0.06], "pegboard"),
  ] },
  { id: "merch-counter", zone: "merch", label: "Long metal counter with drawers", footprint: [[-5.66, 0.475, 0.31, 3.875], [-3.925, 4.66, 1.425, 0.31]], blocks: [
    b([-5.66, 0, 0.475], [0.62, 0.85, 7.75], "metal"),
    b([-3.925, 0, 4.66], [2.85, 0.85, 0.62], "metal"),
  ] },
  { id: "merch-shelf", zone: "merch", label: "Metal shelves on the pegboard", blocks: [
    b([-5.82, 1.55, 0.6], [0.3, 0.04, 2.4], "metal"),
    b([-4.0, 1.55, 4.8], [2.8, 0.04, 0.3], "metal"),
  ] },
  { id: "merch-sign", zone: "merch", label: "Club merch sign", blocks: [b([-4.05, 2.95, 4.93], [2.6, 0.32, 0.04], "sign")] },
  { id: "merch-plinths", zone: "merch", label: "Featured drop: concrete plinths", footprint: [[-3.6, -0.1, 0.45, 0.45], [-2.75, 0.75, 0.325, 0.325]], blocks: [
    b([-3.6, 0, -0.1], [0.9, 0.75, 0.9], "concrete"),
    b([-2.75, 0, 0.75], [0.65, 0.4, 0.65], "concrete"),
  ] },

  // ── In-game items (+x, screen left) ──
  { id: "curtains", zone: "items", label: "Window, sheer curtains", blocks: [
    b([5.88, 0, -3.78], [0.1, 3.1, 0.45], "fabric"), b([5.88, 0, -2.02], [0.1, 3.1, 0.45], "fabric"),
  ] },
  { id: "seasonal-plinths", zone: "items", label: "Seasonal plinths, by the window", footprint: [[3.0, -3.15, 0.4, 0.4], [3.85, -3.35, 0.4, 0.4], [4.65, -2.95, 0.3, 0.3]], blocks: [
    b([3.0, 0, -3.15], [0.8, 0.45, 0.8], "concrete"),
    b([3.85, 0, -3.35], [0.8, 0.8, 0.8], "concrete"),
    b([4.65, 0, -2.95], [0.6, 0.3, 0.6], "concrete"),
  ] },
  { id: "rail", zone: "items", label: "Clothes rail (metal, face-out)", footprint: [[3.5, -0.9, 0.9, 0.25]], blocks: [
    b([3.5, 0, -0.9], [1.8, 0.06, 0.5], "concrete"),
    b([2.65, 0.06, -0.9], [0.05, 1.5, 0.05], "metal"), b([4.35, 0.06, -0.9], [0.05, 1.5, 0.05], "metal"),
    b([3.5, 1.52, -0.9], [1.75, 0.05, 0.05], "metal"),
  ] },
  { id: "tools-table", zone: "items", label: "Tools table (concrete)", footprint: [[3.5, 1.3, 0.9, 0.4]], blocks: [
    b([3.5, 0.62, 1.3], [1.8, 0.1, 0.8], "concrete"),
    b([2.7, 0, 1.3], [0.14, 0.62, 0.7], "concrete"), b([4.3, 0, 1.3], [0.14, 0.62, 0.7], "concrete"),
  ] },
  { id: "shelving", zone: "items", label: "Metal shelving: dyes and accessories", footprint: [[5.75, 1.15, 0.25, 1.75]], blocks: [
    ...[-0.6, 1.15, 2.9].map(z => b([5.75, 0, z], [0.5, 2.4, 0.04], "metal")),
    ...[0.35, 0.95, 1.55, 2.15].map(y => b([5.75, y, 1.15], [0.5, 0.04, 3.5], "metal")),
  ] },
  { id: "dais", zone: "items", label: "Furniture showroom dais (concrete)", footprint: [[4.25, 4.2, 1.75, 0.8]], blocks: [b([4.25, 0, 4.2], [3.5, 0.16, 1.6], "concrete")] },
];

export type ItemKind = "seasonal" | "clothes" | "accessories" | "tools" | "dyes" | "furniture"
  | "merch-wear" | "merch-bags" | "merch-small" | "merch-prints" | "merch-featured";
/** Where one displayed item sits: its fixture and the box it fills (the greybox's placeholder; phase 2's model fits it). */
export interface DisplaySlot { id: string; kind: ItemKind; fixture: string; at: [number, number, number]; size: [number, number, number] }
export const ITEM_KINDS: Record<ItemKind, { zone: "items" | "merch"; label: string }> = {
  seasonal: { zone: "items", label: "Seasonal" },
  clothes: { zone: "items", label: "Clothes" },
  accessories: { zone: "items", label: "Accessories" },
  tools: { zone: "items", label: "Tools" },
  dyes: { zone: "items", label: "Dyes" },
  furniture: { zone: "items", label: "Furniture" },
  "merch-wear": { zone: "merch", label: "Tees and hoodies" },
  "merch-bags": { zone: "merch", label: "Totes" },
  "merch-small": { zone: "merch", label: "Stickers, pins, caps" },
  "merch-prints": { zone: "merch", label: "Posters" },
  "merch-featured": { zone: "merch", label: "Featured drop" },
};

const slot = (id: string, kind: ItemKind, fixture: string, at: [number, number, number], size: [number, number, number]): DisplaySlot => ({ id, kind, fixture, at, size });
export const SHOP_SLOTS: DisplaySlot[] = [
  // In-game items
  slot("seasonal-1", "seasonal", "seasonal-plinths", [3.0, 0.45, -3.15], [0.45, 0.45, 0.45]),
  slot("seasonal-2", "seasonal", "seasonal-plinths", [3.85, 0.8, -3.35], [0.45, 0.5, 0.45]),
  slot("seasonal-3", "seasonal", "seasonal-plinths", [4.65, 0.3, -2.95], [0.35, 0.35, 0.35]),
  ...[2.95, 3.35, 3.75, 4.15].map((x, i) => slot(`clothes-${i + 1}`, "clothes", "rail", [x, 0.6, -0.9], [0.36, 0.85, 0.1])),
  slot("tools-1", "tools", "tools-table", [3.25, 0.72, 1.15], [1.1, 0.05, 0.08]),     // a rod, laid along the table
  slot("tools-2", "tools", "tools-table", [3.9, 0.72, 1.45], [0.35, 0.08, 0.5]),      // a net
  slot("tools-3", "tools", "tools-table", [2.95, 0.72, 1.5], [0.6, 0.06, 0.18]),      // a shovel
  slot("tools-4", "tools", "tools-table", [4.05, 0.72, 1.05], [0.3, 0.2, 0.25]),      // the bag upgrade
  ...[0.95, 1.55].flatMap((y, l) => [-0.25, 0.25, 0.75].map((z, i) => slot(`dyes-${l * 3 + i + 1}`, "dyes", "shelving", [5.7, y + 0.04, z], [0.18, 0.28, 0.3]))),
  ...[0.95, 1.55].flatMap((y, l) => [1.6, 2.4].map((z, i) => slot(`accessories-${l * 2 + i + 1}`, "accessories", "shelving", [5.7, y + 0.04, z], [0.3, 0.25, 0.3]))),
  slot("furniture-1", "furniture", "dais", [4.3, 0.16, 4.55], [1.6, 0.7, 0.65]),      // a sofa
  slot("furniture-2", "furniture", "dais", [5.6, 0.16, 4.6], [0.3, 1.4, 0.3]),        // a floor lamp
  slot("furniture-3", "furniture", "dais", [3.1, 0.16, 4.2], [0.55, 0.5, 0.55]),      // a chair or side table
  slot("furniture-4", "furniture", "dais", [4.2, 0.16, 3.85], [2.2, 0.02, 0.6]),      // a rug
  // Club merch
  slot("merch-wear-1", "merch-wear", "pegboard", [-5.85, 1.35, -2.7], [0.12, 0.85, 0.7]),
  slot("merch-wear-2", "merch-wear", "pegboard", [-5.85, 1.3, -1.7], [0.12, 0.95, 0.75]),
  ...[-0.2, 0.6, 1.4].map((z, i) => slot(`merch-small-${i + 1}`, "merch-small", "merch-counter", [-5.6, 0.85, z], [0.42, 0.18, 0.55])),
  slot("merch-small-4", "merch-small", "merch-counter", [-4.8, 0.85, 4.66], [0.45, 0.22, 0.4]),
  slot("merch-small-5", "merch-small", "merch-counter", [-3.4, 0.85, 4.66], [0.45, 0.22, 0.4]),
  slot("merch-bags-1", "merch-bags", "pegboard", [-5.88, 1.35, 2.6], [0.08, 0.75, 0.55]),
  slot("merch-bags-2", "merch-bags", "pegboard", [-5.88, 1.35, 3.5], [0.08, 0.75, 0.55]),
  slot("merch-prints-1", "merch-prints", "pegboard", [-5.0, 1.75, 4.91], [1.0, 1.1, 0.04]),
  slot("merch-prints-2", "merch-prints", "pegboard", [-3.5, 1.75, 4.91], [1.0, 1.1, 0.04]),
  slot("merch-featured-1", "merch-featured", "merch-plinths", [-3.6, 0.75, -0.1], [0.5, 0.9, 0.35]),
  slot("merch-featured-2", "merch-featured", "merch-plinths", [-2.75, 0.4, 0.75], [0.4, 0.3, 0.4]),
];

/** A light strip along an edge (the edge lighting), from one end to the other. */
export interface LightStrip { fixture: string; from: [number, number, number]; to: [number, number, number] }
const strip = (fixture: string, from: [number, number, number], to: [number, number, number]): LightStrip => ({ fixture, from, to });
export const SHOP_STRIPS: LightStrip[] = [
  // Under the merch counter's top lip, and under the pegboard shelves (ref 1).
  strip("merch-counter", [-5.34, 0.8, -3.4], [-5.34, 0.8, 4.35]),
  strip("merch-counter", [-5.35, 0.8, 4.34], [-2.5, 0.8, 4.34]),
  strip("merch-shelf", [-5.7, 1.53, -0.6], [-5.7, 1.53, 1.8]),
  strip("merch-shelf", [-5.4, 1.53, 4.7], [-2.6, 1.53, 4.7]),
  // Each shelf's front lip.
  ...[0.35, 0.95, 1.55, 2.15].map(y => strip("shelving", [5.49, y + 0.01, -0.6], [5.49, y + 0.01, 2.9])),
  // Round the tools table, under its top.
  strip("tools-table", [2.6, 0.6, 0.9], [4.4, 0.6, 0.9]), strip("tools-table", [2.6, 0.6, 1.7], [4.4, 0.6, 1.7]),
  strip("tools-table", [2.6, 0.6, 0.9], [2.6, 0.6, 1.7]), strip("tools-table", [4.4, 0.6, 0.9], [4.4, 0.6, 1.7]),
  // Floor glow along the dais and the plinths' fronts.
  strip("dais", [2.5, 0.05, 3.39], [6.0, 0.05, 3.39]), strip("dais", [2.49, 0.05, 3.4], [2.49, 0.05, 5.0]),
  strip("seasonal-plinths", [2.6, 0.04, -3.56], [3.4, 0.04, -3.56]),
  strip("seasonal-plinths", [3.45, 0.04, -3.76], [4.25, 0.04, -3.76]),
  strip("seasonal-plinths", [4.35, 0.04, -3.26], [4.95, 0.04, -3.26]),
  strip("merch-plinths", [-4.05, 0.04, -0.56], [-3.15, 0.04, -0.56]),
  strip("merch-plinths", [-3.075, 0.04, 0.42], [-2.425, 0.04, 0.42]),
];
/** The linear pendant over the counter (ref 2): a bar from x0 to x1 at height y, hung on two wires from the ceiling. */
export const SHOP_PENDANT = { x0: -1.5, x1: 1.5, y: 2.7, z: 3.3, wires: [-1.3, 1.3] } as const;

/** The floors: herringbone oak under the aisle, the counter and the items; polished concrete under the merch. */
export const SHOP_FLOORS = [
  { id: "oak", label: "Herringbone oak", x0: -1.6, x1: 6, z0: -5, z1: 5 },
  { id: "concrete", label: "Polished concrete", x0: -6, x1: -1.6, z0: -5, z1: 5 },
] as const;
/** The window in the +x wall (behind the seasonal plinths), z0..z1 along it, sill to head. */
export const SHOP_WINDOW = { x: 6, z0: -4.0, z1: -1.8, y0: 0.9, y1: 2.8 } as const;

/** The walking path: the aisle from the door to the counter, and a loop through each section. */
export const SHOP_PATHS: { id: string; label: string; points: [number, number][] }[] = [
  { id: "aisle", label: "Aisle: door to counter", points: [[0, -4.2], [0, 2.3]] },
  { id: "items-loop", label: "Items loop", points: [[0.9, -1.9], [5.0, -1.9], [5.0, 2.55], [0.9, 2.55]] },
  { id: "items-cross", label: "Between the rail and the table", points: [[0.9, 0.15], [5.0, 0.15]] },
  { id: "merch-loop", label: "Merch loop", points: [[-0.9, -1.9], [-4.85, -1.9], [-4.85, 3.85], [-2.75, 3.85], [-2.75, 2.2], [-0.9, 2.2]] },
];

export const SHOP_SOLIDS: Footprint[] = SHOP_FIXTURES.flatMap(f => f.footprint ?? []);

/** Whether a footprint covers (x, z), grown by `pad`. */
export function shopSolidAt(x: number, z: number, pad = SHOP_PAD): boolean {
  for (const [cx, cz, w, d] of SHOP_SOLIDS) if (Math.abs(x - cx) < w + pad && Math.abs(z - cz) < d + pad) return true;
  return false;
}

/** Where you can stand: inside the walker's bounds and clear of everything solid. */
export function shopWalkable(x: number, z: number, pad = SHOP_PAD): boolean {
  const mx = SHOP_ROOM.halfW - SHOP_WALK_MARGIN, mz = SHOP_ROOM.halfD - SHOP_WALK_MARGIN;
  return Math.abs(x) <= mx + 1e-9 && Math.abs(z) <= mz + 1e-9 && !shopSolidAt(x, z, pad);
}

/** The walker reads the answer at once: one tuple reused, nothing allocated per step. */
const OUT: [number, number] = [0, 0];
/** The shop's furniture collision (the walker clamps to the walls first): slides along whatever it meets. */
export function constrainShop(x: number, z: number, nx: number, nz: number): [number, number] {
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.15));
  const dx = (nx - x) / steps, dz = (nz - z) / steps;
  for (let i = 0; i < steps; i++) {
    if (!shopSolidAt(x + dx, z + dz)) { x += dx; z += dz; }
    else if (!shopSolidAt(x + dx, z)) x += dx;
    else if (!shopSolidAt(x, z + dz)) z += dz;
    else break;
  }
  OUT[0] = x; OUT[1] = z;
  return OUT;
}
