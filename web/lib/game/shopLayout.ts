/**
 * The shop's layout (specs/interiors/shop.md, row 313): one source for the room, its walking, the counter, the keeper's
 * post, the displays, the lights and the walking path. Phase 1 draws it as a greybox (ShopGreybox) for David's layout
 * review; phase 2 puts the models on the same numbers. Room space as every room's: walls at x ±halfW and z ±halfD, the
 * door in the cut-away near wall (−z), +x on screen left, the camera looking up +z.
 *
 * Two floors (David, 2026-10-17: "real merch is upstairs and in game merch is down stairs"). The ground floor, on
 * herringbone oak, holds the in-game items, a changing room by the clothes and the tiled cashier counter with the shopkeeper behind
 * it, at the end of an aisle from the door. A stair climbs the right wall (−x) away from the door to a mezzanine over
 * the back of the room, on polished concrete, which holds the club merch round the pegboard wall and overlooks the
 * entrance. From the door you see the merch level; walk in under it and it's cut away, so the camera sees the counter
 * and the floor you're on (createShopWalker).
 */

/** 12 x 10 downstairs; the mezzanine is the back 12 x 6. */
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
export const SHOP_TAG_RANGE = 1.7;

/**
 * The stair: a straight flight up the right wall, from its first step at z0 to the upper floor at z1, `steps` risers
 * of SHOP_FLOOR_HEIGHT / steps. The upper floor is open over the whole flight (the stairwell), railed round.
 */
export const SHOP_STAIR = { x0: -6, x1: -4.2, z0: -3.0, z1: 1.8, steps: 16 } as const;
/** Where you walk on it: off the wall by the walk margin, and clear of its railing. */
export const STAIR_LANE: [number, number] = [-SHOP_ROOM.halfW + SHOP_WALK_MARGIN, SHOP_STAIR.x1 - SHOP_PAD];
/**
 * The mezzanine: the upper floor over the back of the room, from its railed front edge at z0 to the back wall, open
 * over the stair. `edge`: how far off the railing you walk. Downstairs it shows while you're out front (z under
 * `showBelow`) and is cut away once you go under it (z over `hideAbove`); between the two it stays as it was.
 */
export const SHOP_MEZZ = { z0: -1, edge: 0.35, showBelow: -1.9, hideAbove: -1.5 } as const;

export type ShopZone = "items" | "merch" | "counter" | "stair";
export type Finish = "concrete" | "metal" | "pegboard" | "tile" | "timber" | "fabric" | "crate" | "plant" | "sign" | "glass";
/** A block: the centre of its base (x, y0 above its floor, z) and its size (x, y, z). */
export interface ShopBlock { at: [number, number, number]; size: [number, number, number]; finish: Finish }
/** Where the walker can't go, [cx, cz, halfW, halfD]. */
export type Footprint = [number, number, number, number];
export interface ShopFixture { id: string; level: Level; zone: ShopZone; label: string; blocks: ShopBlock[]; footprint?: Footprint[] }

const b = (at: [number, number, number], size: [number, number, number], finish: Finish): ShopBlock => ({ at, size, finish });
const S = SHOP_STAIR, F = SHOP_FLOOR_HEIGHT, RUN = (S.z1 - S.z0) / S.steps, RISE = F / S.steps, M = SHOP_MEZZ;
/**
 * The changing rooms (David, 2026-10-17: "right behind the staircase... fill with 2-3 room change room"): `count`
 * booths side by side along the back wall in the corner behind the stair, from x0 to x1, z0 (their curtains, facing the
 * door and the walking camera) to the wall at z1, `height` tall. You stand `spotZ` in front of one to use it (the
 * village fitting room's behaviour: E, the curtain sweeps, the wardrobe opens); each has a curtain, a mirror and a bench.
 */
