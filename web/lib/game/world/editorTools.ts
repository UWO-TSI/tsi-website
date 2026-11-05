/**
 * The world editor's hotbar and palette (specs/world-editor.md decisions 2 and 10): Minecraft creative mode. Nine
 * slots on the hotbar (1–9); E opens the palette, where any item can be put in the selected slot. An item is a
 * terrain tool, a paint, a road, something to place (a building, a house, nature, a prop, a marker) or select.
 * Pure: the editor's UI and the tests share it.
 */
import { RESIDENT_ANCHORS } from "@/lib/content/residents";
import { BARRIERS, BARRIER_MODELS } from "../barriers";
import { HOUSE_MODELS, LANDMARK_INFO, TREE_SLOTS, type LandmarkId } from "../defaultIsland";
import { JOINED_FENCE } from "../fences";
import { SCENERY_URLS } from "../propModels";
import { ROCK_MODELS } from "../rocks";
import type { MapObject, ObjectKind } from "../villageMap";
import type { BrushTool } from "./brushes";
import { PAINT_NAMES, Paint } from "./terrain";

export type EditorItem =
  | { type: "brush"; tool: Exclude<BrushTool, "paint">; label: string }
  | { type: "paint"; paint: number; label: string }
  | { type: "road"; paint: number; label: string }
  | { type: "place"; object: Pick<MapObject, "kind"> & Partial<Pick<MapObject, "id" | "model" | "seed">>; label: string; building?: boolean }
  | { type: "select"; label: string };

const brush = (tool: Exclude<BrushTool, "paint">, label: string): EditorItem => ({ type: "brush", tool, label });
const place = (kind: ObjectKind, label: string, extra: Partial<Pick<MapObject, "id" | "model" | "seed">> = {}, building = false): EditorItem => ({ type: "place", object: { kind, ...extra }, label, building });

/** Buildings: the landmarks with a footprint (one of each on a map: placing one again moves it) and the houses. */
const LANDMARK_BUILDINGS: readonly LandmarkId[] = ["hq", "shop", "cafe", "museum", "oracle", "monument", "mailbox", "notice", "catch"];

export const PALETTE: readonly { group: string; items: readonly EditorItem[] }[] = [
  { group: "Terrain", items: [brush("raise", "Raise"), brush("lower", "Lower"), brush("smooth", "Smooth"), brush("flatten", "Flatten"), brush("level", "Level"), brush("roughen", "Roughen"), brush("erode", "Erode")] },
  { group: "Paint", items: PAINT_NAMES.map((name, paint) => ({ type: "paint", paint, label: name[0].toUpperCase() + name.slice(1) }) as EditorItem) },
  { group: "Roads", items: [{ type: "road", paint: Paint.Path, label: "Dirt road" }, { type: "road", paint: Paint.Stone, label: "Stone road" }] },
  {
    group: "Buildings",
    items: [
      ...LANDMARK_BUILDINGS.map(id => place("landmark", LANDMARK_INFO[id].label, { id }, true)),
      ...HOUSE_MODELS.map(m => place("house", `House (${m.slice(7)})`, { model: m }, true)),
      place("landmark", "Wharf", { id: "wharf" }),
    ],
  },
  {
    group: "Nature",
    items: [
      ...["Oak", "Oak (b)", "Blossom", "Cedar"].slice(0, TREE_SLOTS).map((n, seed) => place("tree", `Tree: ${n}`, { seed })),
      place("bush", "Bush"), place("flower", "Flowers"),
      ...ROCK_MODELS.map(m => place("rock", m.replace("boulder-", "Rock: "), { model: m })),
    ],
  },
  {
    group: "Props",
    items: [
      place("bench", "Bench", { model: "bench-wood" }), place("lamp", "Lamp"),
      // The connectable fence: posts on whole cells join the posts beside them (lib/game/fences.ts).
      place("fence", "Fence", { model: JOINED_FENCE }),
      place("bridge", "Bridge"), place("campfire", "Campfire"), place("study", "Study table", { model: "picnic" }),
      place("study", "Study table (classic)", { model: "picnic-classic" }),
      ...BARRIER_MODELS.map(m => place("barrier", `Barrier: ${BARRIERS[m].label}`, { model: m })),
    ],
  },
  {
    group: "Markers",
    items: [
      place("spawn", "Spawn"), place("gather", "Ceremony spot"), place("puddle", "Puddle"),
      place("bug", "Bug spot", { model: "ground" }), place("bug", "Bug spot: water's edge", { model: "water_edge" }), place("shell", "Shell"), place("bottle", "Bottle spot"), place("fitting", "Fitting room"), place("missions", "Mission board"),
      place("landmark", "Plaza", { id: "plaza" }), place("landmark", "Beach", { id: "beach" }), place("landmark", "Ruins gate", { id: "ruins" }),
    ],
  },
  // The scenery props by model (lib/game/propModels.ts SCENERY_URLS: the wharf's market, the beach, the plants), and the
  // fish market's two boards (one each: placing again moves it).
  {
    group: "Scenery props",
    items: [
      place("board", "Market catch board", { id: "catch" }), place("board", "Market task board", { id: "tasks" }),
      ...Object.keys(SCENERY_URLS).sort().map(m => place("prop", m, { model: m })),
    ],
  },
  // The residents' anchors by the ids their schedules name (lib/content/residents.ts): one each, placing again moves it.
  { group: "Anchors", items: Object.entries(RESIDENT_ANCHORS).map(([id, a]) => place("anchor", `Anchor: ${a.label}`, { id })) },
  { group: "Select", items: [{ type: "select", label: "Select · move · rotate · scale · delete" }] },
];

