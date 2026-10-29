import {
  CLIFF_LEVELS, drawnSurfaceAt, isGroundAtWorld, levelAt, rampRun, sampleGroundHeight, worldToCellX, worldToCellZ,
} from "./grid";
import { ROCK_MODELS, ROCK_SIZE } from "./rocks";
import { FURNITURE, studySolid, type Furniture } from "@/lib/study/seats";
import { objectsOf, village, villageSpawnPoint, type MapObject, type Village } from "./villageMap";
import { barrierBoxes, barrierFootprint, barrierPlacements, inBarrier, releaseRegions } from "./barriers";
import { DROPS } from "./drops";
import { JETTY, worldToDock, type Dock } from "./wharf";
import { BAR_DECKS, barOf } from "./sushiBar";
import { FENCE_POST_HALF, fenceSolids, isJoinedFence } from "./fences";
import { NEW_LAMPS } from "./propModels";
import { MAX_CLIMB, terrainHeight, terrainSteepness, terrainSurface } from "./world/terrain";

/**
 * Default island: the member island's core (ledger rows 155, 156), read from
 * the member island's map (lib/game/villageMap.ts village(), the new world:
 * web/data/world, row 321). Compass (row 239): the follow camera looks +z, which is west
 * (up-screen); +x, screen left, is south. A compass azimuth A (from north,
 * clockwise) is the world direction (x, z) = (−cos A, −sin A), so north is −x
 * and east is −z (toward the viewer).
 *
 * The file says WHERE things are; this module says WHAT they are: each
 * landmark's label, footprint and door, each prop model's footprint. Doors,
 * exits and the wharf's deck, boat and arrival point are offsets from their
 * landmark, so moving a building in the painter moves its door with it.
 */

export type LandmarkId = "hq" | "plaza" | "monument" | "mailbox" | "notice" | "catch" | "shop" | "cafe" | "oracle" | "museum" | "ruins" | "pond" | "wharf" | "beach";
export interface Landmark {
  id: LandmarkId; label: string; x: number; z: number;
  /** Open to visit now; closed landmarks are visible but boarded up. */
  open: boolean;
  /** Solid footprint half extents (axis aligned), if the landmark blocks walking. */
  half?: [number, number];
  /** Minimap marker colour. */
  color: string;
  /** Model scale (the world map runs its buildings a touch larger). `half` and door points arrive already scaled. */
  scale?: number;
  /** Radians about +y (the wharf only; buildings face the camera). */
  yaw?: number;
}

interface LandmarkInfo extends Omit<Landmark, "id" | "x" | "z" | "yaw"> {
  /** Door or prompt point, relative to the landmark (before yaw). */
  door?: [number, number];
  /** Where you stand after coming back out (or arriving), relative. */
  exit?: [number, number];
}

/** What each landmark is. Order is the minimap and prompt order. */
export const LANDMARK_INFO: Record<LandmarkId, LandmarkInfo> = {
  hq: { label: "HQ", open: true, half: [3.5, 2.65], color: "#5B4B9E", door: [0, -3.05], exit: [0, -3.95] },
  plaza: { label: "Plaza", open: true, color: "#C98F73" },
  monument: { label: "Club monument", open: true, half: [1.1, 1.0], color: "#B79A5B" },
  mailbox: { label: "Mailbox", open: true, half: [0.3, 0.3], color: "#C0463C" },
  notice: { label: "Notice board", open: true, half: [0.75, 0.25], color: "#8A6A4A" },
  catch: { label: "Catch board", open: true, half: [0.75, 0.25], color: "#3E7FA6" },
  // Its door prompt at the foot of the porch steps (the double doors stand back on the porch); you come back out a step further.
  shop: { label: "Shop", open: true, half: [3.25, 1.8], color: "#2B4EA0", door: [0, -2.2], exit: [0, -3.1] },
  // The prompt is the door's (cafe-polish §2); you come back out past its range.
  // A 5 x 5 footprint on the grid (art/cafe/build_building.py), its porch inside it.
  cafe: { label: "Café", open: false, half: [2.5, 2.5], color: "#C9A227", door: [0, -2.8], exit: [0, -4.3] },
  oracle: { label: "Oracle temple", open: true, half: [3.4, 1.7], color: "#2E8B8B", door: [0, -2.2], exit: [0, -3.1] },
  museum: { label: "Museum", open: false, half: [2.5, 2.1], color: "#9A4A3A", exit: [0, -3] },
  ruins: { label: "Ruins gate", open: false, half: [0.4, 1.6], color: "#6F6A62", exit: [-1.6, 0] },
  pond: { label: "Pond", open: true, color: "#69A8D0" },
  beach: { label: "Beach", open: true, color: "#E4CD96" },
  // Boat home at the stub end (specs/homes.md §1); you arrive a little inland.
  wharf: { label: "Wharf", open: true, color: "#B98C60", door: [0, -2.5], exit: [0, 1.1] },
};
export const LANDMARK_IDS = Object.keys(LANDMARK_INFO) as LandmarkId[];

/** Wharf stub deck (walkable over the water), relative to the wharf before its yaw. */
export const WHARF_DECK_LOCAL = { x0: -0.9, x1: 0.9, z0: -3.5, z1: 2 };
/**
 * Wooden bridge deck, relative, before its yaw: the model spans ±1.9 along x, its rails at ±1.45 across. The deck
 * stops 1.0 out so a body (0.2 probes, about 0.3 wide) walks clear of the rails.
 */