export const SHOP_BOOTHS = { x0: -6, x1: -2.6, z0: 3.8, z1: 5, count: 3, height: 2.2, spotZ: 3.25, range: 0.75 } as const;
const BW = (SHOP_BOOTHS.x1 - SHOP_BOOTHS.x0) / SHOP_BOOTHS.count, BD = SHOP_BOOTHS.z1 - SHOP_BOOTHS.z0, BH = SHOP_BOOTHS.height;
/** Each booth: its centre (x, z) and where you stand to use it (in front of its curtain, inside the walker's bounds). */
export const SHOP_BOOTH_LIST = Array.from({ length: SHOP_BOOTHS.count }, (_, i) => {
  const x = SHOP_BOOTHS.x0 + BW * (i + 0.5);
  return { id: `fitting-${i + 1}`, at: [x, (SHOP_BOOTHS.z0 + SHOP_BOOTHS.z1) / 2] as [number, number], spot: [Math.max(x, -SHOP_ROOM.halfW + SHOP_WALK_MARGIN), SHOP_BOOTHS.spotZ] as [number, number] };
});

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
  { id: "dais", level: 0, zone: "items", label: "Furniture showroom dais (concrete)", footprint: [[4.25, 4.3, 1.75, 0.7]], blocks: [b([4.25, 0, 4.3], [3.5, 0.16, 1.4], "concrete")] },
  { id: "rail", level: 0, zone: "items", label: "Clothes rail (metal, face-out)", footprint: [[-2.6, -0.2, 0.7, 0.25]], blocks: [
    b([-2.6, 0, -0.2], [1.4, 0.06, 0.5], "concrete"),
    b([-3.25, 0.06, -0.2], [0.05, 1.5, 0.05], "metal"), b([-1.95, 0.06, -0.2], [0.05, 1.5, 0.05], "metal"),
    b([-2.6, 1.52, -0.2], [1.35, 0.05, 0.05], "metal"),
  ] },
  // Where the changing room first stood, beside the rail: folded clothes on a low concrete table.
  { id: "clothes-table", level: 0, zone: "items", label: "Folded clothes table (concrete)", footprint: [[-2.9, 1.5, 0.8, 0.35]], blocks: [
    b([-2.9, 0.5, 1.5], [1.6, 0.1, 0.7], "concrete"),
    b([-3.6, 0, 1.5], [0.12, 0.5, 0.6], "concrete"), b([-2.2, 0, 1.5], [0.12, 0.5, 0.6], "concrete"),
  ] },
  { id: "upstairs-sign", level: 0, zone: "stair", label: "\"Club merch upstairs\" sign", footprint: [[-3.6, -2.5, 0.25, 0.12]], blocks: [b([-3.6, 0, -2.5], [0.5, 1.3, 0.24], "sign")] },
  // The stair, solid concrete steps up the right wall, with a railing on its open side.
  { id: "stair", level: 0, zone: "stair", label: "Stair to the merch floor", blocks: [
    ...Array.from({ length: S.steps }, (_, i) => b([(S.x0 + S.x1) / 2, 0, S.z0 + (i + 0.5) * RUN], [S.x1 - S.x0, (i + 1) * RISE, RUN], "concrete")),
    ...[0.5, 7.5, 15.5].map(i => b([S.x1 - 0.04, ((i + 0.5) * RISE), S.z0 + i * RUN], [0.04, 0.95, 0.04], "metal")),
  ] },

  { id: "changing-rooms", level: 0, zone: "items", label: "Changing rooms, behind the stair",
    footprint: [[(SHOP_BOOTHS.x0 + SHOP_BOOTHS.x1) / 2, (SHOP_BOOTHS.z0 + SHOP_BOOTHS.z1) / 2, (SHOP_BOOTHS.x1 - SHOP_BOOTHS.x0) / 2, BD / 2]], blocks: [
    // Partitions between and either side of the booths, and over each: a curtain on its rail, a mirror on the back wall, a bench.
    ...Array.from({ length: SHOP_BOOTHS.count + 1 }, (_, i) => b([SHOP_BOOTHS.x0 + BW * i + (i === 0 ? 0.03 : i === SHOP_BOOTHS.count ? -0.03 : 0), 0, (SHOP_BOOTHS.z0 + SHOP_BOOTHS.z1) / 2], [0.06, BH, BD], "timber")),
    ...SHOP_BOOTH_LIST.flatMap(({ at: [x] }) => [
      b([x, 0.08, SHOP_BOOTHS.z0 + 0.03], [BW - 0.1, BH - 0.18, 0.05], "fabric"),
      b([x, BH - 0.07, SHOP_BOOTHS.z0 + 0.03], [BW, 0.04, 0.04], "metal"),
      b([x, 0.25, SHOP_BOOTHS.z1 - 0.05], [0.5, 1.5, 0.03], "glass"),
      b([x + BW / 2 - 0.3, 0, SHOP_BOOTHS.z1 - 0.4], [0.4, 0.42, 0.55], "concrete"),
    ]),
    b([(SHOP_BOOTHS.x0 + SHOP_BOOTHS.x1) / 2, BH, (SHOP_BOOTHS.z0 + SHOP_BOOTHS.z1) / 2], [SHOP_BOOTHS.x1 - SHOP_BOOTHS.x0, 0.06, BD], "timber"),  // their roof
  ] },

  // ════ The mezzanine: club merch (ref 1) ════
  { id: "stairwell-rail", level: 1, zone: "stair", label: "Railing round the stairwell", blocks: [
    b([S.x1 + 0.02, 0, (M.z0 + S.z1) / 2], [0.04, 1.0, S.z1 - M.z0], "glass"),
  ] },
  { id: "mezz-rail", level: 1, zone: "merch", label: "Glass railing along the mezzanine's edge", blocks: [
    b([(S.x1 + SHOP_ROOM.halfW) / 2, 0, M.z0 + 0.02], [SHOP_ROOM.halfW - S.x1, 1.0, 0.04], "glass"),
  ] },
  { id: "pegboard", level: 1, zone: "merch", label: "Pegboard wall, round the back corner", blocks: [
    b([1.3, 0, 4.97], [9.4, 3.0, 0.06], "pegboard"),
    b([5.97, 0, 2.0], [0.06, 3.0, 6.0], "pegboard"),
  ] },
  { id: "merch-counter", level: 1, zone: "merch", label: "Long metal counter with drawers", footprint: [[1.175, 4.66, 4.175, 0.31], [5.66, 2.485, 0.31, 2.485]], blocks: [
    b([1.175, 0, 4.66], [8.35, 0.85, 0.62], "metal"),
    b([5.66, 0, 2.485], [0.62, 0.85, 4.97], "metal"),
  ] },
  { id: "merch-shelf", level: 1, zone: "merch", label: "Metal shelf on the pegboard", blocks: [b([0.4, 1.55, 4.8], [2.6, 0.04, 0.3], "metal")] },
  { id: "merch-sign", level: 1, zone: "merch", label: "Club merch sign", blocks: [b([0.4, 2.62, 4.93], [2.6, 0.32, 0.04], "sign")] },
  // At the front, behind the glass: what you see of the merch level from the door.
  { id: "merch-plinths", level: 1, zone: "merch", label: "Featured drop: concrete plinths", footprint: [[0, 0.35, 0.45, 0.45], [0.85, 1.15, 0.325, 0.325]], blocks: [
    b([0, 0, 0.35], [0.9, 0.75, 0.9], "concrete"),
    b([0.85, 0, 1.15], [0.65, 0.4, 0.65], "concrete"),
  ] },
  { id: "edge-sign", level: 1, zone: "merch", label: "\"Club merch\" sign on the mezzanine's edge, facing the door", blocks: [b([0.9, -0.6, M.z0 - 0.04], [3.2, 0.38, 0.06], "sign")] },
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
  ...[-3.05, -2.6, -2.15].map((x, i) => slot(`clothes-${i + 1}`, "clothes", "rail", [x, 0.55, -0.2], [0.44, 0.9, 0.1])),
  // Laid side by side along the table, each fitted by its length.
  slot("tools-1", "tools", "tools-table", [3.35, 0.72, 0.32], [1.4, 0.06, 0.12]),     // a rod
  slot("tools-2", "tools", "tools-table", [3.3, 0.72, 0.56], [1.1, 0.1, 0.2]),        // a net
  slot("tools-3", "tools", "tools-table", [3.15, 0.72, 0.82], [0.9, 0.08, 0.16]),     // a shovel
  slot("tools-4", "tools", "tools-table", [4.05, 0.72, 0.8], [0.35, 0.3, 0.3]),       // the bag upgrade
  // Two shelves of each, the upper row staggered so every item has its own place along the shelf (and its own tag).
  ...[[0.95, [-0.35, 0.15, 0.65]], [1.55, [-0.1, 0.4, 0.9]]].flatMap(([y, zs], l) => (zs as number[]).map((z, i) => slot(`dyes-${l * 3 + i + 1}`, "dyes", "shelving", [5.7, (y as number) + 0.04, z], [0.18, 0.28, 0.3]))),
  ...[[0.95, [1.5, 2.3]], [1.55, [1.9, 2.7]]].flatMap(([y, zs], l) => (zs as number[]).map((z, i) => slot(`accessories-${l * 2 + i + 1}`, "accessories", "shelving", [5.7, (y as number) + 0.04, z], [0.3, 0.25, 0.3]))),
  slot("furniture-1", "furniture", "dais", [4.3, 0.16, 4.55], [1.6, 0.7, 0.65]),      // a sofa
  slot("furniture-2", "furniture", "dais", [5.6, 0.16, 4.6], [0.3, 1.4, 0.3]),        // a floor lamp
  slot("furniture-3", "furniture", "dais", [2.95, 0.16, 4.45], [0.55, 0.5, 0.55]),     // a chair or side table
  // The finishes, shown as a room would: wallpaper panels on the wall behind the sofa, flooring tiles on the dais in front.
  ...[3.15, 4.25, 5.35].map((x, i) => slot(`wallpaper-${i + 1}`, "finishes", "dais", [x, 0.95, 4.93], [0.95, 1.45, 0.04])),
  ...[3.6, 4.4, 5.2].map((x, i) => slot(`flooring-${i + 1}`, "finishes", "dais", [x, 0.16, 3.92], [0.7, 0.02, 0.4])),
  ...[-3.4, -2.9, -2.4].map((x, i) => slot(`clothes-${i + 4}`, "clothes", "clothes-table", [x, 0.6, 1.5], [0.42, 0.28, 0.42])),   // shoes
  // Upper floor: club merch
  ...[2.5, 3.5, 4.5].map((x, i) => slot(`merch-wear-${i + 1}`, "merch-wear", "pegboard", [x, 1.2, 4.88], [0.75, 0.9, 0.12])),
  ...[0.4, 1.4].map((z, i) => slot(`merch-wear-${i + 4}`, "merch-wear", "pegboard", [5.88, 1.3, z], [0.12, 0.95, 0.75])),
  ...[2.6, 3.4].map((z, i) => slot(`merch-wear-${i + 6}`, "merch-wear", "merch-counter", [5.62, 0.85, z], [0.42, 0.2, 0.5])),   // folded
  slot("merch-bags-1", "merch-bags", "pegboard", [-2.6, 1.3, 4.9], [0.55, 0.75, 0.08]),
  slot("merch-bags-2", "merch-bags", "pegboard", [-1.8, 1.3, 4.9], [0.55, 0.75, 0.08]),
  // In shallow trays on the counter (the counter's top at 0.85, a tray's floor at 0.88).
  ...[-0.2, 0.6, 1.4].map((x, i) => slot(`merch-small-${i + 1}`, "merch-small", "merch-counter", [x, 0.88, 4.62], [0.55, 0.18, 0.42])),
  slot("merch-small-4", "merch-small", "merch-counter", [2.9, 0.88, 4.62], [0.45, 0.22, 0.4]),
  slot("merch-small-5", "merch-small", "merch-counter", [4.1, 0.88, 4.62], [0.45, 0.22, 0.4]),
  slot("merch-prints-1", "merch-prints", "pegboard", [-0.25, 1.72, 4.91], [1.0, 0.85, 0.04]),
  slot("merch-prints-2", "merch-prints", "pegboard", [1.05, 1.72, 4.91], [1.0, 0.85, 0.04]),
  // The TSI keycap keychain hangs from its keyring on a hook on the pegboard, between the totes and the posters (SHOP_KEYCHAIN).
  slot("merch-keychain-1", "merch-small", "pegboard", [-1.15, 1.17, 4.86], [0.3, 0.98, 0.1]),
  // The TSI lanyard hangs folded over its own peg, between the posters and the shirts (SHOP_LANYARD).
  slot("merch-lanyard-1", "merch-small", "pegboard", [1.84, 1.04, 4.86], [0.3, 1.46, 0.1]),
  // The GENESIS sticker, both variants on a small easel on the counter under the totes (SHOP_STICKER).
  slot("merch-sticker-1", "merch-small", "merch-counter", [-2.2, 0.85, 4.55], [0.7, 0.32, 0.2]),
  slot("merch-featured-1", "merch-featured", "merch-plinths", [0, 0.75, 0.35], [0.5, 0.9, 0.35]),
  slot("merch-featured-2", "merch-featured", "merch-plinths", [0.85, 0.4, 1.15], [0.4, 0.3, 0.4]),
];

