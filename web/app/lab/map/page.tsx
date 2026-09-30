"use client";

/**
 * /lab/map — the island painter (M6; rows 241, 246, specs/island-painter.md).
 *
 * WHY THIS EXISTS. Six of the last eight terrain changes were David describing
 * what he wanted and me guessing at numbers in `author-elevation.mjs`: "less
 * hills", "too vertical", "half steps should blend", each one a round trip
 * through a script, a regenerate and a screenshot. This turns that into
 * drawing. Since 2026-09-28 it paints the real village: David places every
 * building, tree and prop himself, and the game loads exactly what is painted.
 *
 * It opens the SHIPPED `web/data/village-map.json` (the legacy
 * `island-map.json` draft is still openable), so what you paint is what loads.
 * Export puts the whole document on the clipboard, following the "Export all →
 * clipboard" convention in `components/lab/LabPanel.tsx`: no API route, no
 * write path to disk, which keeps a dev tool from being able to corrupt the
 * world. "Walk it" opens the working draft in 3D at `/lab/island?draft=1`.
 *
 * THE CHECKS ARE THE POINT. A hand-painted map breaks in ways that are invisible
 * until you walk it: an unreachable terrace, a cliff with no piece, a landmark
 * on water, a resident anchor with no room. The panel runs `lib/game/mapHealth.ts`
 * on every edit, and `villageMap.test.ts` asserts the same function on the
 * shipped file: if it says healthy, pasting the export keeps the suite green.
 *
 * ORIENTATION. The default view is the game's: camera forward (+z, west) at the
 * top and +x on the left, so north (−x) is on the right, as on the minimap.
 * The raw view keeps cell (0, 0) at the top left.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import islandMapDoc from "@/data/island-map.json";
import villageDoc from "@/data/village-map.json";
import {
  serialiseIslandMap,
  resizeMap,
  legaliseTerraces,
  setCell,
  levelAt,
  surfaceAt,
  isVoid,
  isRiver,
  isRamp,
  needsCliff,
  cliffPieceFor,
  rampDir,
  halfCliffEdges,
  Surface,
  MAX_LEVEL,
  CLIFF_LEVELS,
  ORTHOGONAL,
  inBounds,
  type IslandMap,
  type IslandMapDoc,
  type PlacedProp,
  type MapAnnotation,
} from "@/lib/game/grid";
import {
  PAINTER_DRAFT_KEY, normaliseSea, parseVillage, serialiseVillage, villageJson, villageOf,
  type MapObject, type ObjectKind, type VillageDoc,
} from "@/lib/game/villageMap";
import { LANDMARK_IDS, LANDMARK_INFO, PROP_FOOTPRINT, TREE_TRUNK, objectFootprint, type LandmarkId } from "@/lib/game/defaultIsland";
import { villageHealth, type VillageHealth } from "@/lib/game/mapHealth";
import { mapBudget } from "@/lib/game/mapBudget";
import { classifyWater, WATER_CLASS } from "@/lib/game/fishingSpots";
import { cellsInPolygon, nextObjectId, organicCell, snapPlacement, snapshotCells, type CellSnapshot, type OrganicOp } from "@/lib/game/painterTools";
import { RESIDENT_ANCHORS, SHARED_SPACING } from "@/lib/content/residents";
import { FURNITURE, type Furniture } from "@/lib/study/seats";
import { DEFAULT_TABLES } from "@/lib/study/tables";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
/** The pre-village autosave (legacy island-map.json edits); offered under "open" if present. */
const LEGACY_DRAFT_KEY = "lab-map-draft-v1";

/** Cell colours, close enough to the world's own palette to read as the map. */
const SURFACE_FILL: Record<number, string> = {
  [Surface.Grass]: "#8FA16C",
  [Surface.Soil]: "#BA9664",
  [Surface.Stone]: "#B0ACA6",
  [Surface.Sand]: "#E2CB93",
  [Surface.Wood]: "#A0784E",
  [Surface.Brick]: "#BA7A68",
  [Surface.River]: "#4A85A8",
  [Surface.Void]: "#1b2733",
  [Surface.Ramp]: "#D8CFC0",
};
/** The open sea, told from river and pond by connectivity (fishingSpots.classifyWater). */
const SEA_FILL = "#2c5a78";

const SURFACE_NAME: Record<number, string> = {
  [Surface.Grass]: "grass",
  [Surface.Soil]: "soil",
  [Surface.Stone]: "stone",
  [Surface.Sand]: "sand",
  [Surface.Wood]: "wood",
  [Surface.Brick]: "brick",
  [Surface.River]: "water",
  [Surface.Ramp]: "ramp",
};

const TOOLS = ["land", "sea", "raise", "lower", "flat", "surface", "ramp", "smooth", "grow", "shrink", "jitter", "object", "prop", "label"] as const;
type Tool = (typeof TOOLS)[number];
const ORGANIC: readonly Tool[] = ["smooth", "grow", "shrink", "jitter"];

const TOOL_HELP: Record<Tool, string> = {
  land: "water → grass at level 0. The coastline brush.",
  sea: "back to open water (river at level 0 is the sea).",
  raise: "+1 level. Land only.",
  lower: "−1 level. Land only.",
  flat: "set an exact level. How you draw a plateau.",
  surface: "paint a surface, terrain untouched.",
  ramp: "mark a ramp cell. It climbs toward the higher neighbour.",
  smooth: "rounds off jaggies: the 3×3 majority decides land or water, stray levels join their neighbours.",
  grow: "spreads land into the sea and plateaus outward, one cell per stroke.",
  shrink: "pulls coasts and plateaus back, one cell per stroke.",
  jitter: "breaks a straight coastline into small bays and headlands. Each stroke rolls new noise.",
  object: "place, select, drag. R turns (shift: 15°), Delete removes, arrows nudge, Esc deselects.",
  prop: "planning markers (legacy): drag a rectangle for a plot, click for a point. The game does not read these; use objects.",
  label: "paint a named thing of your own: fencing, hedges, a note. Terrain untouched.",
};

/**
 * Colours offered for a new label. Chosen to stay legible over grass, sand and
 * water, since a label is useless if it disappears into the ground it marks.
 */
const LABEL_COLORS = ["#ff4d6d", "#ffa62b", "#ffe066", "#7bf1a8", "#4cc9f0", "#b892ff", "#ffffff", "#1b1b1b"];

/**
 * WHERE a tool applies, independent of WHAT it does.
 *
 * David, 2026-07-30: this is for blocking out space — island structures,
 * building plots, pathways — not for pixel-perfect work. A round brush is the
 * wrong instrument for a rectangular plot or a straight road, and dabbing one
 * out cell by cell is how you get a wobbly blob that reads as an accident.
 */
const SHAPES = ["free", "rect", "line", "fill", "lasso"] as const;
type Shape = (typeof SHAPES)[number];

const SHAPE_HELP: Record<Shape, string> = {
  free: "brush, follows the cursor",
  rect: "drag a rectangle, fills on release",
  line: "drag a straight run, snapped to 8 directions",
  fill: "click to flood the matching region",
  lasso: "draw a loop freehand, fills inside on release",
};

/** Legacy planning marker kinds (island-map.json). */
const PROP_KINDS = ["building", "npc", "tree", "bush", "flower", "lamp", "spawn", "note"] as const;
const PROP_COLOR: Record<string, string> = {
  building: "#ff8f4a", npc: "#d98fff", tree: "#3f8f4f", bush: "#5aab5f", flower: "#ff7fa8", lamp: "#ffd166", spawn: "#4ad8ff", note: "#ffffff",
};

/** How each object kind reads on the map. */
const OBJECT_STYLE: Record<ObjectKind, { color: string; r: number; label: string }> = {
  spawn: { color: "#4ad8ff", r: 0.55, label: "spawn" },
  landmark: { color: "#ff8f4a", r: 0.6, label: "landmark" },
  fitting: { color: "#e59ad8", r: 0.5, label: "fitting room" },
  missions: { color: "#c9a26b", r: 0.5, label: "mission board" },
  bridge: { color: "#a0784e", r: 0.6, label: "bridge" },
  lamp: { color: "#ffd166", r: 0.3, label: "lamp" },
  fence: { color: "#7a5a3a", r: 0.3, label: "fence" },
  bench: { color: "#9b6b40", r: 0.4, label: "bench" },
  rock: { color: "#8d8a84", r: 0.45, label: "rock" },
  tree: { color: "#2f6b3a", r: TREE_TRUNK, label: "tree" },
  bush: { color: "#4f9a55", r: 0.45, label: "bush" },
  flower: { color: "#ff7fa8", r: 0.35, label: "flowers" },
  study: { color: "#d4b483", r: 0.5, label: "study table" },
  anchor: { color: "#b892ff", r: 0.45, label: "resident anchor" },
  gather: { color: "#8a6ad8", r: 0.25, label: "ceremony spot" },
  puddle: { color: "#9fc7df", r: 0.4, label: "puddle" },
  bug: { color: "#f0e36c", r: 0.22, label: "bug spot" },
  shell: { color: "#fff5e0", r: 0.22, label: "shell" },
  bottle: { color: "#7fe0d8", r: 0.25, label: "bottle spot" },
};
/** Placement palette order. */
const PALETTE: readonly ObjectKind[] = ["landmark", "tree", "bush", "flower", "rock", "bench", "fence", "lamp", "bridge", "study", "anchor", "gather", "spawn", "fitting", "missions", "puddle", "bug", "shell", "bottle"];
const ROCK_MODELS = Object.keys(PROP_FOOTPRINT).filter((m) => m.startsWith("rock-"));
const FENCE_MODELS = Object.keys(PROP_FOOTPRINT).filter((m) => m.startsWith("fence-"));
const BUG_BIOMES = ["water_edge", "ground"];
const TREE_NAMES = ["oak", "oak (b)", "blossom", "cedar"];
/** Outdoor study tables the backend expects (`study_tables.anchor`). */
const OUTDOOR_TABLES = DEFAULT_TABLES.filter(t => t.location !== "cafe");