export const BRIDGE_DECK_HALF: [number, number] = [1.9, 1.0];
/** The rails are solid from the deck's edge out to here (across, relative), along the whole deck: on water or on the bank. */
export const BRIDGE_RAIL_OUT = 1.65;
/**
 * Solid footprints (half width, half depth, before rotation and scale), from the measured GLB bounds; a third and fourth
 * number move its centre off the model's origin (in its own frame). The new world's are fitted to what each model draws
 * at body height (0.3 to 1.8 over the ground; the collision lane's audit, specs/evidence/collision/audit.md): a tree or a
 * palm by its trunk, a pole by its pole (the cloth and the leaves are soft).
 */
export const PROP_FOOTPRINT: Record<string, readonly [number, number, number?, number?]> = {
  "bench-wood": [0.98, 0.27], "plaza-bench": [0.98, 0.27], "rock-a": [0.48, 0.45], "rock-b": [0.46, 0.42], "rock-c": [0.5, 0.5],
  "fence-country-a": [0.5, 0.16], "fence-country-b": [0.5, 0.16],
  // The faceted boulders (lib/game/rocks.ts, art/rocks/build_rocks.py).
  ...Object.fromEntries(ROCK_MODELS.map(m => [m, ROCK_SIZE[m].half])),
  // The `prop` kind's scenery, in the model's own units (its object's scale sizes it): a palm or a parasol by its trunk or pole.
  barrel: [4.85, 4.85], lighthouse: [9, 9], crate: [0.91, 0.3], "market-cart": [3.77, 1.03], "shop-cart": [0.44, 0.28],
  "beach-parasol": [0.1, 0.1], "palm-a": [0.3, 0.3], "palm-b": [0.25, 0.25],
  "wharf-piling": [0.15, 0.15], "rope-post": [0.1, 0.1], "rope-span": [1, 0.03],
  "palm-tall": [0.45, 0.45], "palm-lean": [0.59, 0.47, 0.12, 0], "palm-short": [0.4, 0.4], "palm-small": [0.3, 0.3],
  "log-bench": [0.95, 0.24], "stump-seat": [0.3, 0.3], "firewood-stack": [0.95, 0.46], "fish-rack": [1.02, 0.37],
  // game/village-art's plaza set: the fountain's box sits inside its round basin (a body stops on the rim's cap).
  "plaza-fountain": [4.52, 4.52], "banner-pole": [0.1, 0.1], "flag-pole": [0.12, 0.12], "fruit-stall": [1.27, 0.57], "fruit-barrel": [0.38, 0.38],
  "fruit-crate": [0.32, 0.22], "flower-planter": [0.62, 0.22], "flower-pot": [0.24, 0.24], "round-planter": [0.52, 0.52],
  "planter-bench": [1.3, 0.28], "market-sign": [0.31, 0.25],
  "dock-pile-rope": [0.25, 0.25], "rope-net": [1.13, 0.13], "life-ring": [0.48, 0.09], "net-heap": [0.53, 0.46, -0.08, -0.02], "crate-net": [0.7, 0.4],
  "crate-cloth": [0.41, 0.41, 0.05, -0.03], "fish-crate": [0.36, 0.42], "dock-hoist": [0.15, 0.15],
  "path-rock-slab": [0.2, 0.12], "path-rock-low": [0.22, 0.26, -0.07, 0.05], "path-rock-cluster": [0.2, 0.17, -0.15, 0.02], "rustic-fence-a": [1.29, 0.12, 0.01, 0.02],
  "rustic-fence-b": [0.93, 0.1, 0.06, 0.03], "rustic-post": [0.22, 0.11, 0.1, 0.05],
  "sushi-bar": [4.0, 1.5], "fish-market": [4.46, 3.05, 0.36, 0.75], "sell-barrel": [1.25, 0.6],
  "beach-lounger": [0.34, 0.95], sandcastle: [0.55, 0.38, -0.06, 0.05], "beach-cooler": [0.33, 0.22], "volleyball-net": [4.78, 0.1], "lifeguard-tower": [1.02, 1.45, 0, 0.42],
  "surfboard-a": [0.25, 0.14, -0.12, -0.1], "surfboard-b": [0.24, 0.14, 0.11, -0.09], "surfboard-c": [0.22, 0.16, -0.11, -0.07],
  // game/village-art2
  "moss-boulder-a": [0.65, 0.5], "moss-boulder-b": [1.05, 0.65], "river-stones-b": [0.55, 0.4],
  // game/wharf-art4
  "tackle-shop": [2.3, 2.45],
  // game/trees-art: the riverbank trees' trunks at the ground.
  "river-tree-willow": [0.7, 0.7], "river-tree-alder": [0.46, 0.6, -0.15, 0.08], "river-tree-oak": [0.75, 0.75], "river-tree-lean": [0.6, 0.6],
};
/**
 * The campfire's stone ring, its radius before the fire's scale: the stones' outer edge at their tops (art/props/
 * build_campfire.py, measured 0.69 to 0.72). The smooth world walls the pit round it; the sit (2.1) and dance (2.9)
 * rings stay open (lib/game/campfire.ts FIRE). The village's fire is walled by its scene (Campfire.tsx).
 */