/**
 * The keycap keychain on the merch wall (specs/merch/tsi-keycap-keychain.md): the hook it hangs from (upstairs, room
 * space over the mezzanine's floor) and its display scale. The model is in units of 10 cm (its block 0.19 across, the
 * whole keychain 0.92 long, measured: IMG_3117-measured); at 1.07 the block is 0.24 game units, about thirteen times
 * life size (a game unit is about 1.2 m beside the 1.36-tall character), as small merch is blown up to read from the
 * walking camera (the sticker packs about six times, the totes about twice); the slot runs from its hook down 0.98.
 */
export const SHOP_KEYCHAIN = { hook: [-1.15, 2.15, 4.86] as [number, number, number], scale: 1.07, slot: "merch-keychain-1" } as const;
/**
 * The lanyard on the merch wall (specs/merch/tsi-lanyard.md): the peg it's folded over and its display scale. The model
 * is in units of 10 cm (the strap 2 cm wide, 48.6 cm from the peg to the hook's foot); at 0.3 the strap is 0.06 game
 * units wide and the whole lanyard 1.46 tall, about three times life size, so its words read close up at the wall; its
 * peg is under the CLUB MERCH sign and its hook clears the counter (the slot runs from the peg down 1.46).
 */
export const SHOP_LANYARD = { peg: [1.84, 2.5, 4.86] as [number, number, number], scale: 0.3, slot: "merch-lanyard-1" } as const;
/**
 * The GENESIS sticker on the counter (specs/merch/genesis-sticker.md): a small easel holding both variants side by side,
 * leaning back, under the totes, its foil catching the light as you walk past. At 0.4 a card (7.5 x 6 cm) is 0.30 x
 * 0.24 game units, about four times life size.
 */