/** Grid sizes offered by the resize control: 64 up to 256 per side. */
const SIZES = [64, 80, 96, 112, 128, 160, 192, 224, 256];

/**
 * Named drafts, so this can hold more than one island.
 *
 * David, 2026-07-30: this page is where the general layout for all future
 * terrain and islands gets drafted. One autosave slot is crash protection, not
 * a library — without named slots, starting a second island destroys the first.
 * A draft is the same document the export writes, so anything saved here can
 * be exported and shipped unchanged.
 */
const LIBRARY_KEY = "lab-map-library-v1";

function readLibrary(): Record<string, IslandMapDoc> {
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, IslandMapDoc>) : {};
  } catch {
    return {};
  }
}

function writeLibrary(lib: Record<string, IslandMapDoc>) {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
  } catch {
    /* quota: the caller already has the map in memory, nothing is lost yet */
  }
}

/**
 * The map lives at module scope, not in state.
 *
 * Editing mutates the typed arrays in place — copying 65k cells per brush dab
 * would be pointless — and the react-compiler lint (correctly) forbids mutating
 * anything that came out of useState or useMemo. So the working copy sits here
 * and `version` is what React actually re-renders on.
 *
 * `source` says which file it came from: the village (the game's) or the legacy
 * island-map.json draft, which exports in its own format.
 */
interface World {
  map: IslandMap;
  props: PlacedProp[];
  annotations: MapAnnotation[];
  objects: MapObject[];
  source: "village" | "legacy";
}
let WORLD: World | null = null;

/** Any document into the working world: one sea convention (Void becomes River at level 0). */
function fromDoc(doc: VillageDoc, source?: World["source"]): World {
  const { map, objects, annotations, props } = parseVillage(doc);
  return { map, objects, annotations, props, source: source ?? (doc.objects ? "village" : "legacy") };
}
function shippedVillage(): World {
  return fromDoc(villageDoc as VillageDoc, "village");
}
function world(): World {
  if (!WORLD) WORLD = shippedVillage();
  return WORLD;
}
/** The working draft as a document: the village format, plus legacy markers so a legacy draft survives a reload. */
function draftDoc(w: World): VillageDoc {
  return { ...serialiseVillage(w.map, w.objects, w.annotations), ...(w.props.length ? { props: w.props } : {}), ...(w.source === "legacy" ? { objects: undefined } : {}) };
}

/**
 * Undo history, also module scope and for the same reason.
 *
 * A snapshot is a full copy of both arrays. At 128² that is 32KB, at 256² it is
 * 131KB, so 80 steps is at worst 10MB — nothing, and it buys an undo that
 * cannot be subtly wrong the way a replayed-operations log can be when a brush
 * clamps at MAX_LEVEL or skips void.
 */
interface Snapshot {
  map: IslandMap;
  props: PlacedProp[];
  annotations: MapAnnotation[];
  objects: MapObject[];
  source: World["source"];
}
const HISTORY_LIMIT = 80;
const UNDO: Snapshot[] = [];
let REDO: Snapshot[] = [];

function snapshot(): Snapshot {
  const { map, props, annotations, objects, source } = world();
  return {
    map: { ...map, levels: map.levels.slice(), surfaces: map.surfaces.slice() },
    props: props.map((p) => ({ ...p, cell: [p.cell[0], p.cell[1]] })),
    annotations: annotations.map((a) => ({ ...a, cells: a.cells.map((c) => [c[0], c[1]] as [number, number]) })),
    objects: objects.map((o) => ({ ...o })),
    source,
  };
}

function restore(s: Snapshot) {
  WORLD = {
    map: { ...s.map, levels: s.map.levels.slice(), surfaces: s.map.surfaces.slice() },
    props: s.props.map((p) => ({ ...p, cell: [p.cell[0], p.cell[1]] as [number, number] })),
    annotations: s.annotations.map((a) => ({ ...a, cells: a.cells.map((c) => [c[0], c[1]] as [number, number]) })),
    objects: s.objects.map((o) => ({ ...o })),
    source: s.source,
  };
}

/** Call BEFORE mutating. Every edit path goes through this or it is not undoable. */
function commit() {
  UNDO.push(snapshot());
  if (UNDO.length > HISTORY_LIMIT) UNDO.shift();
  REDO = [];
}

/** Stroke state for the organic brushes: the map as the stroke began, and the cells already changed. */
let STROKE: { before: CellSnapshot; touched: Uint8Array; seed: number } | null = null;
let STROKE_SEED = 1;

const water = (s: number) => isVoid(s) || isRiver(s);
const keyOf = (o: MapObject) => `${o.kind}:${o.id}`;
/** Kinds the game turns by their yaw. Buildings face the camera (ACNH); nature takes its turn from its seed. */
const TURNS = (o: MapObject) => ["bench", "rock", "fence", "bridge", "study", "missions"].includes(o.kind) || (o.kind === "landmark" && o.id === "wharf");
const turn = (dx: number, dz: number, yaw = 0): [number, number] =>
  [dx * Math.cos(yaw) + dz * Math.sin(yaw), -dx * Math.sin(yaw) + dz * Math.cos(yaw)];
const deg = (rad = 0) => Math.round((rad * 180) / Math.PI * 10) / 10;

/** Local outline (before yaw) of an object's footprint, for drawing and hit tests; null = drawn as a dot. */
function objectOutline(o: MapObject): [number, number][] | null {
  const f = objectFootprint(o);
  return f && [[f.cx - f.hw, f.cz - f.hd], [f.cx + f.hw, f.cz - f.hd], [f.cx + f.hw, f.cz + f.hd], [f.cx - f.hw, f.cz + f.hd]];
}