export const FIRE_PIT_RING = 0.72;
/** Props whose footprint is round, `hw` its radius: the plaza fountain's basin (a square would stand out past its rim). */
export const ROUND_PROPS: ReadonlySet<string> = new Set(["plaza-fountain"]);
/** Prop tops before scale, measured from the GLB bounds: what a jump clears or lands on (lib/game/movement). */
export const PROP_TOP: Record<string, number> = {
  "bench-wood": 0.51, "plaza-bench": 0.5, "rock-a": 0.61, "rock-b": 0.59, "rock-c": 0.52, "fence-country-a": 0.7, "fence-country-b": 0.69,
  ...Object.fromEntries(ROCK_MODELS.map(m => [m, ROCK_SIZE[m].top])),
  barrel: 11.66, lighthouse: 38, crate: 0.52, "market-cart": 2.8, "shop-cart": 0.87, "beach-parasol": 2.33, "palm-a": 3.94, "palm-b": 2.7,
  "wharf-piling": 0.35, "rope-post": 0.87, "rope-span": 0.68, "palm-tall": 6.21, "palm-lean": 5.03, "palm-short": 3.46, "palm-small": 1.95,
  "log-bench": 0.51, "stump-seat": 0.45, "firewood-stack": 0.86, "fish-rack": 1.43,
  "plaza-fountain": 3.21, "banner-pole": 3.3, "flag-pole": 4.13, "fruit-stall": 2.5, "fruit-barrel": 1.005, "fruit-crate": 0.495,
  "flower-planter": 0.623, "flower-pot": 0.627, "round-planter": 1.091, "planter-bench": 0.731, "market-sign": 0.987,
  "dock-pile-rope": 0.9, "rope-net": 1.15, "life-ring": 0.93, "net-heap": 0.39, "crate-net": 0.7, "crate-cloth": 0.74, "fish-crate": 0.48,
  "dock-hoist": 2.645,
  "path-rock-slab": 0.538, "path-rock-low": 0.247, "path-rock-cluster": 0.294, "rustic-fence-a": 0.99, "rustic-fence-b": 0.91, "rustic-post": 0.931,
  "sushi-bar": 6.543, "fish-market": 11.97, "sell-barrel": 2.62,
  "beach-lounger": 0.948, sandcastle: 0.78, "beach-cooler": 0.486, "volleyball-net": 2.53, "lifeguard-tower": 4.7, "surfboard-a": 1.755, "surfboard-b": 1.759, "surfboard-c": 1.763,
  "moss-boulder-a": 0.855, "moss-boulder-b": 0.761, "river-stones-b": 0.475,
  "tackle-shop": 6.741,
};
/**
 * Residents' houses (the `house` kind, specs/world-editor.md decision 10): the chalet in its three colourways, the
 * museum's model, standing on its footprint like a building. `model` picks the colourway (brown by default).
 */
export const HOUSE_MODELS = ["chalet-brown", "chalet-red", "chalet-yellow"] as const;
export type HouseModel = (typeof HOUSE_MODELS)[number];
export const HOUSE_HALF: [number, number] = [2.5, 2.1];
export const houseModel = (model?: string): HouseModel => (HOUSE_MODELS as readonly string[]).includes(model ?? "") ? model as HouseModel : "chalet-brown";
/** A house's solid footprint as world-axis half extents after its turn and scale (as landmarkHalf). */
export function houseHalf(yaw = 0, scale = 1): [number, number] {
  const c = Math.abs(Math.cos(yaw)), n = Math.abs(Math.sin(yaw));
  return [(HOUSE_HALF[0] * c + HOUSE_HALF[1] * n) * scale, (HOUSE_HALF[0] * n + HOUSE_HALF[1] * c) * scale];
}

/**
 * The smooth world's building walls (the collision lane's audit, 2026-10-26: "the big buildings hit box vs actual box is
 * not matched"): centre offset and half extents in the building's own frame, before its scale, measured from the drawn
 * models at body height (0.3 to 1.8 over the ground). The ACNH buildings stand behind their origin (turned a half turn),
 * so their walls sit well off the centred halves; the smooth world turns each building its own way, so the box turns
 * with it. The village keeps its centred, unturned halves (LANDMARK_INFO, HOUSE_HALF). The café keeps its authored 5 x 5.
 */
const CHALET_SOLID = [0, 1.2, 2.35, 1.34] as const;
export const BUILDING_SOLID: Readonly<Partial<Record<LandmarkId | "house", readonly [number, number, number, number]>>> = {
  hq: [-0.17, -0.75, 2.93, 1.4], shop: [-0.2, 1.79, 3.01, 1.71], oracle: [0, 2.08, 3.38, 1.46], cafe: [0, 0, 2.5, 2.5], museum: CHALET_SOLID, house: CHALET_SOLID,
};

/** A tree trunk blocks this far from its centre. */
export const TREE_TRUNK = 0.65;
export const TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];
/** A tree's seed picks one of the season's TREE_SLOTS models (SEASON_TREES); slot 3 is the cedar (no fruit, any turn). */
export const TREE_SLOTS = 4;
export const isCedar = (seed: number) => seed % TREE_SLOTS === 3;

export const turn = (dx: number, dz: number, yaw = 0): [number, number] =>
  yaw ? [dx * Math.cos(yaw) + dz * Math.sin(yaw), -dx * Math.sin(yaw) + dz * Math.cos(yaw)] : [dx, dz];

/**
 * A landmark's solid footprint as world-axis half extents, after its scale and yaw: the bound of the turned rect
 * (exact at quarter turns, a hair generous at the organic jitter angles the world map uses). Null when it has none.
 */
export function landmarkHalf(id: LandmarkId, yaw = 0, scale = 1): [number, number] | null {
  const half = LANDMARK_INFO[id]?.half;
  if (!half) return null;
  if (!yaw && scale === 1) return half;
  const c = Math.abs(Math.cos(yaw)), n = Math.abs(Math.sin(yaw));
  return [(half[0] * c + half[1] * n) * scale, (half[0] * n + half[1] * c) * scale];
}