export const SHOP_STICKER = { at: [-2.2, 0.85, 4.55] as [number, number, number], scale: 0.4, lean: 0.28, slot: "merch-sticker-1" } as const;

/** A light strip along an edge (the edge lighting), on a floor, from one end to the other. */
export interface LightStrip { level: Level; fixture: string; from: [number, number, number]; to: [number, number, number] }
const strip = (level: Level, fixture: string, from: [number, number, number], to: [number, number, number]): LightStrip => ({ level, fixture, from, to });
export const SHOP_STRIPS: LightStrip[] = [
  // Ground: each shelf's front lip, round the tools table under its top, floor glow along the dais and the plinths.
  ...[0.35, 0.95, 1.55, 2.15].map(y => strip(0, "shelving", [5.49, y + 0.01, -0.6], [5.49, y + 0.01, 2.9])),
  strip(0, "tools-table", [2.6, 0.6, 0.2], [4.4, 0.6, 0.2]), strip(0, "tools-table", [2.6, 0.6, 1.0], [4.4, 0.6, 1.0]),
  strip(0, "tools-table", [2.6, 0.6, 0.2], [2.6, 0.6, 1.0]), strip(0, "tools-table", [4.4, 0.6, 0.2], [4.4, 0.6, 1.0]),
  strip(0, "dais", [2.5, 0.05, 3.59], [6.0, 0.05, 3.59]), strip(0, "dais", [2.49, 0.05, 3.6], [2.49, 0.05, 5.0]),
  strip(0, "seasonal-plinths", [2.6, 0.04, -3.56], [3.4, 0.04, -3.56]),
  strip(0, "seasonal-plinths", [3.45, 0.04, -3.76], [4.25, 0.04, -3.76]),
  strip(0, "seasonal-plinths", [4.35, 0.04, -3.26], [4.95, 0.04, -3.26]),
  strip(0, "clothes-table", [-3.7, 0.48, 1.15], [-2.1, 0.48, 1.15]),
  // Upper: under the merch counter's top lip and the pegboard shelf (ref 1), floor glow along the plinths.
  strip(1, "merch-counter", [-3.0, 0.8, 4.34], [5.35, 0.8, 4.34]),
  strip(1, "merch-counter", [5.34, 0.8, 0.0], [5.34, 0.8, 4.34]),
  strip(1, "merch-shelf", [-0.9, 1.53, 4.7], [1.7, 1.53, 4.7]),
  strip(1, "merch-plinths", [-0.45, 0.04, -0.11], [0.45, 0.04, -0.11]),
  strip(1, "merch-plinths", [0.525, 0.04, 0.815], [1.175, 0.04, 0.815]),
];
/** The linear pendant over the counter (ref 2): a bar from x0 to x1 at height y, hung on two wires from the ceiling. */
export const SHOP_PENDANT = { x0: -1.5, x1: 1.5, y: 2.6, z: 3.3, wires: [-1.3, 1.3] } as const;