export default function MapLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const { map, props, annotations, objects, source } = world();
  const [tool, setTool] = useState<Tool>("object");
  const [shape, setShape] = useState<Shape>("free");
  const [view, setView] = useState<"game" | "raw">("game");
  const [dragFrom, setDragFrom] = useState<{ x: number; z: number } | null>(null);
  const [brush, setBrush] = useState(3);
  const [round, setRound] = useState(true);
  const [paintSurface, setPaintSurface] = useState<number>(Surface.Grass);
  const [paintLevel, setPaintLevel] = useState(0);
  const [zoom, setZoom] = useState(9);
  const [hover, setHover] = useState<{ x: number; z: number; u: number; v: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [edited, setEdited] = useState(false);
  const [propKind, setPropKind] = useState<string>("building");
  const [propId, setPropId] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [labelErase, setLabelErase] = useState(false);
  const [library, setLibrary] = useState<string[]>([]);
  const [legacyDraft, setLegacyDraft] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [sheet, setSheet] = useState<"none" | "open" | "import">("none");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [legalised, setLegalised] = useState(0);
  const [placeKind, setPlaceKind] = useState<ObjectKind | "select">("select");
  const [placeId, setPlaceId] = useState("");
  const [placeModel, setPlaceModel] = useState("");
  const [snap, setSnap] = useState(0.5);
  const [selected, setSelected] = useState<string | null>(null);
  const [health, setHealth] = useState<VillageHealth | null>(null);
  const [version, setVersion] = useState(0);
  const painting = useRef(false);
  const lastCell = useRef<{ x: number; z: number } | null>(null);
  const lasso = useRef<[number, number][]>([]);
  const moving = useRef<{ key: string; dx: number; dz: number; committed: boolean } | null>(null);
  /**
   * The authoritative drag origin.
   *
   * `dragFrom` state exists only so the preview and the size readout re-render;
   * it CANNOT be what mouseup reads. mousedown and mouseup can land in the same
   * task — a fast click, or any synthetic event — and React batches the state
   * update, so the mouseup handler would still see the previous render's value
   * and silently drop the whole rectangle. Measured: a 12x11 rect applied zero
   * cells before this ref existed.
   */
  const dragRef = useRef<{ x: number; z: number } | null>(null);

  /** Redraw, and mark the map as diverged from the shipped one. */
  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    setEdited(true);
  }, []);

  /** Redraw WITHOUT marking edited. Only "reload shipped" is clean. */
  const bumpClean = useCallback(() => {
    setVersion((v) => v + 1);
    setEdited(false);
  }, []);

  const selectedObject = objects.find((o) => keyOf(o) === selected) ?? null;

  // Health, the budget and the sea/river/pond classes: a beat after the last edit (a 256² map takes a moment),
  // not on every brush step. `version` stands for mutations inside `map`'s typed arrays, which the linter cannot see.
  const [derived, setDerived] = useState(() => ({ budget: mapBudget(map), waterClass: classifyWater(map) }));
  const { budget, waterClass } = derived;
  useEffect(() => {
    const t = setTimeout(() => {
      setHealth(villageHealth(villageOf(map, objects)));
      setDerived({ budget: mapBudget(map), waterClass: classifyWater(map) });
    }, 250);
    return () => clearTimeout(t);
  }, [map, objects, version]);

  /**
   * Restore the autosaved draft.
   *
   * localStorage is an external store, which is the documented case for reading
   * one in an effect — the lint rule just cannot tell the difference. It has to
   * be an effect rather than lazy init because this page server-renders, and
   * reading storage during render would make the hydrated HTML disagree with the
   * server's.
   */
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(PAINTER_DRAFT_KEY);
      setLegacyDraft(!!window.localStorage.getItem(LEGACY_DRAFT_KEY));
    } catch {
      return;
    }
    if (!saved) return;
    try {
      WORLD = fromDoc(JSON.parse(saved) as VillageDoc);
    } catch {
      return;
    }
    setEdited(true);
    setVersion((v) => v + 1);
  }, []);

  // The saved-draft list, read once. Kept as names only; the documents are big
  // and there is no reason to hold every island in memory to render a list.
  useEffect(() => {
    setLibrary(Object.keys(readLibrary()).sort());
  }, []);

  const saveNow = useCallback(() => {
    try {
      window.localStorage.setItem(PAINTER_DRAFT_KEY, JSON.stringify(draftDoc(world())));
    } catch {
      /* quota or private mode: autosave is a convenience, not a guarantee */
    }
  }, []);

  // Autosave. Debounced, because serialising 256² to JSON on every brush dab
  // would be the slowest thing on the page.
  //
  // Gated on `edited`, and that gate is load-bearing: without it "reload
  // shipped" removes the draft, then this effect fires on the same version bump
  // and writes it straight back, so the reset never survives a refresh and the
  // banner claims a draft that is really just the shipped map.
  useEffect(() => {
    if (!edited) return;
    const t = setTimeout(saveNow, 700);
    return () => clearTimeout(t);
  }, [version, edited, saveNow]);

  const undo = useCallback(() => {
    if (!UNDO.length) return;
    REDO.push(snapshot());
    restore(UNDO.pop()!);
    bump();
  }, [bump]);

  const redo = useCallback(() => {
    if (!REDO.length) return;
    UNDO.push(snapshot());
    restore(REDO.pop()!);
    bump();
  }, [bump]);

  /** Replace the working map wholesale. Undoable, and marks the map dirty. */
  const load = useCallback(
    (next: World) => {
      commit();
      WORLD = next;
      setSelected(null);
      bump();
    },
    [bump]
  );

  /** Create a label and select it. Names are the identity, so they must be unique. */
  const addLabel = useCallback(() => {
    const n = newLabel.trim();
    if (!n) return;
    const w = world();
    if (!w.annotations.some((a) => a.name === n)) {
      commit();
      w.annotations = [...w.annotations, { name: n, color: labelColor, cells: [] }];
      bump();
    }
    setActiveLabel(n);
    setNewLabel("");
  }, [newLabel, labelColor, bump]);

  const saveDraft = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    const lib = readLibrary();
    lib[n] = draftDoc(world());
    writeLibrary(lib);
    setLibrary(Object.keys(lib).sort());
    setSaveName("");
  }, []);

  /** Change one object (undoable). */
  const updateObject = useCallback(
    (key: string, patch: Partial<MapObject>, record = true) => {
      const w = world();
      if (record) commit();
      w.objects = w.objects.map((o) => (keyOf(o) === key ? { ...o, ...patch } : o));
      if (patch.id !== undefined || patch.kind !== undefined) setSelected(`${patch.kind ?? key.split(":")[0]}:${patch.id ?? key.split(":").slice(1).join(":")}`);
      bump();
    },
    [bump]
  );

  const deleteObject = useCallback(
    (key: string) => {
      const w = world();
      commit();
      w.objects = w.objects.filter((o) => keyOf(o) !== key);
      setSelected(null);
      bump();
    },
    [bump]
  );

  /** Snap a world point for an object of this kind (buildings: footprint edges on cell edges). */
  const snapFor = useCallback(
    (kind: ObjectKind, id: string, x: number, z: number): [number, number] => {
      const half = kind === "landmark" && snap > 0 ? LANDMARK_INFO[id as LandmarkId]?.half : undefined;
      return snapPlacement(x, z, snap, half && half[0] > 1 ? half : undefined);
    },
    [snap]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Otherwise "[" typed into the draft-name or prop-id field resizes the
      // brush, and Cmd+Z in a text field undoes the MAP instead of the text.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (!(e.metaKey || e.ctrlKey)) {
        if (e.key === "[") setBrush((b) => Math.max(1, b - 1));
        if (e.key === "]") setBrush((b) => Math.min(16, b + 1));
        const o = selected && world().objects.find((ob) => keyOf(ob) === selected);
        if (o) {
          if (e.key === "Escape") setSelected(null);
          if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteObject(selected!); }
          if (e.key.toLowerCase() === "r" && TURNS(o)) updateObject(selected!, { yaw: ((o.yaw ?? 0) + (e.shiftKey ? Math.PI / 12 : Math.PI / 2)) % (Math.PI * 2) });
          const step = snap || 0.1, flip = view === "game" ? -1 : 1;
          const arrows: Record<string, [number, number]> = { ArrowLeft: [-flip * step, 0], ArrowRight: [flip * step, 0], ArrowUp: [0, -flip * step], ArrowDown: [0, flip * step] };
          if (arrows[e.key]) { e.preventDefault(); updateObject(selected!, { x: Math.round((o.x + arrows[e.key][0]) * 1e6) / 1e6, z: Math.round((o.z + arrows[e.key][1]) * 1e6) / 1e6 }); }
        }
        return;
      }
      if (e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y") return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selected, deleteObject, updateObject, snap, view]);

  const flip = view === "game";
  /** Cell space (cell (x, z) spans [x, x + 1] × [z, z + 1]) → canvas pixels, for text drawn unflipped. */
  const toPx = useCallback(
    (u: number, v: number): [number, number] => (flip ? [(map.width - u) * zoom, (map.depth - v) * zoom] : [u * zoom, v * zoom]),
    [flip, map.width, map.depth, zoom]
  );

  /**
   * Repaint the terrain and objects into an offscreen canvas.
   *
   * Separate from the hover cursor on purpose. At 256² this loop touches 65k
   * cells twice plus every edge; running it on mousemove made the cursor lag.
   * Now it runs only when the map actually changes, and moving the mouse costs
   * one blit. Everything draws in cell space under one transform, so the game
   * view is a flip of the same drawing; text is placed with `toPx`, unflipped.
   */
  const repaint = useCallback(() => {
    const W = map.width;
    const D = map.depth;
    let off = offscreen.current;
    if (!off) {
      off = document.createElement("canvas");
      offscreen.current = off;
    }
    off.width = W * zoom;
    off.height = D * zoom;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const cellSpace = () => ctx.setTransform(flip ? -zoom : zoom, 0, 0, flip ? -zoom : zoom, flip ? W * zoom : 0, flip ? D * zoom : 0);
    const px = (n: number) => n / zoom;
    // World → cell space.
    const cellU = (x: number) => x - map.originX + 0.5;
    const cellV = (z: number) => z - map.originZ + 0.5;
    const text = (s: string, u: number, v: number, color = "#fff", align: CanvasTextAlign = "center") => {
      if (zoom < 4) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const [x, y] = toPx(u, v);
      ctx.font = `${Math.max(9, zoom * 1.05)}px ${mono}`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(s, x, y);
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
      ctx.restore();
    };
    cellSpace();

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const s = surfaceAt(map, x, z);
        const l = levelAt(map, x, z);
        ctx.fillStyle = water(s) && waterClass[z * W + x] === WATER_CLASS.sea ? SEA_FILL : SURFACE_FILL[s] ?? "#f0f";
        ctx.fillRect(x, z, 1, 1);
        // Level as brightness: higher ground reads lighter, which is the only
        // way to see elevation on a flat map. Tuned against a screenshot, not
        // guessed -- at 0.10 per level the level-2 plateaus were the same green
        // as the level-0 ground and the map read as flat.
        if (!water(s) && l > 0) {
          ctx.fillStyle = `rgba(255,247,225,${Math.min(0.5, 0.17 * l)})`;
          ctx.fillRect(x, z, 1, 1);
        }
      }
    }

    // Cliff and half-step edges, drawn as the lines they will become.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (water(surfaceAt(map, x, z))) continue;
        for (const [dx, dz] of ORTHOGONAL) {
          if (!inBounds(map, x + dx, z + dz)) continue;
          const d = levelAt(map, x, z) - levelAt(map, x + dx, z + dz);
          if (d <= 0) continue;
          // Half steps get their own colour, not a fainter version of the cliff
          // line: "where are they and how many" has to be answerable at a glance.
          ctx.strokeStyle = d >= CLIFF_LEVELS ? "#20140c" : "#e8a13c";
          ctx.lineWidth = px(d >= CLIFF_LEVELS ? Math.max(1.5, zoom * 0.3) : Math.max(1, zoom * 0.2));
          ctx.beginPath();
          const x0 = x + (dx > 0 ? 1 : 0);
          const z0 = z + (dz > 0 ? 1 : 0);
          if (dx !== 0) {
            ctx.moveTo(x0, z);
            ctx.lineTo(x0, z + 1);
          } else {
            ctx.moveTo(x, z0);
            ctx.lineTo(x + 1, z0);
          }
          ctx.stroke();
        }
        if (needsCliff(map, x, z) && !cliffPieceFor(map, x, z)) {
          ctx.fillStyle = "#ff0055";
          ctx.fillRect(x, z, 1, 1);
        }
      }
    }

    // Ramps: an arrow up the climb, so a mis-oriented one is obvious.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (!isRamp(surfaceAt(map, x, z))) continue;
        const dir = rampDir(map, x, z);
        ctx.fillStyle = dir ? "#2b7fff" : "#ff0055";
        ctx.fillRect(x, z, 1, 1);
        if (dir) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = px(Math.max(1, zoom * 0.18));
          ctx.beginPath();
          ctx.moveTo(x + 0.5 - dir[0] * 0.35, z + 0.5 - dir[1] * 0.35);
          ctx.lineTo(x + 0.5 + dir[0] * 0.35, z + 0.5 + dir[1] * 0.35);
          ctx.stroke();
        }
      }
    }

    // Labels sit under the markers and over the terrain. Semi-transparent with
    // a solid centre dot: a fence line has to read as a line at a glance, but
    // you still need to see the ground it is drawn on.
    for (const a of annotations) {
      ctx.fillStyle = a.color;
      for (const [x, z] of a.cells) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x, z, 1, 1);
        ctx.globalAlpha = 1;
        ctx.fillRect(x + 0.35, z + 0.35, 0.3, 0.3);
      }
      // The name once, at the first cell, so a map with six labels is readable
      // instead of being the same word stamped four hundred times.
      const first = a.cells[0];
      if (first) text(a.name, first[0] + 0.5, first[1] - 0.2, a.color);
    }

    // Legacy planning markers (island-map.json): the game reads objects, not these.
    for (const p of props) {
      const colour = PROP_COLOR[p.kind] ?? "#ffd166";
      const [pw, pd] = p.size ?? [1, 1];
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(p.cell[0], p.cell[1], pw, pd);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colour;
      ctx.lineWidth = px(2);
      ctx.strokeRect(p.cell[0], p.cell[1], pw, pd);
      if (p.id) text(p.id, p.cell[0] + pw / 2, p.cell[1] + pd / 2);
    }

    // Objects: footprints where they have one, dots otherwise; ids on the ones people ask about.
    const overlapping = new Set((health?.warnings ?? []).flatMap((w) => w.split(" overlaps ").map((s) => s.split(" (")[0])));
    const outlinePath = (o: MapObject, pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([a, b], i) => {
        const [dx, dz] = turn(a, b, o.yaw);
        const u = cellU(o.x + dx), v = cellV(o.z + dz);
        if (i) ctx.lineTo(u, v);
        else ctx.moveTo(u, v);
      });
      ctx.closePath();
    };
    for (const o of objects) {
      const st = OBJECT_STYLE[o.kind];
      const color = o.kind === "landmark" ? LANDMARK_INFO[o.id as LandmarkId]?.color ?? st.color : st.color;
      const u = cellU(o.x), v = cellV(o.z);
      const outline = objectOutline(o);
      const isSel = keyOf(o) === selected;
      if (outline) {
        outlinePath(o, outline);
        ctx.fillStyle = color;
        ctx.globalAlpha = o.kind === "landmark" ? 0.75 : 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = px(isSel ? 3 : 1.5);
        ctx.strokeStyle = isSel ? "#ffd166" : overlapping.has(keyOf(o)) ? "#ff3355" : "rgba(0,0,0,0.6)";
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(u, v, st.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = px(isSel ? 3 : 1);
        ctx.strokeStyle = isSel ? "#ffd166" : overlapping.has(keyOf(o)) ? "#ff3355" : "rgba(0,0,0,0.65)";
        ctx.stroke();
      }
      // A tree's crown, faint, so spacing reads as the game will.
      if (o.kind === "tree") {
        ctx.beginPath();
        ctx.arc(u, v, 1.3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(47,107,58,0.55)";
        ctx.lineWidth = px(1);
        ctx.stroke();
      }
      // Doors and exits (they move with their building), and three residents' room at an anchor.
      if (o.kind === "landmark") {
        const info = LANDMARK_INFO[o.id as LandmarkId];
        for (const [which, c] of [["door", "#ffffff"], ["exit", "#4ad8ff"]] as const) {
          const off = info?.[which];
          if (!off) continue;
          const [dx, dz] = turn(off[0], off[1], o.yaw);
          ctx.beginPath();
          ctx.arc(cellU(o.x + dx), cellV(o.z + dz), 0.22, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
        }
      }
      if (o.kind === "anchor") {
        ctx.fillStyle = "rgba(184,146,255,0.35)";
        for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.arc(u + k * SHARED_SPACING, v, 0.3, 0, Math.PI * 2); ctx.fill(); }
      }
      if (o.kind === "study" && o.model && o.model in FURNITURE) {
        ctx.fillStyle = "#fff";
        for (const [sx, sz] of FURNITURE[o.model as Furniture].seats) {
          const [dx, dz] = turn(sx, sz, o.yaw);
          ctx.fillRect(cellU(o.x + dx) - 0.12, cellV(o.z + dz) - 0.12, 0.24, 0.24);
        }
      }
      const named = o.kind === "landmark" || o.kind === "anchor" || o.kind === "study" || o.kind === "spawn" || o.kind === "fitting" || o.kind === "missions";
      if (named || isSel) text(o.kind === "anchor" ? `⚑ ${o.id}` : o.id.replace(/^study:/, ""), u, v - (outline ? 0 : 0.9), isSel ? "#ffd166" : "#fff");
    }

    // Compass: north is −x. In the game view that is the right edge, as on the minimap.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `bold 13px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd166";
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(flip ? "N ▶" : "◀ N", flip ? W * zoom - 6 : 6, (D * zoom) / 2);
    ctx.textAlign = "center";
    ctx.fillText(flip ? "▲ W (camera forward)" : "▼ W", (W * zoom) / 2, flip ? 12 : D * zoom - 12);
  }, [map, props, annotations, objects, zoom, flip, toPx, waterClass, selected, health]);

  const blit = useCallback(() => {
    const cv = canvasRef.current;
    const off = offscreen.current;
    if (!cv || !off) return;
    cv.width = off.width;
    cv.height = off.height;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0);
    if (!hover) return;
    ctx.setTransform(flip ? -zoom : zoom, 0, 0, flip ? -zoom : zoom, flip ? map.width * zoom : 0, flip ? map.depth * zoom : 0);
    const px = (n: number) => n / zoom;

    // A pending rect, line or lasso, drawn before it is committed. Without this
    // you are dragging blind and only find out the plot was the wrong size after
    // it lands.
    if (shape === "lasso" && lasso.current.length > 1 && tool !== "object") {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = px(2);
      ctx.beginPath();
      lasso.current.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
      ctx.stroke();
    }
    const pending = dragFrom && (tool === "prop" || shape === "rect" || shape === "line") && tool !== "object";
    if (pending && dragFrom) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = px(2);
      if (shape === "line" && tool !== "prop") {
        const end = snapLine(dragFrom, hover);
        ctx.beginPath();
        ctx.moveTo(dragFrom.x + 0.5, dragFrom.z + 0.5);
        ctx.lineTo(end.x + 0.5, end.z + 0.5);
        ctx.stroke();
      } else {
        const { x0, z0, x1, z1 } = rectOf(dragFrom, hover);
        ctx.strokeRect(x0, z0, x1 - x0 + 1, z1 - z0 + 1);
      }
    }

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = px(1);
    if (tool === "object") {
      ctx.beginPath();
      ctx.arc(hover.u, hover.v, 0.3, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    const r = tool === "prop" || shape === "rect" || shape === "fill" || shape === "lasso" ? 0 : brush - 1;
    if (round && r > 0) {
      ctx.beginPath();
      ctx.arc(hover.x + 0.5, hover.z + 0.5, r + 0.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(hover.x - r, hover.z - r, r * 2 + 1, r * 2 + 1);
    }
  }, [hover, brush, zoom, round, dragFrom, shape, tool, flip, map.width, map.depth]);

  // The terrain repaints when the map changes; a mouse move only re-blits it under the cursor.
  useEffect(() => repaint(), [repaint, version]);
  useEffect(() => blit(), [blit, repaint, version]);

  /**
   * Add or remove one cell from the active label.
   *
   * Kept as a sparse cell list rather than a parallel grid: a fence is a few
   * hundred cells on a map of 65k, and a list survives a resize by shifting
   * rather than being rebuilt.
   */
  const paintLabel = useCallback(
    (x: number, z: number) => {
      const w = world();
      const a = w.annotations.find((n) => n.name === activeLabel);
      if (!a) return;
      const at = a.cells.findIndex((c) => c[0] === x && c[1] === z);
      if (labelErase) {
        if (at >= 0) a.cells.splice(at, 1);
      } else if (at < 0) {
        a.cells.push([x, z]);
      }
    },
    [activeLabel, labelErase]
  );

  /** What the active tool does to ONE cell. Shape decides which cells. */
  const paintCell = useCallback(
    (x: number, z: number) => {
      if (!inBounds(map, x, z)) return;
      const s = surfaceAt(map, x, z);
      switch (tool) {
        case "label":
          paintLabel(x, z);
          break;
        case "prop":
        case "object":
          // Handled on mousedown/mouseup. Dragging a brush of them would carpet the map.
          break;
        case "land":
          // Only fills water. Painting over existing ground would silently
          // erase whatever surface was there.
          if (water(s)) setCell(map, x, z, 0, Surface.Grass);
          break;
        case "sea":
          setCell(map, x, z, 0, Surface.River);
          break;
        case "surface":
          setCell(map, x, z, water(paintSurface) ? 0 : levelAt(map, x, z), paintSurface);
          break;
        case "ramp":
          if (!water(s)) setCell(map, x, z, levelAt(map, x, z), Surface.Ramp);
          break;
        case "flat":
          if (!water(s)) setCell(map, x, z, paintLevel, s);
          break;
        case "raise":
        case "lower": {
          if (water(s)) break;
          const d = tool === "raise" ? 1 : -1;
          setCell(map, x, z, Math.min(MAX_LEVEL, Math.max(0, levelAt(map, x, z) + d)), s);
          break;
        }
        case "smooth":
        case "grow":
        case "shrink":
        case "jitter": {
          // Once per cell per stroke, from the map as the stroke began.
          if (!STROKE) STROKE = { before: snapshotCells(map), touched: new Uint8Array(map.width * map.depth), seed: STROKE_SEED };
          const i = z * map.width + x;
          if (STROKE.touched[i]) break;
          STROKE.touched[i] = 1;
          organicCell(tool as OrganicOp, map, STROKE.before, x, z, STROKE.seed);
          break;
        }
      }
    },
    [map, tool, paintSurface, paintLevel, paintLabel]
  );

  /** One brush dab. Does not touch history; the stroke owns that. */
  const dab = useCallback(
    (cx: number, cz: number) => {
      const r = brush - 1;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (round && dx * dx + dz * dz > r * r + r) continue;
          paintCell(cx + dx, cz + dz);
        }
      }
    },
    [brush, round, paintCell]
  );

  /** The rectangle two cells span, normalised so drag direction does not matter. */
  const rectOf = (a: { x: number; z: number }, b: { x: number; z: number }) => ({
    x0: Math.min(a.x, b.x),
    z0: Math.min(a.z, b.z),
    x1: Math.max(a.x, b.x),
    z1: Math.max(a.z, b.z),
  });

  /**
   * Snap a drag to one of 8 directions.
   *
   * A pathway drawn freehand reads as an accident. Snapping is what makes a road
   * look placed. The 2:1 thresholds pick the axis you were closest to rather
   * than splitting evenly at 45 degrees, which makes near-horizontal drags
   * settle on horizontal instead of flickering to diagonal.
   */
  const snapLine = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    if (adx > adz * 2) return { x: b.x, z: a.z };
    if (adz > adx * 2) return { x: a.x, z: b.z };
    const n = Math.min(adx, adz);
    return { x: a.x + Math.sign(dx) * n, z: a.z + Math.sign(dz) * n };
  };

  /**
   * Cells reachable from a seed with the same surface and level.
   *
   * Collected BEFORE anything is painted, on purpose. Filling while walking
   * would change the very thing the walk is matching on — `raise` would chase
   * its own edge outward and never stop where you meant it to.
   */
  const fillRegion = useCallback(
    (sx: number, sz: number): [number, number][] => {
      if (!inBounds(map, sx, sz)) return [];
      const wantS = surfaceAt(map, sx, sz);
      const wantL = levelAt(map, sx, sz);
      const seen = new Uint8Array(map.width * map.depth);
      const out: [number, number][] = [];
      const stack: [number, number][] = [[sx, sz]];
      while (stack.length) {
        const [x, z] = stack.pop()!;
        if (!inBounds(map, x, z)) continue;
        const i = z * map.width + x;
        if (seen[i]) continue;
        if (surfaceAt(map, x, z) !== wantS || levelAt(map, x, z) !== wantL) continue;
        seen[i] = 1;
        out.push([x, z]);
        for (const [dx, dz] of ORTHOGONAL) stack.push([x + dx, z + dz]);
      }
      return out;
    },
    [map]
  );

  /**
   * Dab along the segment from the last cell to this one.
   *
   * A mousemove fires every frame at best, so a fast drag jumps many cells and
   * leaves a dotted line. Interpolating is what makes the brush feel like a
   * brush rather than a stamp.
   */
  const stroke = useCallback(
    (cx: number, cz: number) => {
      const from = lastCell.current;
      if (!from) {
        dab(cx, cz);
      } else {
        const steps = Math.max(Math.abs(cx - from.x), Math.abs(cz - from.z));
        for (let i = 1; i <= steps; i++) {
          dab(Math.round(from.x + ((cx - from.x) * i) / steps), Math.round(from.z + ((cz - from.z) * i) / steps));
        }
      }
      lastCell.current = { x: cx, z: cz };
      bump();
    },
    [dab, bump]
  );

  /** Pointer → cell (floor), cell space (u, v) and world coordinates. */
  const pointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ax = (e.clientX - rect.left) / zoom, ay = (e.clientY - rect.top) / zoom;
    const u = flip ? map.width - ax : ax, v = flip ? map.depth - ay : ay;
    return { x: Math.floor(u), z: Math.floor(v), u, v, wx: map.originX + u - 0.5, wz: map.originZ + v - 0.5 };
  };

  const endStroke = () => {
    painting.current = false;
    lastCell.current = null;
    if (STROKE) STROKE_SEED++;
    STROKE = null;
  };

  /** Fill every cell of a rectangle. Used by the rect shape. */
  const applyRect = useCallback(
    (a: { x: number; z: number }, b: { x: number; z: number }) => {
      const { x0, z0, x1, z1 } = rectOf(a, b);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) paintCell(x, z);
    },
    [paintCell]
  );

  /** Walk a snapped line, dabbing the brush along it so runs have width. */
  const applyLine = useCallback(
    (a: { x: number; z: number }, b: { x: number; z: number }) => {
      const end = snapLine(a, b);
      const steps = Math.max(Math.abs(end.x - a.x), Math.abs(end.z - a.z));
      if (steps === 0) {
        dab(a.x, a.z);
        return;
      }
      for (let i = 0; i <= steps; i++) {
        dab(Math.round(a.x + ((end.x - a.x) * i) / steps), Math.round(a.z + ((end.z - a.z) * i) / steps));
      }
    },
    [dab]
  );

  /** Does this marker cover a cell? Point markers cover one; plots cover their footprint. */
  const propCovers = (p: PlacedProp, x: number, z: number) => {
    const [w, d] = p.size ?? [1, 1];
    return x >= p.cell[0] && z >= p.cell[1] && x < p.cell[0] + w && z < p.cell[1] + d;
  };

  /**
   * Place or remove a planning marker (legacy).
   *
   * Click a covered cell to remove whatever is there, so a mis-drawn plot is one
   * click to undo rather than a hunt for its corner. Otherwise a drag defines a
   * footprint and a click defines a point.
   */
  const placeProp = useCallback(
    (a: { x: number; z: number }, b: { x: number; z: number }) => {
      if (!inBounds(map, a.x, a.z)) return;
      const w = world();
      const hit = w.props.findIndex((p) => propCovers(p, a.x, a.z));
      commit();
      if (hit >= 0) {
        w.props = w.props.filter((_, i) => i !== hit);
        bump();
        return;
      }
      const { x0, z0, x1, z1 } = rectOf(a, b);
      const sw = x1 - x0 + 1;
      const sd = z1 - z0 + 1;
      const id = propId.trim();
      w.props = [
        ...w.props,
        {
          kind: propKind,
          ...(id ? { id } : {}),
          cell: [x0, z0] as [number, number],
          level: levelAt(map, x0, z0),
          ...(sw > 1 || sd > 1 ? { size: [sw, sd] as [number, number] } : {}),
        },
      ];
      bump();
    },
    [map, propKind, propId, bump]
  );

  /** The topmost object under a world point: inside its footprint, or near its dot. */
  const objectAt = useCallback(
    (wx: number, wz: number): MapObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i], outline = objectOutline(o);
        const [lx, lz] = turn(wx - o.x, wz - o.z, -(o.yaw ?? 0));
        if (outline) {
          const xs = outline.map((p) => p[0]), zs = outline.map((p) => p[1]);
          if (lx >= Math.min(...xs) && lx <= Math.max(...xs) && lz >= Math.min(...zs) && lz <= Math.max(...zs)) return o;
        } else if (Math.hypot(lx, lz) <= Math.max(0.45, OBJECT_STYLE[o.kind].r)) return o;
      }
      return null;
    },
    [objects]
  );

  /** Ids a unique kind may still take (landmarks, anchors, outdoor tables). */
  const freeIds = useMemo(() => {
    const has = (kind: ObjectKind, id: string) => objects.some((o) => o.kind === kind && o.id === id);
    return {
      landmark: LANDMARK_IDS.filter((id) => !has("landmark", id)),
      anchor: Object.keys(RESIDENT_ANCHORS).filter((id) => !has("anchor", id)),
      study: OUTDOOR_TABLES.map((t) => t.anchor).filter((id) => !has("study", id)),
    };
  }, [objects]);

  /** Place a new object of the palette's kind at a world point. Returns its key, or null. */
  const placeObject = useCallback(
    (wx: number, wz: number): string | null => {
      if (placeKind === "select") return null;
      const kind = placeKind, w = world();
      let id = "", extra: Partial<MapObject> = {};
      if (kind === "landmark" || kind === "anchor" || kind === "study") {
        const free: readonly string[] = freeIds[kind];
        id = free.includes(placeId) ? placeId : free[0] ?? "";
        if (!id) return null;
        if (kind === "study") {
          const seats = OUTDOOR_TABLES.find((t) => t.anchor === id)?.seats ?? 4;
          extra = { model: (Object.keys(FURNITURE) as Furniture[]).find((f) => FURNITURE[f].seats.length === seats && ["picnic", "pier"].includes(f)) ?? "picnic" };
        }
      } else if (kind === "spawn") {
        id = w.objects.some((o) => o.kind === "spawn" && o.id === "default") ? nextObjectId(kind, w.objects) : "default";
      } else if (kind === "fitting" || kind === "missions") {
        id = w.objects.some((o) => o.kind === kind && o.id === kind) ? nextObjectId(kind, w.objects) : kind;
      } else {
        id = nextObjectId(kind, w.objects);
      }
      if (kind === "tree" || kind === "bush" || kind === "flower") extra = { seed: kind === "tree" ? Number(placeModel || 0) + 4 * Math.floor(Math.random() * 3) : Math.floor(Math.random() * 32) };
      if (kind === "rock") extra = { model: ROCK_MODELS.includes(placeModel) ? placeModel : ROCK_MODELS[0], scale: 1 };
      if (kind === "bench") extra = { model: "bench-wood" };
      if (kind === "fence") extra = { model: FENCE_MODELS.includes(placeModel) ? placeModel : FENCE_MODELS[0] };
      if (kind === "bug") extra = { model: BUG_BIOMES.includes(placeModel) ? placeModel : BUG_BIOMES[1] };
      if (kind === "bridge") extra = { yaw: Math.PI / 2 };
      const [x, z] = snapFor(kind, id, wx, wz);
      commit();
      w.objects = [...w.objects, { id, kind, x, z, ...extra }];
      bump();
      return `${kind}:${id}`;
    },
    [placeKind, placeId, placeModel, freeIds, snapFor, bump]
  );

  const btn = (active: boolean, extra?: React.CSSProperties) => ({
    padding: "5px 10px",
    fontSize: 12,
    fontFamily: mono,
    borderRadius: 4,
    border: "1px solid #3a4148",
    background: active ? "#ffd166" : "#1c2126",
    color: active ? "#1c2126" : "#c8cfd4",
    cursor: "pointer",
    ...extra,
  });
  const field: React.CSSProperties = {
    padding: "4px 6px", fontSize: 12, fontFamily: mono, borderRadius: 4, border: "1px solid #3a4148", background: "#12161a", color: "#c8cfd4", minWidth: 0,
  };

  const problems = health ? Object.entries(health.problems) : [];
  const bad = problems.length > 0;
  const landCells = budget.land;

  return (
    <div style={{ position: "fixed", inset: 0, top: 40, background: "#11151a", display: "flex", color: "#c8cfd4" }}>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <canvas
          ref={canvasRef}
          data-testid="painter-canvas"
          style={{ cursor: tool === "object" ? "default" : "crosshair", imageRendering: "pixelated" }}
          onMouseDown={(e) => {
            const c = pointer(e);
            if (tool === "object") {
              const hit = objectAt(c.wx, c.wz);
              const key = hit ? keyOf(hit) : placeObject(c.wx, c.wz);
              setSelected(key);
              const o = hit ?? (key ? world().objects.find((ob) => keyOf(ob) === key) : null);
              moving.current = o && key ? { key, dx: o.x - c.wx, dz: o.z - c.wz, committed: !hit } : null;
              return;
            }
            dragRef.current = c;
            setDragFrom(c);
            painting.current = true;
            lastCell.current = null;
            if (shape === "lasso" && tool !== "prop") {
              lasso.current = [[c.u, c.v]];
              return;
            }
            // The prop tool and the deferred shapes decide what to do on
            // RELEASE, once the drag is known. Only free painting and fill act
            // immediately.
            if (tool === "prop" || shape === "rect" || shape === "line") return;
            commit();
            if (shape === "fill") {
              for (const [x, z] of fillRegion(c.x, c.z)) paintCell(x, z);
              endStroke();
              bump();
              return;
            }
            stroke(c.x, c.z);
          }}
          onMouseUp={(e) => {
            const c = pointer(e);
            if (tool === "object") {
              moving.current = null;
              return;
            }
            const from = dragRef.current;
            dragRef.current = null;
            if (from) {
              if (tool === "prop") {
                placeProp(from, c);
              } else if (shape === "lasso") {
                commit();
                for (const [x, z] of cellsInPolygon(lasso.current.map(([u, v]) => [u - 0.5, v - 0.5]), map.width, map.depth)) paintCell(x, z);
                lasso.current = [];
                bump();
              } else if (shape === "rect") {
                commit();
                applyRect(from, c);
                bump();
              } else if (shape === "line") {
                commit();
                applyLine(from, c);
                bump();
              }
            }
            setDragFrom(null);
            endStroke();
          }}
          onMouseLeave={() => {
            // Abandon a pending rect/line/lasso rather than guessing where it ended.
            dragRef.current = null;
            moving.current = null;
            lasso.current = [];
            setDragFrom(null);
            endStroke();
            setHover(null);
          }}
          onMouseMove={(e) => {
            const c = pointer(e);
            setHover(c);
            const m = moving.current;
            if (m && tool === "object" && e.buttons === 1) {
              const o = world().objects.find((ob) => keyOf(ob) === m.key);
              if (!o) return;
              const [x, z] = snapFor(o.kind, o.id, c.wx + m.dx, c.wz + m.dz);
              if (x === o.x && z === o.z) return;
              updateObject(m.key, { x, z }, !m.committed);
              m.committed = true;
              return;
            }
            if (painting.current && shape === "lasso" && tool !== "prop") {
              lasso.current.push([c.u, c.v]);
              blit();
              return;
            }
            if (painting.current && shape === "free" && tool !== "prop" && tool !== "object") stroke(c.x, c.z);
          }}
        />
      </div>

      <div style={{ width: 340, borderLeft: "1px solid #232a31", fontFamily: mono, fontSize: 12, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Pinned. Which island you are on, and how to get to another one, are
            the two things that must never be scrolled off a drafting tool. */}
        <div style={{ borderBottom: "1px solid #232a31", padding: "12px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#ffd166" }}>/lab/map · {source === "village" ? "village-map.json" : "legacy island-map.json"}</span>
            <span style={{ color: edited ? "#7fd1c0" : "#5c6670" }}>{edited ? "draft autosaved" : "shipped"}</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button onClick={undo} disabled={!UNDO.length} style={btn(false, { flex: 1, opacity: UNDO.length ? 1 : 0.35 })}>↶ undo</button>
            <button onClick={redo} disabled={!REDO.length} style={btn(false, { flex: 1, opacity: REDO.length ? 1 : 0.35 })}>↷ redo</button>
            <button onClick={() => setView(view === "game" ? "raw" : "game")} style={btn(false, { flex: 1.4 })} title="game view: camera forward (west) at the top, north on the right">
              {view === "game" ? "game view" : "raw view"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                commit();
                const { map: m } = world();
                m.levels.fill(0);
                m.surfaces.fill(Surface.River);
                // Objects and labels go with the terrain. Leaving them behind
                // floats every building over open water on a map that no longer
                // has ground.
                WORLD = { ...world(), map: m, props: [], annotations: [], objects: [] };
                setSelected(null);
                bump();
              }}
              style={btn(false, { flex: 1 })}
            >
              new
            </button>
            <button onClick={() => setSheet(sheet === "open" ? "none" : "open")} style={btn(sheet === "open", { flex: 1 })}>
              open {library.length ? `(${library.length})` : ""}
            </button>
            <button onClick={() => setSheet(sheet === "import" ? "none" : "import")} style={btn(sheet === "import", { flex: 1 })}>import</button>
            <button
              onClick={() => {
                saveNow();
                window.open("/lab/island?draft=1", "_blank");
              }}
              style={btn(false, { flex: 1.3, borderColor: "#7fd1c0", color: "#7fd1c0" })}
              title="open this draft in 3D at /lab/island?draft=1"
            >
              walk it ↗
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 0 }}>
          {sheet === "open" && (
            <div style={{ border: "1px solid #3a4148", borderRadius: 4, padding: 10, marginBottom: 12 }}>
              <div style={{ color: "#ffd166", marginBottom: 6 }}>shipped</div>
              <button onClick={() => { load(shippedVillage()); setSheet("none"); }} style={btn(false, { width: "100%", textAlign: "left", marginBottom: 4 })}>
                village-map.json (the game&apos;s)
              </button>
              <button onClick={() => { load(fromDoc(islandMapDoc as IslandMapDoc, "legacy")); setSheet("none"); }} style={btn(false, { width: "100%", textAlign: "left", marginBottom: 4 })}>
                island-map.json (legacy 128 draft)
              </button>
              {legacyDraft && (
                <button
                  onClick={() => {
                    try {
                      const raw = window.localStorage.getItem(LEGACY_DRAFT_KEY);
                      if (raw) load(fromDoc(JSON.parse(raw) as IslandMapDoc, "legacy"));
                    } catch {
                      /* unreadable autosave */
                    }
                    setSheet("none");
                  }}
                  style={btn(false, { width: "100%", textAlign: "left", marginBottom: 4 })}
                >
                  legacy autosave (this browser)
                </button>
              )}
              <div style={{ color: "#ffd166", margin: "8px 0 6px" }}>saved islands</div>
              {library.length === 0 && <div style={{ color: "#5c6670", marginBottom: 8 }}>none yet</div>}
              {library.map((name) => (
                <div key={name} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      const doc = readLibrary()[name];
                      if (doc) load(fromDoc(doc as VillageDoc));
                      setSheet("none");
                    }}
                    style={btn(false, { flex: 1, textAlign: "left" })}
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => {
                      const lib = readLibrary();
                      delete lib[name];
                      writeLibrary(lib);
                      setLibrary(Object.keys(lib).sort());
                    }}
                    style={btn(false, { color: "#ff5577" })}
                    title={`delete ${name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDraft(saveName);
                  }}
                  placeholder="name this island"
                  style={{ ...field, flex: 1, padding: "5px 8px" }}
                />
                <button onClick={() => saveDraft(saveName)} style={btn(false)}>save</button>
              </div>
              <div style={{ color: "#5c6670", marginTop: 6, lineHeight: 1.5 }}>
                Saving under an existing name overwrites it. Stored in this browser, so export anything you want to keep.
              </div>
            </div>
          )}

          {sheet === "import" && (
            <div style={{ border: "1px solid #3a4148", borderRadius: 4, padding: 10, marginBottom: 12 }}>
              <div style={{ color: "#ffd166", marginBottom: 6 }}>paste a map document</div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={5}
                placeholder='{"width":96,"depth":96,...}'
                style={{ ...field, width: "100%", boxSizing: "border-box", padding: 8, fontSize: 11, resize: "vertical" }}
              />
              {importError && <div style={{ color: "#ff5577", marginTop: 6 }}>{importError}</div>}
              <button
                onClick={() => {
                  try {
                    const doc = JSON.parse(importText) as VillageDoc;
                    // Validate before replacing: a bad paste that half-loads
                    // would look like a corrupted map rather than a typo.
                    if (!doc.width || !doc.depth || !Array.isArray(doc.levels) || !Array.isArray(doc.surfaces)) {
                      setImportError("not an island map: needs width, depth, levels, surfaces");
                      return;
                    }
                    load(fromDoc(doc));
                    setImportError("");
                    setImportText("");
                    setSheet("none");
                  } catch (err) {
                    setImportError(`not valid JSON: ${String(err).slice(0, 80)}`);
                  }
                }}
                style={btn(false, { width: "100%", marginTop: 6 })}
              >
                load it
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {TOOLS.map((t) => (
              <button key={t} onClick={() => setTool(t)} style={btn(tool === t, ORGANIC.includes(t) ? { borderColor: "#5aab5f" } : t === "object" ? { borderColor: "#ff8f4a" } : undefined)}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ color: "#5c6670", marginBottom: 8, lineHeight: 1.5 }}>{TOOL_HELP[tool]}</div>

          {tool !== "prop" && tool !== "object" && (
            <>
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {SHAPES.map((s) => (
                  <button key={s} onClick={() => setShape(s)} style={btn(shape === s, { flex: 1, padding: "5px 4px" })}>{s}</button>
                ))}
              </div>
              <div style={{ color: "#5c6670", marginBottom: 10, lineHeight: 1.5 }}>{SHAPE_HELP[shape]}</div>
            </>
          )}

          {/* Live size while dragging. Blocking out a plot is a question about
              dimensions, and counting cells off a screenshot is not an answer. */}
          {dragFrom && hover && tool !== "object" && shape !== "lasso" && (
            <div style={{ border: "1px solid #ffd166", borderRadius: 4, padding: "6px 9px", marginBottom: 10, color: "#ffd166" }}>
              {(() => {
                const { x0, z0, x1, z1 } = rectOf(dragFrom, hover);
                const w = x1 - x0 + 1;
                const d = z1 - z0 + 1;
                if (shape === "line" && tool !== "prop") {
                  const end = snapLine(dragFrom, hover);
                  const len = Math.max(Math.abs(end.x - dragFrom.x), Math.abs(end.z - dragFrom.z)) + 1;
                  return `${len} cells long, ${brush * 2 - 1} wide`;
                }
                return `${w} × ${d} cells  (${w * d})`;
              })()}
            </div>
          )}

          {tool === "surface" && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              {Object.entries(SURFACE_NAME).map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setPaintSurface(Number(id))}
                  style={btn(false, { background: SURFACE_FILL[Number(id)], color: "#12161a", outline: paintSurface === Number(id) ? "2px solid #ffd166" : "none" })}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {tool === "flat" && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
              {Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (
                <button key={l} onClick={() => setPaintLevel(l)} style={btn(paintLevel === l)}>L{l}</button>
              ))}
            </div>
          )}

          {tool === "object" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
                <button onClick={() => setPlaceKind("select")} style={btn(placeKind === "select")}>select / move</button>
                {PALETTE.map((k) => (
                  <button
                    key={k}
                    onClick={() => { setPlaceKind(k); setPlaceId(""); setPlaceModel(""); }}
                    style={btn(false, { background: OBJECT_STYLE[k].color, color: "#12161a", outline: placeKind === k ? "2px solid #ffd166" : "none", padding: "4px 7px" })}
                  >
                    {OBJECT_STYLE[k].label}
                  </button>
                ))}
              </div>
              {(placeKind === "landmark" || placeKind === "anchor" || placeKind === "study") && (
                <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} style={{ ...field, width: "100%", marginBottom: 6 }}>
                  {freeIds[placeKind].length ? freeIds[placeKind].map((id) => (
                    <option key={id} value={id}>{placeKind === "landmark" ? `${id} · ${LANDMARK_INFO[id as LandmarkId].label}` : placeKind === "anchor" ? `${id} · ${RESIDENT_ANCHORS[id as keyof typeof RESIDENT_ANCHORS].label}` : id}</option>
                  )) : <option value="">all placed</option>}
                </select>
              )}
              {(placeKind === "tree" || placeKind === "rock" || placeKind === "fence" || placeKind === "bug") && (
                <select value={placeModel} onChange={(e) => setPlaceModel(e.target.value)} style={{ ...field, width: "100%", marginBottom: 6 }}>
                  {(placeKind === "tree" ? TREE_NAMES.map((n, i) => [String(i), n]) : (placeKind === "rock" ? ROCK_MODELS : placeKind === "fence" ? FENCE_MODELS : BUG_BIOMES).map((m) => [m, m])).map(([v, n]) => (
                    <option key={v} value={v}>{n}</option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                <span style={{ color: "#7d868e" }}>snap</span>
                {[[1, "cells"], [0.5, "half"], [0, "free"]].map(([v, n]) => (
                  <button key={n} onClick={() => setSnap(v as number)} style={btn(snap === v, { flex: 1, padding: "4px 4px" })}>{n}</button>
                ))}
              </div>
              <div style={{ color: "#5c6670", lineHeight: 1.5, marginBottom: 6 }}>
                Buildings put their footprint on whole cells. Landmarks, resident anchors and study tables are one each: the list shows what is left to place.
              </div>
              {selectedObject && (
                <div style={{ border: "1px solid #ffd166", borderRadius: 4, padding: 8 }}>
                  <div style={{ color: "#ffd166", marginBottom: 6 }}>
                    {OBJECT_STYLE[selectedObject.kind].label} · {selectedObject.id}
                    {selectedObject.kind === "landmark" && ` · ${LANDMARK_INFO[selectedObject.id as LandmarkId]?.label ?? "unknown"}`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: 4, alignItems: "center" }}>
                    <span>x</span>
                    <input type="number" step={0.1} value={selectedObject.x} onChange={(e) => updateObject(selected!, { x: Number(e.target.value) })} style={field} />
                    <span>z</span>
                    <input type="number" step={0.1} value={selectedObject.z} onChange={(e) => updateObject(selected!, { z: Number(e.target.value) })} style={field} />
                    {TURNS(selectedObject) ? <><span>yaw°</span>
                      <input type="number" step={15} value={deg(selectedObject.yaw)} onChange={(e) => updateObject(selected!, { yaw: (Number(e.target.value) * Math.PI) / 180 })} style={field} /></> : <><span /><span style={{ color: "#5c6670" }}>faces the camera</span></>}
                    {selectedObject.kind === "rock" ? <><span>scale</span><input type="number" step={0.1} min={0.3} max={3} value={selectedObject.scale ?? 1} onChange={(e) => updateObject(selected!, { scale: Number(e.target.value) })} style={field} /></> : <><span /><span /></>}
                    {(selectedObject.kind === "tree" || selectedObject.kind === "bush" || selectedObject.kind === "flower") && (
                      <>
                        <span>seed</span>
                        <input type="number" step={1} min={0} value={selectedObject.seed ?? 0} onChange={(e) => updateObject(selected!, { seed: Math.max(0, Math.round(Number(e.target.value))) })} style={field} />
                        <span />
                        <span style={{ color: "#7d868e" }}>{selectedObject.kind === "tree" ? TREE_NAMES[(selectedObject.seed ?? 0) % 4] : ""}</span>
                      </>
                    )}
                  </div>
                  {(selectedObject.kind === "rock" || selectedObject.kind === "fence" || selectedObject.kind === "bug") && (
                    <select value={selectedObject.model ?? ""} onChange={(e) => updateObject(selected!, { model: e.target.value })} style={{ ...field, width: "100%", marginTop: 6 }}>
                      {(selectedObject.kind === "rock" ? ROCK_MODELS : selectedObject.kind === "fence" ? FENCE_MODELS : BUG_BIOMES).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    {TURNS(selectedObject) && <button onClick={() => updateObject(selected!, { yaw: ((selectedObject.yaw ?? 0) + Math.PI / 2) % (Math.PI * 2) })} style={btn(false, { flex: 1 })}>turn 90°</button>}
                    <button onClick={() => deleteObject(selected!)} style={btn(false, { flex: 1, color: "#ff5577" })}>delete</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tool === "label" && (
            <div style={{ marginBottom: 10 }}>
              {annotations.map((a) => (
                <div key={a.name} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <button
                    onClick={() => setActiveLabel(a.name)}
                    style={btn(false, { flex: 1, textAlign: "left", borderLeft: `6px solid ${a.color}`, outline: activeLabel === a.name ? "2px solid #ffd166" : "none" })}
                  >
                    {a.name} <span style={{ color: "#7d868e" }}>{a.cells.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      commit();
                      const w = world();
                      w.annotations = w.annotations.filter((n) => n.name !== a.name);
                      if (activeLabel === a.name) setActiveLabel("");
                      bump();
                    }}
                    style={btn(false, { color: "#ff5577" })}
                    title={`delete ${a.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "8px 0 6px" }}>
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setLabelColor(c)}
                    style={{ width: 22, height: 22, background: c, borderRadius: 4, cursor: "pointer", border: labelColor === c ? "2px solid #ffd166" : "1px solid #3a4148" }}
                    title={c}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addLabel();
                  }}
                  placeholder="new label, e.g. fencing"
                  style={{ ...field, flex: 1, padding: "5px 8px" }}
                />
                <button onClick={addLabel} style={btn(false)}>add</button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button onClick={() => setLabelErase(false)} style={btn(!labelErase, { flex: 1 })}>paint</button>
                <button onClick={() => setLabelErase(true)} style={btn(labelErase, { flex: 1 })}>erase</button>
              </div>
              <div style={{ color: "#5c6670", marginTop: 6, lineHeight: 1.5 }}>
                {activeLabel
                  ? `Painting “${activeLabel}”. Labels are free text and never touch the terrain — they ride along in the exported JSON as instructions.`
                  : "Add a label, then pick it to paint. Works with every shape: line for a fence run, rect for a zone, fill for a whole region."}
              </div>
            </div>
          )}

          {tool === "prop" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                {PROP_KINDS.map((k) => (
                  <button key={k} onClick={() => setPropKind(k)} style={btn(false, { background: PROP_COLOR[k], color: "#12161a", outline: propKind === k ? "2px solid #ffd166" : "none" })}>{k}</button>
                ))}
              </div>
              <input value={propId} onChange={(e) => setPropId(e.target.value)} placeholder="id / label, e.g. hq" style={{ ...field, width: "100%", boxSizing: "border-box", padding: "5px 8px" }} />
            </div>
          )}

          {tool !== "object" && tool !== "prop" && (
            <>
              <label style={{ display: "block", marginBottom: 4 }}>
                brush {brush * 2 - 1} <span style={{ color: "#5c6670" }}>[ ]</span>
                <input type="range" min={1} max={16} value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ width: "100%" }} />
              </label>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                <button onClick={() => setRound(true)} style={btn(round, { flex: 1 })}>round</button>
                <button onClick={() => setRound(false)} style={btn(!round, { flex: 1 })}>square</button>
              </div>
            </>
          )}
          <label style={{ display: "block", marginBottom: 12 }}>
            zoom {zoom}px
            <input type="range" min={2} max={16} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: "100%" }} />
          </label>

          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
            <div style={{ color: "#7d868e", marginBottom: 5 }}>
              grid {map.width}×{map.depth} · {landCells} land cells · island {budget.spanX}×{budget.spanZ}u
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {SIZES.map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    if (n === map.width && n === map.depth) return;
                    commit();
                    const w = world();
                    const next = resizeMap(w.map, w.props, n, w.annotations);
                    normaliseSea(next.map);
                    // Objects keep their world positions; anything off the new grid is dropped.
                    const m = next.map, inside = (v: number, o: number) => v >= o - 0.5 && v < o + n - 0.5;
                    WORLD = { ...w, ...next, objects: w.objects.filter((o) => inside(o.x, m.originX) && inside(o.z, m.originZ)) };
                    bump();
                  }}
                  style={btn(n === map.width, { padding: "4px 6px" })}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ color: "#5c6670", marginTop: 5, lineHeight: 1.5 }}>
              Keeps world positions, so the island and its objects stay put and the new edge is sea. Shrinking discards whatever falls outside.
            </div>
          </div>

          <button
            onClick={() => {
              commit();
              WORLD = shippedVillage();
              setSelected(null);
              try {
                window.localStorage.removeItem(PAINTER_DRAFT_KEY);
              } catch {
                /* nothing to clear */
              }
              bumpClean();
            }}
            style={btn(false, { width: "100%", marginBottom: 6 })}
          >
            reload shipped village
          </button>
          <div style={{ color: "#5c6670", marginBottom: 10, lineHeight: 1.5 }}>
            Undoable. Work autosaves to this browser; this throws the working draft away. Named saves under “open” are untouched.
          </div>

          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
            <div style={{ color: !health ? "#7d868e" : bad ? "#ff5577" : "#7fd1c0", marginBottom: 6 }} data-testid="health">
              {!health ? "checking…" : bad ? "PROBLEMS" : "healthy"}
            </div>
            {problems.map(([check, what]) => (
              <Row key={check} k={check} v={what.length > 3 ? `${what.slice(0, 3).join(", ")} +${what.length - 3}` : what.join(", ")} warn />
            ))}
            {health && (
              <>
                <Row k="reachable from spawn" v={`${health.terrain.reachable}/${health.terrain.walkable}`} warn={health.terrain.stranded > 0} />
                <Row k="cliff cells" v={String(health.terrain.cliffCells)} />
                <Row k="half-step cells" v={String(health.terrain.halfSteps)} />
                {health.warnings.length > 0 && (
                  <div style={{ color: "#ffa62b", marginTop: 6, lineHeight: 1.5 }}>
                    {health.warnings.length} overlap{health.warnings.length > 1 ? "s" : ""} (outlined red): {health.warnings.slice(0, 3).join("; ")}
                    {health.warnings.length > 3 ? " …" : ""}
                  </div>
                )}
              </>
            )}
            {health && health.terrain.tooTall > 0 && (
              <button
                onClick={() => {
                  commit();
                  const moved = legaliseTerraces(map);
                  setLegalised(moved);
                  bump();
                }}
                style={btn(false, { width: "100%", marginTop: 6 })}
              >
                terrace them ({health.terrain.tooTall})
              </button>
            )}
            {legalised > 0 && health?.terrain.tooTall === 0 && (
              <div style={{ color: "#7fd1c0", marginTop: 5, lineHeight: 1.5 }}>
                Lowered {legalised} cells. The peak stays where you drew it; each tier insets until every face fits one cliff piece.
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }} data-testid="budget">
            <div style={{ color: "#7d868e", marginBottom: 5 }}>budget (scripts/map-budget.mjs)</div>
            <Row k="terrain draws (worst)" v={`${budget.terrainDraws} · ${budget.chunksUsed} chunks`} warn={budget.terrainDraws > 300} />
            <Row k="terrain triangles" v={budget.terrainTriangles.toLocaleString()} />
            <Row k="cliff pieces" v={String(budget.cliffPieces)} warn={budget.cliffsWithoutPiece > 0} />
            <Row k="shore field · height field" v={`${budget.shoreSdfMB.toFixed(2)} · ${budget.heightFieldMB.toFixed(2)} MB`} />
            <Row k="objects" v={`${objects.length} (${objects.filter((o) => o.kind === "tree" || o.kind === "bush" || o.kind === "flower").length} nature, instanced)`} />
            {Object.keys(budget.levels).map(Number).sort((a, b) => a - b).map((l) => (
              <Row key={l} k={`level ${l}`} v={`${budget.levels[l]}  ${((100 * budget.levels[l]) / Math.max(1, landCells)).toFixed(1)}%`} />
            ))}
          </div>

          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, lineHeight: 1.7 }}>
            <Legend c="#20140c" label="full cliff (hard barrier)" />
            <Legend c="#e8a13c" label="half step (walkable, blended)" />
            <Legend c="#2b7fff" label="ramp, arrow points uphill" />
            <Legend c="#ff0055" label="broken: no kit piece or no climb" />
            <Legend c={SEA_FILL} label="open sea (by connectivity); lighter blue is river or pond" />
            <Legend c="#ffffff" label="door · cyan: where you come back out" />
          </div>

          {hover && inBounds(map, hover.x, hover.z) && (
            <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, color: "#8b949e" }}>
              <Row k="world x, z" v={`${(map.originX + hover.u - 0.5).toFixed(2)}, ${(map.originZ + hover.v - 0.5).toFixed(2)}`} />
              <Row k="cell (world)" v={`${map.originX + hover.x}, ${map.originZ + hover.z}`} />
              <Row k="cell (grid)" v={`${hover.x}, ${hover.z}`} />
              <Row k="level" v={String(levelAt(map, hover.x, hover.z))} />
              <Row
                k="surface"
                v={water(surfaceAt(map, hover.x, hover.z)) ? ["land", "sea", "river", "pond"][waterClass[hover.z * map.width + hover.x]] : SURFACE_NAME[surfaceAt(map, hover.x, hover.z)] ?? "?"}
              />
              <Row k="half steps" v={String(halfCliffEdges(map, hover.x, hover.z).length)} />
              <Row k="full cliff" v={needsCliff(map, hover.x, hover.z) ? "yes" : "no"} />
            </div>
          )}
        </div>

        {/* Pinned. It is the only action that leaves the page, and with the
            checks and legend above it it was otherwise below the fold. */}
        <div style={{ borderTop: "1px solid #232a31", padding: 14, flexShrink: 0 }}>
          <button
            onClick={() => {
              const w = world();
              const out = w.source === "village"
                ? villageJson(serialiseVillage(w.map, w.objects, w.annotations))
                : JSON.stringify({ ...islandMapDoc, ...serialiseIslandMap(w.map, w.props, w.annotations) }, null, 1);
              void navigator.clipboard.writeText(out);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            style={btn(false, { width: "100%", padding: "9px 0", background: copied ? "#7fd1c0" : "#1c2126", color: copied ? "#12161a" : "#c8cfd4" })}
          >
            {copied ? `copied — paste into data/${source === "village" ? "village" : "island"}-map.json` : "Export map → clipboard"}
          </button>
          <div style={{ color: "#5c6670", marginTop: 8, lineHeight: 1.5 }}>
            {source === "village" ? (
              <>Paste over <code>web/data/village-map.json</code> (the coordinator commits it). Healthy above means the suite stays green.</>
            ) : (
              <>Legacy draft: paste over <code>web/data/island-map.json</code>. The game reads the village file.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ c, label }: { c: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {/* Outlined because the cliff swatch is near-black on a near-black panel. */}
      <span style={{ width: 11, height: 11, background: c, borderRadius: 2, flexShrink: 0, border: "1px solid #3a4148" }} />
      <span style={{ color: "#7d868e" }}>{label}</span>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "1px 0" }}>
      <span style={{ color: "#7d868e" }}>{k}</span>
      <span style={{ color: warn ? "#ff5577" : "#c8cfd4", textAlign: "right" }}>{v}</span>
    </div>
  );
}