/** Landmarks placed on the map, in the table's order; `opened` lists the buildings completed club goals have opened (the café, the museum). */
export function landmarks(v: Village = village(), opened: readonly string[] = []): Landmark[] {
  const placed = new Map(objectsOf("landmark", v).map(o => [o.id, o]));
  return LANDMARK_IDS.flatMap((id) => {
    const o = placed.get(id);
    if (!o) return [];
    const { door: _door, exit: _exit, ...info } = LANDMARK_INFO[id];
    void _door; void _exit;
    const s = o.scale ?? 1, half = landmarkHalf(id, o.yaw, s);
    return [{ id, x: o.x, z: o.z, ...info, ...(half ? { half } : {}), open: info.open || opened.includes(id),
      ...(o.yaw ? { yaw: o.yaw } : {}), ...(s !== 1 ? { scale: s } : {}) }];
  });
}
export const landmark = (id: LandmarkId, v: Village = village()): Landmark | null => landmarks(v).find(l => l.id === id) ?? null;

/** A landmark's door (or prompt) or exit point in world XZ, or null when it has none or is not placed. */
export function landmarkPoint(id: LandmarkId, which: "door" | "exit", v: Village = village()): [number, number] | null {
  const l = landmark(id, v), offset = LANDMARK_INFO[id][which];
  if (!l || !offset) return null;
  const k = l.scale ?? 1;
  const [dx, dz] = turn(offset[0] * k, offset[1] * k, l.yaw);
  return [l.x + dx, l.z + dz];
}

/** Axis-aligned rect of a local rect turned by `yaw` (quarter turns stay exact). */
function turnedRect(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, yaw = 0) {
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([a, b]) => turn(a, b, yaw));
  const xs = pts.map(p => Math.round((x + p[0]) * 1e6) / 1e6), zs = pts.map(p => Math.round((z + p[1]) * 1e6) / 1e6);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** Whether the wharf is the new world's jetty (its landmark's model "jetty": lib/game/wharf.ts JETTY) rather than the pier. */
const isJetty = (v: Village) => objectsOf("landmark", v).some(o => o.id === "wharf" && o.model === "jetty");
/** The wharf as a dock (lib/game/wharf.ts): where its pier stands and its turn; the jetty's platform height as `y`. */
export function wharfDock(v: Village = village()): Dock | null {
  const w = landmark("wharf", v);
  return w ? { x: w.x, z: w.z, yaw: w.yaw ?? 0, ...(isJetty(v) ? { y: JETTY.top } : {}) } : null;
}
/** A walkable deck in world XZ and its height at a point (stairs climb). */
export type Deck = { x0: number; x1: number; z0: number; z1: number; y: (x: number, z: number) => number };
/** Every walkable deck of the wharf in world XZ: the plain pier at DECK_Y, or the jetty's landing, stairs, platform and gangways. */
export function wharfDecks(v: Village = village()): Deck[] {
  const w = landmark("wharf", v);
  if (!w) return [];
  if (!isJetty(v)) return [{ ...turnedRect(w.x, w.z, WHARF_DECK_LOCAL, w.yaw), y: () => DECK_Y }];
  return localDecks({ x: w.x, z: w.z, yaw: w.yaw ?? 0 }, JETTY.decks);
}
/** The sushi bar's decks in world XZ (lib/game/sushiBar.ts BAR_DECKS): its floor on the stilts, the landing and the boardwalk. */
export function barDecks(v: Village = village()): Deck[] {
  const b = barOf(v);
  return b ? localDecks({ x: b.x, z: b.z, yaw: b.yaw ?? 0 }, BAR_DECKS) : [];
}
/** Decks given in a frame's own coordinates, each at its height `y`, a ramp climbing `rise` from z0 to z1. */
function localDecks(d: Dock, rects: readonly { x0: number; x1: number; z0: number; z1: number; y: number; rise?: number }[]): Deck[] {
  const local = { x: 0, z: 0 };
  return rects.map(r => {
    const rise = r.rise ?? 0;
    return { ...turnedRect(d.x, d.z, r, d.yaw), y: rise ? (x: number, z: number) => r.y + rise * Math.min(1, Math.max(0, (worldToDock(d, x, z, local).z - r.z0) / (r.z1 - r.z0))) : () => r.y };
  });
}
/** Half the side of a wharf board square (the `deck` kind, lib/game/wharf.ts deckPieces: the 4 x 4 `deck-tile`, turned its own way). */
export const DECK_SQUARE_HALF = 2;
/** The wharf's main walkable deck in world XZ (the pier, or the jetty's landing), or null without a wharf. */
export const wharfDeck = (v: Village = village()): Deck | null => wharfDecks(v)[0] ?? null;

/** Walkable bridge decks in world XZ. */
export function bridgeDecks(v: Village = village()) {
  const [a, b] = BRIDGE_DECK_HALF;
  return objectsOf("bridge", v).map(o => turnedRect(o.x, o.z, { x0: -a, x1: a, z0: -b, z1: b }, o.yaw));
}

/** Each bridge's two rails as solid strips in world XZ, either side of its deck. */
export function bridgeRails(v: Village = village()) {
  const [a, b] = BRIDGE_DECK_HALF;
  return objectsOf("bridge", v).flatMap(o => [
    turnedRect(o.x, o.z, { x0: -a, x1: a, z0: b, z1: BRIDGE_RAIL_OUT }, o.yaw),
    turnedRect(o.x, o.z, { x0: -a, x1: a, z0: -BRIDGE_RAIL_OUT, z1: -b }, o.yaw),
  ]);
}

/** Where a fresh visit starts. */
export function villageSpawn(v: Village = village()): [number, number, number] {
  const [x, z] = villageSpawnPoint(v);
  return [x, 0, z];
}

/** The benches, rocks, fences and scenery props: the props with a solid footprint. */
export const propsOf = (v: Village = village()) => [...objectsOf("bench", v), ...objectsOf("rock", v), ...objectsOf("fence", v), ...objectsOf("prop", v)];