/** The floors: herringbone oak downstairs, polished concrete on the mezzanine. */
export const SHOP_FLOORS = [
  { level: 0, id: "oak", label: "Herringbone oak" },
  { level: 1, id: "concrete", label: "Polished concrete" },
] as const;
/** The windows in the +x wall, one over the other in the double-height front, behind the seasonal plinths: z0..z1 along it, sill to head above each floor. */
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
  { id: "right-loop", level: 0, label: "Round the clothes rail and table, to the changing rooms", points: [[-0.9, -1.2], [-3.75, -1.2], [-3.75, 0.6], [-1.6, 0.6], [-1.6, 2.4], [-5.0, 2.4], [-5.0, 3.2], [-2.9, 3.2]] },
  { id: "merch-loop", level: 1, label: "Merch loop", points: [[-4.85, 2.3], [-4.85, 3.7], [4.85, 3.7], [4.85, -0.5], [-3.7, -0.5], [-3.7, 2.3], [-4.85, 2.3]] },
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
  return x < S.x1 + pad && (level === 0 ? z > S.z0 && z < S.z1 + pad : z < S.z1);
}
/** Where you can stand on a floor: inside the walker's bounds (the mezzanine's, upstairs), clear of everything solid and of the stair. */
export function shopWalkable(level: Level, x: number, z: number, pad = SHOP_PAD): boolean {
  const mx = SHOP_ROOM.halfW - SHOP_WALK_MARGIN, mz = SHOP_ROOM.halfD - SHOP_WALK_MARGIN;
  const front = level === 0 ? -mz : M.z0 + M.edge;
  return Math.abs(x) <= mx + 1e-9 && z <= mz + 1e-9 && z >= front - 1e-9 && !shopSolidAt(level, x, z, pad) && !stairBlocks(level, x, z, pad);
}
/** Your feet's height on the flight at z. */
export const stairHeight = (z: number) => F * Math.min(1, Math.max(0, (z - S.z0) / (S.z1 - S.z0)));

