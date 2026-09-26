/**
 * Home furniture pieces (ledger row 116): pieces from the ACNH dump already
 * in the repo. This is geometry only; what a member may place is what they
 * own (shop `furn-<id>` rows, lib/wallet/catalogue.ts). Footprints are whole cells measured from the GLB bounds
 * (furniture is authored in raw dump units, shown at 0.1 = 1 cell per 10 raw).
 * `mount`: floor items block cells; rugs lie under floor items; wall items hang
 * on the back or side walls. `where` limits a piece to the house or the island.
 */
export type Mount = "floor" | "rug" | "wall";
export type Where = "indoor" | "outdoor" | "both";
export interface CatalogueItem {
  id: string;
  label: string;
  url: string;
  /** Model scale to world units. */
  scale: number;
  /** Footprint in cells [width along x, depth along z] at rotation 0 (wall items: [width, 1]). */
  size: [number, number];
  mount: Mount;
  where: Where;
}

const F = "/assets/acnh/furniture/", P = "/assets/acnh/props/", PL = "/assets/acnh/plants/";
const f = (id: string, label: string, size: [number, number], mount: Mount = "floor", scale = 0.1): CatalogueItem =>
  ({ id, label, url: `${F}${id}.glb`, scale, size, mount, where: "indoor" });
const o = (id: string, label: string, size: [number, number], url = `${P}${id}.glb`): CatalogueItem =>
  ({ id, label, url, scale: 1, size, mount: "floor", where: "outdoor" });

export const CATALOGUE: readonly CatalogueItem[] = [
  f("home-bed", "Country bed", [2, 1]),
  f("floor-lamp", "Floor lamp", [1, 1]),
  f("bookshelf", "Bookshelf", [2, 1]),
  f("closet", "Closet", [2, 1]),
  f("study-desk", "Study desk", [2, 1]),
  f("study-chair", "Study chair", [1, 1]),
  f("lounge-sofa", "Sofa", [2, 1]),
  f("lounge-table", "Low table", [2, 1]),
  f("reading-table", "Small table", [1, 1]),
  f("wooden-chest", "Wooden chest", [2, 1]),
  f("color-box-shelf", "Colour-box shelf", [1, 1]),
  f("counter-register", "Counter", [1, 1]),
  f("barrel", "Barrel", [1, 1]),
  f("plant-monstera", "Monstera", [1, 1]),
  f("plant-yucca", "Yucca", [1, 1]),
  f("antique-clock", "Grandfather clock", [1, 1]),
  f("altar", "Stone altar", [2, 2]),
  f("remains-pillar", "Ruin pillar", [1, 1]),
  f("shopping-cart", "Shopping cart", [1, 1]),
  f("windmill-retro", "Retro windmill", [2, 2]),
  f("gold-hha-trophy", "Gold trophy", [1, 1]),
  f("candle", "Candle", [1, 1]),
  f("lounge-rug", "Cream rug", [3, 3], "rug"),
  f("yellow-message-mat", "Welcome mat", [2, 1], "rug"),
  f("acorn-rug", "Acorn rug", [2, 3], "rug"),
  f("wall-clock", "Wall clock", [1, 1], "wall"),
  f("wall-frame", "Picture frame", [1, 1], "wall"),
  f("wall-driedflower", "Dried flowers", [2, 1], "wall"),
  f("bulletinboard", "Bulletin board", [2, 1], "wall"),
  o("bench-wood", "Log bench", [2, 1]),
  o("bench-park", "Park bench", [2, 1]),
  o("streetlamp", "Street lamp", [1, 1]),
  o("fence-country-a", "Fence", [1, 1]),
  o("stone-lantern", "Stone lantern", [1, 1]),
  o("campfire", "Campfire", [2, 2]),
  o("beach-parasol", "Parasol", [2, 2]),
  o("beach-bed", "Beach chair", [2, 1]),
  o("bush-azalea", "Azalea bush", [1, 1], `${PL}bush-azalea.glb`),
  o("flower-tulip", "Tulips", [1, 1], `${PL}flower-tulip.glb`),
  o("flower-rose", "Roses", [1, 1], `${PL}flower-rose.glb`),
  o("tree-hardwood-a", "Tree", [1, 1], `${PL}tree-hardwood-a.glb`),
];

const BY_ID = new Map(CATALOGUE.map(item => [item.id, item]));
export function catalogueItem(id: string): CatalogueItem | undefined {
  return BY_ID.get(id);
}