/** Solid footprint of a bench, rock or fence: half extents and centre offset × scale (before its yaw). */
export function propFootprint(o: Pick<MapObject, "model" | "scale">): [number, number, number, number] | null {
  const f = o.model ? PROP_FOOTPRINT[o.model] : undefined, k = o.scale ?? 1;
  return f ? [f[0] * k, f[1] * k, (f[2] ?? 0) * k, (f[3] ?? 0) * k] : null;
}

/** Whether (x, z) is inside half extents hw × hd around `at`, turned by `yaw`. */
export function inFootprint(x: number, z: number, at: { x: number; z: number }, yaw: number, hw: number, hd: number): boolean {
  const dx = x - at.x, dz = z - at.z;
  return Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) < hw && Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) < hd;
}

/**
 * An object's footprint in its own frame (before its yaw): half extents and centre offset; null = a point.
 * Buildings, the wharf deck, bridges, study furniture and props. The painter draws and picks with it;
 * the health check's overlap warnings test it.
 */
export function objectFootprint(o: MapObject): { hw: number; hd: number; cx: number; cz: number } | null {
  if (o.kind === "landmark") {
    const d = WHARF_DECK_LOCAL, half = LANDMARK_INFO[o.id as LandmarkId]?.half;
    if (o.id === "wharf") return { hw: (d.x1 - d.x0) / 2, hd: (d.z1 - d.z0) / 2, cx: (d.x0 + d.x1) / 2, cz: (d.z0 + d.z1) / 2 };
    const k = o.scale ?? 1;
    return half ? { hw: half[0] * k, hd: half[1] * k, cx: 0, cz: 0 } : null;
  }
  if (o.kind === "bridge") return { hw: BRIDGE_DECK_HALF[0], hd: BRIDGE_DECK_HALF[1], cx: 0, cz: 0 };
  if (o.kind === "house") return { hw: HOUSE_HALF[0] * (o.scale ?? 1), hd: HOUSE_HALF[1] * (o.scale ?? 1), cx: 0, cz: 0 };
  if (o.kind === "barrier") return barrierFootprint(o.model, o.scale ?? 1);
  // A connectable fence's post (its rails run to whatever stands beside it: lib/game/fences.ts).
  if (isJoinedFence(o)) return { hw: FENCE_POST_HALF, hd: FENCE_POST_HALF, cx: 0, cz: 0 };
  if (o.kind === "study" && o.model && o.model in FURNITURE) {
    const [cx, cz, hw, hd] = FURNITURE[o.model as Furniture].solid[0];
    return { hw, hd, cx, cz };
  }
  const f = propFootprint(o);
  return f ? { hw: f[0], hd: f[1], cx: f[2], cz: f[3] } : null;
}

/** Bench-wood seat top: its slats measure 0.48–0.51 above the ground. */
export const BENCH_SEAT_TOP = 0.5;
/**
 * A bench seats two (specs/multiplayer-questions.md default 7): its slots sit this far either way along it from its
 * middle. One seat model for everyone: players and bots claim a slot over the network (benchSlotKey), and residents
 * sit only in these slots, yielding to a player's claim (components/game/NPC.tsx).
 */
export const BENCH_SLOTS = [-0.42, 0.42] as const;
/** A bench slot's spot in world XZ: along the bench (its local x), either side of its middle. */
export function benchSlotPoint(b: Pick<MapObject, "x" | "z" | "yaw">, slot: 0 | 1): [number, number] {
  const yaw = b.yaw ?? 0, off = BENCH_SLOTS[slot];
  return [b.x + Math.cos(yaw) * off, b.z - Math.sin(yaw) * off];
}
/** The bench slots residents sit in this frame (their claim keys), written by the residents' frame: `benchSeat` treats them as taken. */
export const benchHeld = new Set<string>();
const slotKeys = new Map<string, readonly [string, string]>();
/** A bench slot's seat claim (`s {seat}`, protocol isSeatKey): `bench:<map id>#0` or `#1`, made once per bench. */
export function benchSlotKey(id: string, slot: 0 | 1): string {
  let keys = slotKeys.get(id);
  if (!keys) slotKeys.set(id, keys = [`bench:${id}#0`, `bench:${id}#1`]);
  return keys[slot];
}
/**
 * The village bench within reach, as a `tsi:sit` spot: the nearer of its two slots that nobody else holds (`taken`:
 * another player's claim; with both held there's no seat), facing the side you stand on, and the slot's claim key.
 * Along the bench is its local x. `benches`: the village's, when the caller holds them (every frame).
 */
export function benchSeat(x: number, z: number, range = 1.3, v: Village = village(), benches: readonly MapObject[] = objectsOf("bench", v),
  taken?: (key: string) => boolean): { x: number; z: number; yaw: number; key: string } | null {
  const b = benches.find(p => Math.hypot(p.x - x, p.z - z) < range);
  if (!b) return null;
  const d0 = slotReach(b, 0, x, z, taken), d1 = slotReach(b, 1, x, z, taken);
  if (d0 === Infinity && d1 === Infinity) return null;
  const slot = d1 < d0 ? 1 : 0, yaw = b.yaw ?? 0, off = BENCH_SLOTS[slot];
  const front = (x - b.x) * Math.sin(yaw) + (z - b.z) * Math.cos(yaw) >= 0;
  return { x: b.x + Math.cos(yaw) * off, z: b.z - Math.sin(yaw) * off, yaw: yaw + (front ? 0 : Math.PI), key: benchSlotKey(b.id, slot) };
}
/** How far a bench slot is from (x, z); Infinity while someone else (a player's claim, a resident) holds it. */
function slotReach(b: MapObject, slot: 0 | 1, x: number, z: number, taken?: (key: string) => boolean): number {
  const key = benchSlotKey(b.id, slot);
  if (taken?.(key) || benchHeld.has(key)) return Infinity;
  const yaw = b.yaw ?? 0, off = BENCH_SLOTS[slot];
  return Math.hypot(b.x + Math.cos(yaw) * off - x, b.z - Math.sin(yaw) * off - z);
}