export type WalkZone = "ground" | "stair" | "upper";
/** The walker's state in the shop: which floor (or the stair) you're on, your height, and whether the upper floor shows. */
export interface ShopWalker {
  zone: WalkZone;
  height: number;
  /** The mezzanine is drawn: on it or the stair, or downstairs out front; cut away once you're under it (with a little hysteresis, so it never flickers). */
  upperShown: boolean;
  /** The walker's constrainMove: one step from (x, z) toward (nx, nz), sliding along what it meets, up and down the stair. */
  constrain(x: number, z: number, nx: number, nz: number): [number, number];
}

const inLane = (x: number) => x >= STAIR_LANE[0] - 1e-9 && x <= STAIR_LANE[1] + 1e-9;
const clampLane = (x: number) => Math.min(STAIR_LANE[1], Math.max(STAIR_LANE[0], x));

export function createShopWalker(): ShopWalker {
  const out: [number, number] = [0, 0];
  const w: ShopWalker = {
    zone: "ground", height: 0, upperShown: true,
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
      w.upperShown = w.zone !== "ground" || (w.upperShown ? z < M.hideAbove : z < M.showBelow);
      out[0] = x; out[1] = z;
      return out;
    },
  };
  return w;
}

/**
 * The layout as the model build reads it (art/interiors/build_shop.py reads art/interiors/shop_layout.json, written by
 * scripts/shop-layout-json.mjs): every number the room's models stand on, so the models and the walking never drift.
 */
export function shopLayoutJson(): string {
  return JSON.stringify({
    room: SHOP_ROOM, floorHeight: SHOP_FLOOR_HEIGHT, slab: SHOP_SLAB, door: SHOP_DOOR, stair: SHOP_STAIR, mezz: SHOP_MEZZ,
    booths: SHOP_BOOTHS, boothList: SHOP_BOOTH_LIST, pendant: SHOP_PENDANT, windows: SHOP_WINDOWS,
    fixtures: SHOP_FIXTURES, slots: SHOP_SLOTS, strips: SHOP_STRIPS,
  }, null, 1) + "\n";
}