/** The hotbar as it starts: raise, lower, smooth, flatten, level, paint path, road, a house, select. */
export const DEFAULT_HOTBAR: readonly EditorItem[] = [
  PALETTE[0].items[0], PALETTE[0].items[1], PALETTE[0].items[2], PALETTE[0].items[3], PALETTE[0].items[4],
  PALETTE[1].items[Paint.Path], PALETTE[2].items[0], PALETTE[3].items.find(i => i.type === "place" && i.object.kind === "house")!, PALETTE.at(-1)!.items[0],
];

/** Where the hotbar is kept between visits (this browser). */
export const HOTBAR_KEY = "lab-world-hotbar-v1";

/** A hotbar from storage (labels matched against the palette), falling back to the default slot by slot. */
export function hotbarFrom(saved: unknown): EditorItem[] {
  const all = PALETTE.flatMap(g => g.items);
  return DEFAULT_HOTBAR.map((d, i) => {
    const label = Array.isArray(saved) && typeof saved[i] === "string" ? saved[i] : null;
    return (label && all.find(item => item.label === label)) || d;
  });
}

/** The world map's building scale (/lab/map's WORLD_BUILDING_SCALE). */
export const WORLD_BUILDING_SCALE = 1.15;

/**
 * Unique ids: a landmark, a resident anchor or a market board is its own id (one each), the default spawn, the fitting
 * room and the mission board are single; anything else is `placed-N`, never one of the generator's ids (deck-N, house-N).
 */
export function idFor(item: Extract<EditorItem, { type: "place" }>, objects: readonly MapObject[]): string {
  const { kind, id } = item.object;
  if ((kind === "landmark" || kind === "anchor" || kind === "board") && id) return id;
  if ((kind === "spawn" || kind === "fitting" || kind === "missions") && !objects.some(o => o.kind === kind && o.id === (kind === "spawn" ? "default" : kind))) return kind === "spawn" ? "default" : kind;
  const taken = new Set(objects.filter(o => o.kind === kind).map(o => o.id));
  let n = 0;
  while (taken.has(`placed-${n}`)) n++;
  return `placed-${n}`;
}

/**
 * An object as the editor leaves it: changed and pinned (David's: the generator's re-layout keeps it). The first change
 * to one the generator placed notes where it stood (`of`), so the re-layout knows which of its objects this one is.
 */
export const pinned = (o: MapObject, patch: Partial<MapObject> = {}): MapObject => ({ ...o, ...patch, pin: true, ...(o.pin ? {} : { of: [o.x, o.z] as [number, number] }) });

/** A prop's scale as the world already uses it (the market's barrels stand at 0.07 of their model), 1 for a new model. */
export const propScaleOf = (model: string | undefined, objects: readonly MapObject[]) => objects.find(o => o.kind === "prop" && o.model === model && o.scale)?.scale ?? 1;

/**
 * Place a palette item at (x, z), pinned (David's, kept by the generator's re-layout): a new object, or for a landmark,
 * anchor or board already on the map, that one moved here (one of each). A tree's seed keeps its model and varies its turn; a house, a building or a prop keeps the ghost's yaw.
 */
export function placeItem(item: Extract<EditorItem, { type: "place" }>, objects: readonly MapObject[], x: number, z: number, yaw = 0, seed = Math.random()): MapObject[] {
  const { kind, model } = item.object, id = idFor(item, objects);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const extra: Partial<MapObject> = {};
  if (model) extra.model = model;
  if (kind === "prop" && propScaleOf(model, objects) !== 1) extra.scale = propScaleOf(model, objects);
  if (kind === "tree") extra.seed = (item.object.seed ?? 0) + TREE_SLOTS * Math.floor(seed * 3);
  else if (kind === "bush" || kind === "flower") extra.seed = Math.floor(seed * 32);
  if (yaw && kind !== "tree" && kind !== "bush" && kind !== "flower") extra.yaw = r(yaw);
  // The world map runs its big buildings a touch larger (as /lab/map places them on it).
  if (kind === "landmark" && id !== "wharf" && (LANDMARK_INFO[id as LandmarkId]?.half?.[0] ?? 0) > 1) extra.scale = WORLD_BUILDING_SCALE;
  const existing = objects.findIndex(o => o.kind === kind && o.id === id);
  if (existing >= 0) return objects.map((o, i) => (i === existing ? pinned(o, { x: r(x), z: r(z), ...(yaw ? { yaw: r(yaw) } : {}) }) : o));
  return [...objects, { id, kind, x: r(x), z: r(z), ...extra, pin: true }];
}