export const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/** The body's footprint: 5 probe points, the centre and 0.2 out along each axis. */
export const PROBE: readonly (readonly [number, number])[] = [[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]];
const NONE: readonly never[] = [];

/**
 * Solid footprints of the running seasonal event's decorations (world XZ),
 * blocked like buildings. Not map objects: SeasonalEvents.tsx sets them while
 * an event is up and clears them when it comes down.
 */
export const eventSolids: { x0: number; x1: number; z0: number; z1: number }[] = [];

export interface VillageIsland {
  map: Village["map"];
  ground: (x: number, z: number) => number;
  surface: (x: number, z: number) => number;
  standable: (x: number, z: number) => boolean;
  move: (fromX: number, fromZ: number, toX: number, toZ: number) => [number, number];
  /** Water with no land or deck (lib/game/movement's `wet`). */
  wet: (x: number, z: number) => boolean;
  /** The highest thing at a point: ground, a prop's top, Infinity for a building, trunk or study furniture (movement's `top`). */
  top: (x: number, z: number) => number;
  /**
   * The smooth world only (v.terrain; specs/world-editor.md): whether a step may go from (x, z) to (nx, nz) by the
   * slope (false up onto ground steeper than MAX_CLIMB), and whether ground is too steep to stand and jump on. The
   * movement sim and the residents' paths ask these; a cell world has neither (its levels decide).
   */
  climb?: (x: number, z: number, nx: number, nz: number) => boolean;
  steep?: (x: number, z: number) => boolean;
  /**
   * The smooth world only (lib/game/barriers.ts releaseRegions): land behind a barrier that walking from the spawn
   * can't reach, a wall to every move (movement's `locked`); and land walking does reach, the only ground a splash
   * brings you back to (movement's `released`).
   */
  locked?: (x: number, z: number) => boolean;
  released?: (x: number, z: number) => boolean;
}

/** The jetty deck's walk height on the smooth world (the pier model's deck top): the quay stands at it (lib/game/world/convert.ts). */
export const DECK_Y = 0;

/** How deep the smooth world's shallows are waded (David, R2b: "can dip toes in"): a step or two out from any shore, never across a river. */
export const WADE = 0.25;
/** The shallows this near a deck are under or beside its raised boards: water, never waded (no stepping off a deck's edge into them). */
const DECK_SHALLOWS = 1.5;

/** Walking on a village: ground height, solids and the stepping rule, from its map and objects. */
export function islandOf(v: Village): VillageIsland {
  const { map, field, terrain } = v;
  const decks: Deck[] = [...wharfDecks(v), ...barDecks(v), ...bridgeDecks(v).map(r => ({ ...r, y: () => DECK_Y }))];
  // The smooth world walks its heightfield (the drawn ground); a deck over its water is walked at the deck's height.
  // The wharf's board squares, each level at the ground under its middle (as deckPieces lays its tile), walked to their drawn edge.
  const squares = terrain ? objectsOf("deck", v).map(o => ({ x: o.x, z: o.z, yaw: o.yaw ?? 0, y: terrainHeight(terrain, o.x, o.z) })) : [];
  // Their bound, padded by a square's corner and the shallows, so a point far from the wharf skips them.
  const reach = DECK_SQUARE_HALF * Math.SQRT2 + DECK_SHALLOWS, xs = squares.map(q => q.x), zs = squares.map(q => q.z);
  const box = { x0: Math.min(...xs) - reach, x1: Math.max(...xs) + reach, z0: Math.min(...zs) - reach, z1: Math.max(...zs) + reach };
  const near = (x: number, z: number, pad: number) => decks.some(r => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad)
    || (inRect(x, z, box) && squares.some(q => inFootprint(x, z, q, q.yaw, DECK_SQUARE_HALF + pad, DECK_SQUARE_HALF + pad)));
  const deckY = (x: number, z: number) => {
    const d = decks.find(r => inRect(x, z, r));
    if (d) return d.y(x, z);
    const q = squares.find(q => inFootprint(x, z, q, q.yaw, DECK_SQUARE_HALF, DECK_SQUARE_HALF));
    return q ? q.y : null;
  };
  const ground = terrain
    ? (x: number, z: number) => {
      const h = terrainHeight(terrain, x, z), d = deckY(x, z);
      return d === null ? h : Math.max(h, d);
    }
    : (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = terrain ? (x: number, z: number) => terrainSurface(terrain, x, z) : (x: number, z: number) => drawnSurfaceAt(map, x, z);
  const rails = bridgeRails(v);
  // Buildings: the landmarks with a footprint and the residents' houses.
  // On the smooth world, each its walls' box, turned and scaled with it (BUILDING_SOLID).
  const wall = (id: LandmarkId | "house", o: { x: number; z: number; yaw?: number; scale?: number }) => {
    const [cx, cz, hw, hd] = BUILDING_SOLID[id]!, k = o.scale ?? 1, [dx, dz] = turn(cx * k, cz * k, o.yaw);
    return { x: o.x + dx, z: o.z + dz, yaw: o.yaw ?? 0, hw: hw * k, hd: hd * k };
  };
  const solids = terrain
    ? [...landmarks(v).filter(l => l.half).map(l => BUILDING_SOLID[l.id] ? wall(l.id, l) : { x: l.x, z: l.z, yaw: 0, hw: l.half![0], hd: l.half![1] }), ...objectsOf("house", v).map(o => wall("house", o))]
    : [...landmarks(v).filter(l => l.half).map(l => ({ x: l.x, z: l.z, yaw: 0, hw: l.half![0], hd: l.half![1] })),
      ...objectsOf("house", v).map(o => { const [hw, hd] = houseHalf(o.yaw, o.scale); return { x: o.x, z: o.z, yaw: 0, hw, hd }; })];
  // The natural barriers standing at this drop (lib/game/barriers.ts): solid like a building, never jumped.
  const barriers = barrierBoxes(barrierPlacements(v));
  // A prop's top stands on the ground under it: the smooth world's ground is anywhere from the sea to the summit (the
  // plaza at 3, the wharf at 1). The village's cells keep tops over their own zero.
  const props = [...propsOf(v).flatMap(o => {
    const f = propFootprint(o), base = terrain ? ground(o.x, o.z) : 0;
    if (!f) return [];
    const [dx, dz] = turn(f[2], f[3], o.yaw);
    return [{ x: o.x + dx, z: o.z + dz, yaw: o.yaw ?? 0, hw: f[0], hd: f[1], top: base + (PROP_TOP[o.model!] ?? Infinity) * (o.scale ?? 1), round: ROUND_PROPS.has(o.model!) }];
  }), ...fenceSolids(objectsOf("fence", v).filter(isJoinedFence)),
    // The smooth world's campfire: its stone ring, round, never climbed.
    ...(terrain ? objectsOf("campfire", v).map(o => { const r = FIRE_PIT_RING * (o.scale ?? 1); return { x: o.x, z: o.z, yaw: 0, hw: r, hd: r, top: Infinity, round: true }; }) : []),
    // The lamps' posts (the hand lantern has none): never climbed.
    ...objectsOf("lamp", v).flatMap(o => { const post = NEW_LAMPS[o.model as keyof typeof NEW_LAMPS]?.post; return post ? [{ x: o.x, z: o.z, yaw: 0, hw: post, hd: post, top: Infinity }] : []; })];
  // Trees and props by 4-unit bucket (numeric keys), so a painted island with hundreds of them walks as cheaply as a small one.
  const buckets = <T extends { x: number; z: number }>(items: readonly T[]) => {
    const grid = new Map<number, T[]>();
    for (const it of items) {
      const k = Math.floor(it.x / 4) * 4096 + Math.floor(it.z / 4), b = grid.get(k);
      if (b) b.push(it); else grid.set(k, [it]);
    }
    return grid;
  };
  const propGrid = buckets(props), treeGrid = buckets(objectsOf("tree", v));
  const onDeck = (x: number, z: number) => near(x, z, 0);
  const wet = terrain
    ? (x: number, z: number) => {
      if (onDeck(x, z)) return false;
      const h = terrainHeight(terrain, x, z);
      return h <= terrain.seaLevel - WADE || (h < terrain.seaLevel && near(x, z, DECK_SHALLOWS));
    }
    : (x: number, z: number) => !onDeck(x, z) && !isGroundAtWorld(map, x, z);
  /** The smooth world's slope rule: no step up onto ground too steep to climb. */
  const steep = terrain ? (x: number, z: number) => !onDeck(x, z) && terrainSteepness(terrain, x, z) > MAX_CLIMB : undefined;
  const climb = steep ? (x: number, z: number, nx: number, nz: number) => !(ground(nx, nz) > ground(x, z) + 1e-4 && steep(nx, nz)) : undefined;
  /** Top of the solid at a point: a prop's measured top, Infinity for buildings, study furniture and trunks, -Infinity for none. */
  const solidTop = (x: number, z: number) => {
    if (solids.some(l => inFootprint(x, z, l, l.yaw, l.hw, l.hd)) || eventSolids.some(r => inRect(x, z, r)) || rails.some(r => inRect(x, z, r))
      || inBarrier(barriers, x, z)) return Infinity;
    let top = -Infinity, trunk = false;
    const bx = Math.floor(x / 4), bz = Math.floor(z / 4);
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const k = (bx + ox) * 4096 + bz + oz;
      for (const p of propGrid.get(k) ?? NONE) if ("round" in p && p.round ? Math.hypot(x - p.x, z - p.z) < p.hw : inFootprint(x, z, p, p.yaw, p.hw, p.hd)) top = Math.max(top, p.top);
      for (const t of treeGrid.get(k) ?? NONE) if (Math.hypot(t.x - x, t.z - z) < TREE_TRUNK) trunk = true;
    }
    if (top === Infinity || studySolid("village", x, z, 0, v)) return Infinity;
    return trunk ? Infinity : top;
  };
  // A solid on a deck stands in the way too (the fish market on the wharf's boards); the village's cells keep their old rule.
  const standable = (x: number, z: number) => (!terrain && onDeck(x, z)) || (!wet(x, z) && solidTop(x, z) === -Infinity);
  /** How much of the body (5 probe points) stands on free ground; 5 = fits. */
  const clearance = (x: number, z: number) => {
    let n = 0;
    for (const [dx, dz] of PROBE) if (standable(x + dx, z + dz)) n++;
    return n;
  };
  const canStep = (x: number, z: number, nx: number, nz: number) => {
    // Never lose clearance: out in the open every step must fit; sitting on a bench leaves you inside
    // its footprint, and from there any step that frees as much or more of you walks you off it.
    if (clearance(nx, nz) < clearance(x, z)) return false;
    if (climb) return climb(x, z, nx, nz);
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z), ncx = worldToCellX(map, nx), ncz = worldToCellZ(map, nz);
    // A ramp climbs a full cliff: on or onto one, follow its slope rather than the level rule (not up its side).
    if (rampRun(map, cx, cz) || rampRun(map, ncx, ncz)) return Math.abs(ground(nx, nz) - ground(x, z)) < 0.5;
    return Math.abs(levelAt(map, ncx, ncz) - levelAt(map, cx, cz)) < CLIFF_LEVELS;
  };
  const move = (fromX: number, fromZ: number, toX: number, toZ: number): [number, number] => {
    const count = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 0.15));
    const dx = (toX - fromX) / count, dz = (toZ - fromZ) / count;
    let x = fromX, z = fromZ;
    for (let i = 0; i < count; i++) {
      if (canStep(x, z, x + dx, z + dz)) { x += dx; z += dz; }
      else if (canStep(x, z, x + dx, z)) x += dx;
      else if (canStep(x, z, x, z + dz)) z += dz;
      else break;
    }
    return [x, z];
  };
  // Over the smooth world's water its top is the water's surface, not the seabed: a fall into the sea splashes there
  // (the splash shows on the water, and a body never sinks below the realtime room's floor, protocol AREA_BOUNDS).
  const top = (x: number, z: number) => {
    const g = ground(x, z);
    return Math.max(terrain && g < terrain.seaLevel && wet(x, z) ? terrain.seaLevel : g, solidTop(x, z));
  };
  if (!terrain) return { map, ground, surface, standable, move, wet, top };
  // What the barriers close off, measured once, on the first ask (a few tens of ms: not for an island nobody walks).
  let regions: ReturnType<typeof releaseRegions> | undefined;
  const region = () => (regions === undefined ? (regions = releaseRegions(terrain, wet, barriers, villageSpawnPoint(v))) : regions);
  const locked = (x: number, z: number) => region()?.locked(x, z) ?? false;
  const released = (x: number, z: number) => region()?.released(x, z) ?? true;
  return { map, ground, surface, standable, move, wet, top, climb, steep, locked, released };
}

const islands = new WeakMap<Village, VillageIsland>();
/** The member island's walker, built once per loaded map. */
export function villageIsland(v: Village = village()): VillageIsland {
  let island = islands.get(v);
  if (!island) islands.set(v, island = islandOf(v));
  return island;
}

/** Places a later drop opens, kept off the maps until then (lib/game/drops.ts): the ruins gate, the Oracle temple. */
export const UNLISTED: ReadonlySet<string> = new Set([...(DROPS.combat ? [] : ["ruins"]), ...(DROPS.oracle ? [] : ["oracle"])]);
/** Half the smooth world's sun shadow box, which follows the player (a 2048 map: about 5 cm a texel). */
export const SHADOW_FOLLOW_EXTENT = 48;
/** How far the smooth world's map reaches past its open landmarks. */
const MAP_MARGIN = 14;

/**
 * Everything that scales with the island (archive/village/island-painter.md §7), from the
 * map's land bounds. The shipped 47×39 island gives exactly the numbers these
 * replaced: shadow ±26, clouds 46×38, overview (12, 21, −27), glints to 90,
 * minimap "-26 -22 52 47". Shadows and clouds stay centred on the world origin
 * (the map is), so they reach the land's farthest edge from it.
 */
export function villageScale(v: Village = village()) {
  const { map, bounds: b } = v, deck = wharfDeck(v);
  const reachX = Math.max(-b.minX, b.maxX), reachZ = Math.max(-b.minZ, b.maxZ);
  /** How much bigger than the shipped island, for the overview camera. */
  const k = Math.max(1, b.halfW / 23.5, b.halfD / 19.5);
  const offset: [number, number, number] = [12 * k, 21 * k, -27 * k];
  const further = Math.hypot(12, 21, 27) * (k - 1);
  // The minimap frames the land and the wharf deck with a 2.5 margin. The smooth world is far bigger than what's open
  // on it, so there it frames the open area: the landmarks listed at this drop and the spawn, with a margin.
  const open = v.terrain ? [...landmarks(v).filter(l => !UNLISTED.has(l.id)), ...objectsOf("spawn", v)] : [];
  const frame = open.length
    ? { minX: Math.min(...open.map(o => o.x)) - MAP_MARGIN, maxX: Math.max(...open.map(o => o.x)) + MAP_MARGIN, minZ: Math.min(...open.map(o => o.z)) - MAP_MARGIN, maxZ: Math.max(...open.map(o => o.z)) + MAP_MARGIN }
    : b;
  const x0 = Math.round(Math.min(frame.minX, deck?.x0 ?? Infinity) - 2.5), x1 = Math.round(Math.max(frame.maxX, deck?.x1 ?? -Infinity) + 2.5);
  const z0 = Math.round(Math.min(frame.minZ, deck?.z0 ?? Infinity) - 2.5), z1 = Math.round(Math.max(frame.maxZ, deck?.z1 ?? -Infinity) + 2.5);
  return {
    // The smooth world's box follows the player (IslandAtmosphere shadowFollow) instead of holding the whole island.
    shadowExtent: v.terrain ? SHADOW_FOLLOW_EXTENT : Math.max(reachX, reachZ) + 2.5,
    cloudSize: [2 * reachX - 1, 2 * reachZ - 1] as [number, number],
    overview: { focus: [b.cx, 0, b.cz] as [number, number, number], offset, far: 120 + further },
    /** Extra fog distance in the overview, on top of the phase's (+28 near, +15 far). */
    overviewFog: further,
    /** Glints reach this far from the map's centre (the fog). */
    glintRadius: 58 + Math.max(map.width, map.depth) / 2,
    minimap: { x0, x1, z0, z1 },
  };
}
