"use client";

/**
 * /lab/map — the tile editor (M6).
 *
 * WHY THIS EXISTS. Six of the last eight terrain changes were David describing
 * what he wanted and me guessing at numbers in `author-elevation.mjs`: "less
 * hills", "too vertical", "half steps should blend", each one a round trip
 * through a script, a regenerate and a screenshot. This turns that into
 * drawing.
 *
 * It edits the SHIPPED map, not a copy of the authoring script's inputs, so
 * what you paint is what loads. Export puts the whole `island-map.json` on the
 * clipboard, following the "Export all → clipboard" convention already in
 * `components/lab/LabPanel.tsx` — no API route, no write path to disk, which
 * keeps a dev tool from being able to corrupt the world.
 *
 * THE CHECKS ARE THE POINT. A hand-painted map breaks in ways that are invisible
 * until you walk it: an unreachable terrace, a cliff with no piece, a one-cell
 * wall, a face too tall for the kit to draw. Those all cost real debugging, so
 * they run live in the panel on every edit rather than at the end. The panel
 * checks exactly what `lib/game/islandMap.test.ts` asserts: if it says healthy,
 * pasting the export keeps the suite green.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import islandMapDoc from "@/data/island-map.json";
import {
  parseIslandMap,
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
  rampRun,
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

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DRAFT_KEY = "lab-map-draft-v1";

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

const SURFACE_NAME: Record<number, string> = {
  [Surface.Grass]: "grass",
  [Surface.Soil]: "soil",
  [Surface.Stone]: "stone",
  [Surface.Sand]: "sand",
  [Surface.Wood]: "wood",
  [Surface.Brick]: "brick",
  [Surface.River]: "river",
  [Surface.Void]: "sea",
  [Surface.Ramp]: "ramp",
};

const TOOLS = ["land", "sea", "raise", "lower", "flat", "surface", "ramp", "prop", "label"] as const;
type Tool = (typeof TOOLS)[number];

const TOOL_HELP: Record<Tool, string> = {
  land: "sea → grass at level 0. The coastline brush.",
  sea: "erase back to open water.",
  raise: "+1 level. Land only.",
  lower: "−1 level. Land only.",
  flat: "set an exact level. How you draw a plateau.",
  surface: "paint a surface, terrain untouched.",
  ramp: "mark a ramp cell. It climbs toward the higher neighbour.",
  prop: "drag a rectangle for a building plot, click for a point marker. Click either again to remove.",
  label: "paint a named thing of your own: fencing, hedges, a note. Terrain untouched.",
};

/**
 * Colours offered for a new label. Chosen to stay legible over grass, sand and
 * water, since a label is useless if it disappears into the ground it marks.
 */
const LABEL_COLORS = [
  "#ff4d6d",
  "#ffa62b",
  "#ffe066",
  "#7bf1a8",
  "#4cc9f0",
  "#b892ff",
  "#ffffff",
  "#1b1b1b",
];

/**
 * WHERE a tool applies, independent of WHAT it does.
 *
 * David, 2026-07-30: this is for blocking out space — island structures,
 * building plots, pathways — not for pixel-perfect work. A round brush is the
 * wrong instrument for a rectangular plot or a straight road, and dabbing one
 * out cell by cell is how you get a wobbly blob that reads as an accident.
 */
const SHAPES = ["free", "rect", "line", "fill"] as const;
type Shape = (typeof SHAPES)[number];

const SHAPE_HELP: Record<Shape, string> = {
  free: "brush, follows the cursor",
  rect: "drag a rectangle, fills on release",
  line: "drag a straight run, snapped to 8 directions",
  fill: "click to flood the matching region",
};

/**
 * Marker kinds. The first six are what `island-map.json` already carries; the
 * rest are layout language for planning a map before any of it is built.
 *
 * A marker is just a `PlacedProp`, so a plan drawn here and a shippable map are
 * the same file. `id` is free text and becomes the building id the renderer
 * looks up ("hq", "shop", "oracle"), or a note to yourself on a draft.
 */
const PROP_KINDS = [
  "building",
  "npc",
  "tree",
  "bush",
  "flower",
  "lamp",
  "spawn",
  "note",
] as const;

const PROP_COLOR: Record<string, string> = {
  building: "#ff8f4a",
  npc: "#d98fff",
  tree: "#3f8f4f",
  bush: "#5aab5f",
  flower: "#ff7fa8",
  lamp: "#ffd166",
  spawn: "#4ad8ff",
  note: "#ffffff",
};

/** Grid sizes offered by the resize control. Multiples of CHUNK (16). */
const SIZES = [96, 128, 160, 192, 224, 256];

interface Health {
  reachable: number;
  walkable: number;
  stranded: number;
  cliffCells: number;
  missingPiece: number;
  thinWalls: number;
  orphanRamps: number;
  tooTall: number;
  levels: Record<number, number>;
}

/**
 * Every check that cost real debugging, run on the live map.
 *
 * Reachability is the one that matters most and the one nothing else surfaces:
 * with hard cliffs a terrace can be perfectly drawn and simply unreachable, and
 * the only symptom is a player who cannot get there.
 */
function measure(map: IslandMap): Health {
  const W = map.width;
  const D = map.depth;
  const walkAt = (x: number, z: number) =>
    inBounds(map, x, z) && !isVoid(surfaceAt(map, x, z)) && !isRiver(surfaceAt(map, x, z));

  let walkable = 0;
  let cliffCells = 0;
  let missingPiece = 0;
  let thinWalls = 0;
  let orphanRamps = 0;
  let tooTall = 0;
  const levels: Record<number, number> = {};
  let seed: [number, number] | null = null;

  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (isVoid(surfaceAt(map, x, z))) continue;
      const l = levelAt(map, x, z);
      levels[l] = (levels[l] ?? 0) + 1;
      if (walkAt(x, z)) {
        walkable++;
        if (!seed && l === 0) seed = [x, z];
      }
      if (needsCliff(map, x, z)) {
        cliffCells++;
        if (!cliffPieceFor(map, x, z)) missingPiece++;
      }
      if (isRamp(surfaceAt(map, x, z)) && !rampDir(map, x, z)) orphanRamps++;
      // The cliff kit is one piece tall and does not stack, so a face taller
      // than CLIFF_LEVELS has nothing to draw it and renders as a hole. The
      // authoring script enforces this; a hand edit can break it in one click.
      for (const [dx, dz] of ORTHOGONAL) {
        if (!inBounds(map, x + dx, z + dz)) continue;
        const ns = surfaceAt(map, x + dx, z + dz);
        const nl = isVoid(ns) ? 0 : levelAt(map, x + dx, z + dz);
        if (Math.abs(l - nl) > CLIFF_LEVELS) tooTall++;
      }
      // A raised cell with lower ground on both sides of an axis is a wall you
      // cannot stand on.
      const lower = (dx: number, dz: number) =>
        walkAt(x + dx, z + dz) && levelAt(map, x + dx, z + dz) < l;
      if (l > 0 && ((lower(-1, 0) && lower(1, 0)) || (lower(0, -1) && lower(0, 1)))) thinWalls++;
    }
  }

  // A ramp is only a route if its RUN resolves. Keying on the surface alone
  // said a broken ramp was walkable: painting a second ramp straight onto the
  // first merged them into one run climbing further than the kit allows, all
  // three cells reported as orphans, and stranded still dropped from 48 to 30
  // as though a route had opened. Precomputed because rampRun walks the run.
  const ramped = new Uint8Array(W * D);
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (isRamp(surfaceAt(map, x, z)) && rampRun(map, x, z)) ramped[z * W + x] = 1;
    }
  }

  let reachable = 0;
  if (seed) {
    const seen = new Uint8Array(W * D);
    const stack: [number, number][] = [seed];
    while (stack.length) {
      const [x, z] = stack.pop()!;
      const i = z * W + x;
      if (seen[i] || !walkAt(x, z)) continue;
      seen[i] = 1;
      reachable++;
      for (const [dx, dz] of ORTHOGONAL) {
        const nx = x + dx;
        const nz = z + dz;
        if (!walkAt(nx, nz)) continue;
        const d = Math.abs(levelAt(map, nx, nz) - levelAt(map, x, z));
        const viaRamp = ramped[nz * W + nx] === 1 || ramped[i] === 1;
        // A blended half step is walkable; a full cliff needs a working ramp.
        if (d < CLIFF_LEVELS || viaRamp) stack.push([nx, nz]);
      }
    }
  }

  return {
    reachable,
    walkable,
    stranded: walkable - reachable,
    cliffCells,
    missingPiece,
    thinWalls,
    orphanRamps,
    tooTall,
    levels,
  };
}

/**
 * Named drafts, so this can hold more than one island.
 *
 * David, 2026-07-30: this page is where the general layout for all future
 * terrain and islands gets drafted. One autosave slot is crash protection, not
 * a library — without named slots, starting a second island destroys the first.
 * Kept in localStorage next to the working draft; a draft is just the same
 * `island-map.json` document, so anything saved here can be exported and
 * shipped unchanged.
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
 */
interface World {
  map: IslandMap;
  props: PlacedProp[];
  annotations: MapAnnotation[];
}
let WORLD: World | null = null;
function world(): World {
  if (!WORLD) WORLD = parseIslandMap(islandMapDoc as IslandMapDoc);
  return WORLD;
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
  width: number;
  depth: number;
  originX: number;
  originZ: number;
  levels: Uint8Array;
  surfaces: Uint8Array;
  props: PlacedProp[];
  annotations: MapAnnotation[];
}
const HISTORY_LIMIT = 80;
const UNDO: Snapshot[] = [];
let REDO: Snapshot[] = [];

function snapshot(): Snapshot {
  const { map, props, annotations } = world();
  return {
    width: map.width,
    depth: map.depth,
    originX: map.originX,
    originZ: map.originZ,
    levels: map.levels.slice(),
    surfaces: map.surfaces.slice(),
    props: props.map((p) => ({ ...p, cell: [p.cell[0], p.cell[1]] })),
    annotations: annotations.map((a) => ({ ...a, cells: a.cells.map((c) => [c[0], c[1]] as [number, number]) })),
  };
}

function restore(s: Snapshot) {
  WORLD = {
    map: {
      width: s.width,
      depth: s.depth,
      originX: s.originX,
      originZ: s.originZ,
      levels: s.levels.slice(),
      surfaces: s.surfaces.slice(),
    },
    props: s.props.map((p) => ({ ...p, cell: [p.cell[0], p.cell[1]] as [number, number] })),
    annotations: s.annotations.map((a) => ({
      ...a,
      cells: a.cells.map((c) => [c[0], c[1]] as [number, number]),
    })),
  };
}

/** Call BEFORE mutating. Every edit path goes through this or it is not undoable. */
function commit() {
  UNDO.push(snapshot());
  if (UNDO.length > HISTORY_LIMIT) UNDO.shift();
  REDO = [];
}

export default function MapLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  const { map, props, annotations } = world();
  const [tool, setTool] = useState<Tool>("raise");
  const [shape, setShape] = useState<Shape>("free");
  const [dragFrom, setDragFrom] = useState<{ x: number; z: number } | null>(null);
  const [brush, setBrush] = useState(3);
  const [round, setRound] = useState(true);
  const [paintSurface, setPaintSurface] = useState<number>(Surface.Grass);
  const [paintLevel, setPaintLevel] = useState(0);
  const [zoom, setZoom] = useState(7);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [edited, setEdited] = useState(false);
  const [propKind, setPropKind] = useState<string>("building");
  const [propId, setPropId] = useState("");
  const [activeLabel, setActiveLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [labelErase, setLabelErase] = useState(false);
  const [library, setLibrary] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [sheet, setSheet] = useState<"none" | "open" | "import">("none");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [legalised, setLegalised] = useState(0);
  const [version, setVersion] = useState(0);
  const painting = useRef(false);
  const lastCell = useRef<{ x: number; z: number } | null>(null);
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

  // Keyed on version, so hovering a cell does not re-run the whole audit.
  // `version` looks unnecessary to the linter because the mutation it stands for
  // happens inside `map`'s typed arrays, which it cannot see. It is the key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const health = useMemo(() => measure(map), [map, version]);

  /**
   * Restore an autosaved draft.
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
      saved = window.localStorage.getItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!saved) return;
    try {
      WORLD = parseIslandMap(JSON.parse(saved) as IslandMapDoc);
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

  // Autosave. Debounced, because serialising 256² to JSON on every brush dab
  // would be the slowest thing on the page.
  //
  // Gated on `edited`, and that gate is load-bearing: without it "reload
  // shipped" removes the draft, then this effect fires on the same version bump
  // and writes it straight back, so the reset never survives a refresh and the
  // banner claims a draft that is really just the shipped map.
  useEffect(() => {
    if (!edited) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(serialiseIslandMap(map, props, annotations)));
      } catch {
        /* quota or private mode: autosave is a convenience, not a guarantee */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [map, props, annotations, version, edited]);

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
    (doc: IslandMapDoc) => {
      commit();
      WORLD = parseIslandMap(doc);
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

  const saveDraft = useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      const lib = readLibrary();
      lib[n] = serialiseIslandMap(map, props, annotations);
      writeLibrary(lib);
      setLibrary(Object.keys(lib).sort());
      setSaveName("");
    },
    [map, props, annotations]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Otherwise "[" typed into the draft-name or prop-id field resizes the
      // brush, and Cmd+Z in a text field undoes the MAP instead of the text.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (!(e.metaKey || e.ctrlKey)) {
        if (e.key === "[") setBrush((b) => Math.max(1, b - 1));
        if (e.key === "]") setBrush((b) => Math.min(16, b + 1));
        return;
      }
      if (e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y") return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /**
   * Repaint the terrain into an offscreen canvas.
   *
   * Separate from the hover cursor on purpose. At 256² this loop touches 65k
   * cells twice plus every edge; running it on mousemove made the cursor lag.
   * Now it runs only when the map actually changes, and moving the mouse costs
   * one blit.
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

    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const s = surfaceAt(map, x, z);
        const l = levelAt(map, x, z);
        ctx.fillStyle = SURFACE_FILL[s] ?? "#f0f";
        ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        // Level as brightness: higher ground reads lighter, which is the only
        // way to see elevation on a flat map. Tuned against a screenshot, not
        // guessed -- at 0.10 per level the level-2 plateaus were the same green
        // as the level-0 ground and the map read as flat.
        if (!isVoid(s) && l > 0) {
          ctx.fillStyle = `rgba(255,247,225,${Math.min(0.5, 0.17 * l)})`;
          ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        }
      }
    }

    // Cliff and half-step edges, drawn as the lines they will become.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (isVoid(surfaceAt(map, x, z))) continue;
        for (const [dx, dz] of ORTHOGONAL) {
          if (!inBounds(map, x + dx, z + dz)) continue;
          const d = levelAt(map, x, z) - levelAt(map, x + dx, z + dz);
          if (d <= 0) continue;
          // Half steps get their own colour, not a fainter version of the cliff
          // line. They are the thing being tuned -- rare, blended, for
          // naturalness -- so "where are they and how many" has to be answerable
          // at a glance, and a 1px brown line at zoom 5 was not.
          ctx.strokeStyle = d >= CLIFF_LEVELS ? "#20140c" : "#e8a13c";
          ctx.lineWidth = d >= CLIFF_LEVELS ? Math.max(1.5, zoom * 0.3) : Math.max(1, zoom * 0.2);
          ctx.beginPath();
          const x0 = (x + (dx > 0 ? 1 : 0)) * zoom;
          const z0 = (z + (dz > 0 ? 1 : 0)) * zoom;
          if (dx !== 0) {
            ctx.moveTo(x0, z * zoom);
            ctx.lineTo(x0, (z + 1) * zoom);
          } else {
            ctx.moveTo(x * zoom, z0);
            ctx.lineTo((x + 1) * zoom, z0);
          }
          ctx.stroke();
        }
        if (needsCliff(map, x, z) && !cliffPieceFor(map, x, z)) {
          ctx.fillStyle = "#ff0055";
          ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        }
      }
    }

    // Ramps: an arrow up the climb, so a mis-oriented one is obvious.
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        if (!isRamp(surfaceAt(map, x, z))) continue;
        const dir = rampDir(map, x, z);
        ctx.fillStyle = dir ? "#2b7fff" : "#ff0055";
        ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        if (dir) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = Math.max(1, zoom * 0.18);
          ctx.beginPath();
          const cx = (x + 0.5) * zoom;
          const cz = (z + 0.5) * zoom;
          ctx.moveTo(cx - dir[0] * zoom * 0.35, cz - dir[1] * zoom * 0.35);
          ctx.lineTo(cx + dir[0] * zoom * 0.35, cz + dir[1] * zoom * 0.35);
          ctx.stroke();
        }
      }
    }

    // Markers, coloured by kind so a layout reads at a glance without hovering
    // every dot. Buildings get their id written next to them, since "where does
    // HQ go" is the actual question a layout draft answers.
    // Labels sit under the markers and over the terrain. Semi-transparent with
    // a solid centre dot: a fence line has to read as a line at a glance, but
    // you still need to see the ground it is drawn on.
    for (const a of annotations) {
      ctx.fillStyle = a.color;
      for (const [x, z] of a.cells) {
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x * zoom, z * zoom, zoom, zoom);
        ctx.globalAlpha = 1;
        ctx.fillRect(x * zoom + zoom * 0.35, z * zoom + zoom * 0.35, zoom * 0.3, zoom * 0.3);
      }
      // The name once, at the first cell, so a map with six labels is readable
      // instead of being the same word stamped four hundred times.
      const first = a.cells[0];
      if (first && zoom >= 4) {
        ctx.font = `${Math.max(9, zoom * 1.1)}px ${mono}`;
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(a.name, first[0] * zoom, first[1] * zoom - 2);
        ctx.fillStyle = a.color;
        ctx.fillText(a.name, first[0] * zoom, first[1] * zoom - 2);
      }
    }

    for (const p of props) {
      const colour = PROP_COLOR[p.kind] ?? "#ffd166";
      const [pw, pd] = p.size ?? [1, 1];
      const plot = pw > 1 || pd > 1;
      let lx: number;
      let lz: number;

      if (plot) {
        // A plot is drawn as its actual footprint, hatched rather than solid so
        // the terrain underneath still reads. Blocking out where a building goes
        // is only useful if you can see what it is standing on.
        const x = p.cell[0] * zoom;
        const z = p.cell[1] * zoom;
        const w = pw * zoom;
        const d = pd * zoom;
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, z, w, d);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, z + 1, w - 2, d - 2);
        lx = x + w / 2;
        lz = z + d / 2;
      } else {
        lx = (p.cell[0] + 0.5) * zoom;
        lz = (p.cell[1] + 0.5) * zoom;
        const r = Math.max(2, zoom * 0.34);
        ctx.beginPath();
        ctx.arc(lx, lz, r, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.stroke();
        lx += r + 3;
      }

      if (p.id && zoom >= 5) {
        ctx.font = `${Math.max(9, zoom * 1.1)}px ${mono}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = plot ? "center" : "left";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(p.id, lx, lz);
        ctx.fillStyle = "#fff";
        ctx.fillText(p.id, lx, lz);
        ctx.textAlign = "left";
      }
    }
  }, [map, props, annotations, zoom]);

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

    // A pending rect or line, drawn before it is committed. Without this you
    // are dragging blind and only find out the plot was the wrong size after
    // it lands.
    const pending = dragFrom && (tool === "prop" || shape === "rect" || shape === "line");
    if (pending && dragFrom) {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      if (shape === "line" && tool !== "prop") {
        const end = snapLine(dragFrom, hover);
        ctx.beginPath();
        ctx.moveTo((dragFrom.x + 0.5) * zoom, (dragFrom.z + 0.5) * zoom);
        ctx.lineTo((end.x + 0.5) * zoom, (end.z + 0.5) * zoom);
        ctx.stroke();
      } else {
        const { x0, z0, x1, z1 } = rectOf(dragFrom, hover);
        ctx.strokeRect(
          x0 * zoom + 1,
          z0 * zoom + 1,
          (x1 - x0 + 1) * zoom - 2,
          (z1 - z0 + 1) * zoom - 2
        );
      }
    }

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    const r = tool === "prop" || shape === "rect" || shape === "fill" ? 0 : brush - 1;
    if (round && r > 0) {
      ctx.beginPath();
      ctx.arc((hover.x + 0.5) * zoom, (hover.z + 0.5) * zoom, (r + 0.5) * zoom, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(
        (hover.x - r) * zoom + 0.5,
        (hover.z - r) * zoom + 0.5,
        (r * 2 + 1) * zoom - 1,
        (r * 2 + 1) * zoom - 1
      );
    }
  }, [hover, brush, zoom, round, dragFrom, shape, tool]);

  useEffect(() => {
    repaint();
    blit();
  }, [repaint, blit, version]);

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
          // Handled on mousedown, one per click. Dragging a brush of them
          // would carpet the map.
          break;
        case "land":
          // Only fills water. Painting over existing ground would silently
          // erase whatever surface was there.
          if (isVoid(s)) setCell(map, x, z, 0, Surface.Grass);
          break;
        case "sea":
          setCell(map, x, z, 0, Surface.Void);
          break;
        case "surface":
          setCell(map, x, z, levelAt(map, x, z), paintSurface);
          break;
        case "ramp":
          if (!isVoid(s)) setCell(map, x, z, levelAt(map, x, z), Surface.Ramp);
          break;
        case "flat":
          if (!isVoid(s)) setCell(map, x, z, paintLevel, s);
          break;
        case "raise":
        case "lower": {
          if (isVoid(s)) break;
          const d = tool === "raise" ? 1 : -1;
          setCell(map, x, z, Math.min(MAX_LEVEL, Math.max(0, levelAt(map, x, z) + d)), s);
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
          dab(
            Math.round(from.x + ((cx - from.x) * i) / steps),
            Math.round(from.z + ((cz - from.z) * i) / steps)
          );
        }
      }
      lastCell.current = { x: cx, z: cz };
      bump();
    },
    [dab, bump]
  );

  const cellFrom = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      z: Math.floor((e.clientY - rect.top) / zoom),
    };
  };

  const endStroke = () => {
    painting.current = false;
    lastCell.current = null;
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
        dab(
          Math.round(a.x + ((end.x - a.x) * i) / steps),
          Math.round(a.z + ((end.z - a.z) * i) / steps)
        );
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
   * Place or remove a marker.
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
          // A marker sits on the ground it is placed on; the renderer reads
          // this rather than re-deriving it, so it has to match.
          level: levelAt(map, x0, z0),
          ...(sw > 1 || sd > 1 ? { size: [sw, sd] as [number, number] } : {}),
        },
      ];
      bump();
    },
    [map, propKind, propId, bump]
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

  // Everything `islandMap.test.ts` asserts. If the panel says healthy, pasting
  // the export over the map keeps the suite green -- that equivalence is the
  // whole contract, so a check must not be countable-but-ignored here.
  const bad =
    health.stranded > 0 ||
    health.missingPiece > 0 ||
    health.orphanRamps > 0 ||
    health.thinWalls > 0 ||
    health.tooTall > 0;

  const landCells = Object.values(health.levels).reduce((a, b) => a + b, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#11151a", display: "flex", color: "#c8cfd4" }}>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <canvas
          ref={canvasRef}
          style={{ cursor: "crosshair", imageRendering: "pixelated" }}
          onMouseDown={(e) => {
            const c = cellFrom(e);
            dragRef.current = c;
            setDragFrom(c);
            painting.current = true;
            lastCell.current = null;
            // The prop tool and the deferred shapes decide what to do on
            // RELEASE, once the drag is known. Only free painting and fill act
            // immediately.
            if (tool === "prop" || shape === "rect" || shape === "line") return;
            commit();
            if (shape === "fill") {
              for (const [x, z] of fillRegion(c.x, c.z)) paintCell(x, z);
              bump();
              return;
            }
            stroke(c.x, c.z);
          }}
          onMouseUp={(e) => {
            const c = cellFrom(e);
            const from = dragRef.current;
            dragRef.current = null;
            if (from) {
              if (tool === "prop") {
                placeProp(from, c);
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
            // Abandon a pending rect/line rather than guessing where it ended.
            dragRef.current = null;
            setDragFrom(null);
            endStroke();
            setHover(null);
          }}
          onMouseMove={(e) => {
            const c = cellFrom(e);
            setHover(c);
            if (painting.current && shape === "free" && tool !== "prop") stroke(c.x, c.z);
          }}
        />
      </div>

      <div
        style={{
          width: 320,
          borderLeft: "1px solid #232a31",
          fontFamily: mono,
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Pinned. Which island you are on, and how to get to another one, are
            the two things that must never be scrolled off a drafting tool. */}
        <div style={{ borderBottom: "1px solid #232a31", padding: "12px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#ffd166" }}>/lab/map</span>
            <span style={{ color: edited ? "#7fd1c0" : "#5c6670" }}>
              {edited ? "draft autosaved" : "shipped map"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button onClick={undo} disabled={!UNDO.length} style={btn(false, { flex: 1, opacity: UNDO.length ? 1 : 0.35 })}>
              ↶ undo
            </button>
            <button onClick={redo} disabled={!REDO.length} style={btn(false, { flex: 1, opacity: REDO.length ? 1 : 0.35 })}>
              ↷ redo
            </button>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                commit();
                const { map: m } = world();
                m.levels.fill(0);
                m.surfaces.fill(Surface.Void);
                // Props and labels go with the terrain. Leaving them behind
                // floats every building over open water on a map that no longer
                // has ground.
                WORLD = { map: m, props: [], annotations: [] };
                bump();
              }}
              style={btn(false, { flex: 1 })}
            >
              new
            </button>
            <button onClick={() => setSheet(sheet === "open" ? "none" : "open")} style={btn(sheet === "open", { flex: 1 })}>
              open {library.length ? `(${library.length})` : ""}
            </button>
            <button onClick={() => setSheet(sheet === "import" ? "none" : "import")} style={btn(sheet === "import", { flex: 1 })}>
              import
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 0 }}>
        {sheet === "open" && (
          <div style={{ border: "1px solid #3a4148", borderRadius: 4, padding: 10, marginBottom: 12 }}>
            <div style={{ color: "#ffd166", marginBottom: 6 }}>saved islands</div>
            {library.length === 0 && (
              <div style={{ color: "#5c6670", marginBottom: 8 }}>none yet</div>
            )}
            {library.map((name) => (
              <div key={name} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <button
                  onClick={() => {
                    const doc = readLibrary()[name];
                    if (doc) load(doc);
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
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "5px 8px",
                  fontSize: 12,
                  fontFamily: mono,
                  borderRadius: 4,
                  border: "1px solid #3a4148",
                  background: "#12161a",
                  color: "#c8cfd4",
                }}
              />
              <button onClick={() => saveDraft(saveName)} style={btn(false)}>
                save
              </button>
            </div>
            <div style={{ color: "#5c6670", marginTop: 6, lineHeight: 1.5 }}>
              Saving under an existing name overwrites it. Stored in this
              browser, so export anything you want to keep.
            </div>
          </div>
        )}

        {sheet === "import" && (
          <div style={{ border: "1px solid #3a4148", borderRadius: 4, padding: 10, marginBottom: 12 }}>
            <div style={{ color: "#ffd166", marginBottom: 6 }}>paste island-map.json</div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder='{"width":128,"depth":128,...}'
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 8,
                fontSize: 11,
                fontFamily: mono,
                borderRadius: 4,
                border: "1px solid #3a4148",
                background: "#12161a",
                color: "#c8cfd4",
                resize: "vertical",
              }}
            />
            {importError && <div style={{ color: "#ff5577", marginTop: 6 }}>{importError}</div>}
            <button
              onClick={() => {
                try {
                  const doc = JSON.parse(importText) as IslandMapDoc;
                  // Validate before replacing: a bad paste that half-loads
                  // would look like a corrupted map rather than a typo.
                  if (!doc.width || !doc.depth || !Array.isArray(doc.levels) || !Array.isArray(doc.surfaces)) {
                    setImportError("not an island map: needs width, depth, levels, surfaces");
                    return;
                  }
                  load(doc);
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
            <button key={t} onClick={() => setTool(t)} style={btn(tool === t)}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ color: "#5c6670", marginBottom: 8, lineHeight: 1.5 }}>{TOOL_HELP[tool]}</div>

        {tool !== "prop" && (
          <>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {SHAPES.map((s) => (
                <button key={s} onClick={() => setShape(s)} style={btn(shape === s, { flex: 1 })}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ color: "#5c6670", marginBottom: 10, lineHeight: 1.5 }}>
              {SHAPE_HELP[shape]}
            </div>
          </>
        )}

        {/* Live size while dragging. Blocking out a plot is a question about
            dimensions, and counting cells off a screenshot is not an answer. */}
        {dragFrom && hover && (
          <div
            style={{
              border: "1px solid #ffd166",
              borderRadius: 4,
              padding: "6px 9px",
              marginBottom: 10,
              color: "#ffd166",
            }}
          >
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
                style={btn(false, {
                  background: SURFACE_FILL[Number(id)],
                  color: "#12161a",
                  outline: paintSurface === Number(id) ? "2px solid #ffd166" : "none",
                })}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {tool === "flat" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {Array.from({ length: MAX_LEVEL + 1 }, (_, l) => (
              <button key={l} onClick={() => setPaintLevel(l)} style={btn(paintLevel === l)}>
                L{l}
              </button>
            ))}
          </div>
        )}

        {tool === "label" && (
          <div style={{ marginBottom: 10 }}>
            {annotations.map((a) => (
              <div key={a.name} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                <button
                  onClick={() => setActiveLabel(a.name)}
                  style={btn(false, {
                    flex: 1,
                    textAlign: "left",
                    borderLeft: `6px solid ${a.color}`,
                    outline: activeLabel === a.name ? "2px solid #ffd166" : "none",
                  })}
                >
                  {a.name}{" "}
                  <span style={{ color: "#7d868e" }}>{a.cells.length}</span>
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
                  style={{
                    width: 22,
                    height: 22,
                    background: c,
                    borderRadius: 4,
                    cursor: "pointer",
                    border: labelColor === c ? "2px solid #ffd166" : "1px solid #3a4148",
                  }}
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
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "5px 8px",
                  fontSize: 12,
                  fontFamily: mono,
                  borderRadius: 4,
                  border: "1px solid #3a4148",
                  background: "#12161a",
                  color: "#c8cfd4",
                }}
              />
              <button onClick={addLabel} style={btn(false)}>
                add
              </button>
            </div>

            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <button onClick={() => setLabelErase(false)} style={btn(!labelErase, { flex: 1 })}>
                paint
              </button>
              <button onClick={() => setLabelErase(true)} style={btn(labelErase, { flex: 1 })}>
                erase
              </button>
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
                <button
                  key={k}
                  onClick={() => setPropKind(k)}
                  style={btn(false, {
                    background: PROP_COLOR[k],
                    color: "#12161a",
                    outline: propKind === k ? "2px solid #ffd166" : "none",
                  })}
                >
                  {k}
                </button>
              ))}
            </div>
            <input
              value={propId}
              onChange={(e) => setPropId(e.target.value)}
              placeholder="id / label, e.g. hq"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "5px 8px",
                fontSize: 12,
                fontFamily: mono,
                borderRadius: 4,
                border: "1px solid #3a4148",
                background: "#12161a",
                color: "#c8cfd4",
              }}
            />
            <div style={{ color: "#5c6670", marginTop: 5, lineHeight: 1.5 }}>
              For a building the id is what the renderer looks up: hq, shop,
              oracle, house, wharf, bounty, jobs, leaderboard. On a draft it is
              just a note to yourself.
            </div>
          </div>
        )}

        <label style={{ display: "block", marginBottom: 4 }}>
          brush {brush * 2 - 1}  <span style={{ color: "#5c6670" }}>[ ]</span>
          <input type="range" min={1} max={16} value={brush} onChange={(e) => setBrush(+e.target.value)} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          <button onClick={() => setRound(true)} style={btn(round, { flex: 1 })}>round</button>
          <button onClick={() => setRound(false)} style={btn(!round, { flex: 1 })}>square</button>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}>
          zoom {zoom}px
          <input type="range" min={2} max={14} value={zoom} onChange={(e) => setZoom(+e.target.value)} style={{ width: "100%" }} />
        </label>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
          <div style={{ color: "#7d868e", marginBottom: 5 }}>
            grid {map.width}×{map.depth} · {landCells} land cells
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {SIZES.map((n) => (
              <button
                key={n}
                onClick={() => {
                  if (n === map.width) return;
                  commit();
                  WORLD = resizeMap(map, props, n, annotations);
                  bump();
                }}
                style={btn(n === map.width)}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ color: "#5c6670", marginTop: 5, lineHeight: 1.5 }}>
            Keeps world positions, so props and buildings stay put. Shrinking
            discards whatever falls outside.
          </div>
        </div>

        <button
          onClick={() => {
            commit();
            WORLD = parseIslandMap(islandMapDoc as IslandMapDoc);
            try {
              window.localStorage.removeItem(DRAFT_KEY);
            } catch {
              /* nothing to clear */
            }
            bumpClean();
          }}
          style={btn(false, { width: "100%", marginBottom: 6 })}
        >
          reload shipped island
        </button>
        <div style={{ color: "#5c6670", marginBottom: 10, lineHeight: 1.5 }}>
          Undoable. Work autosaves to this browser; this throws the working
          draft away. Named saves under “open” are untouched.
        </div>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
          <div style={{ color: bad ? "#ff5577" : "#7fd1c0", marginBottom: 6 }}>
            {bad ? "PROBLEMS" : "healthy"}
          </div>
          <Row k="reachable" v={`${health.reachable}/${health.walkable}`} warn={health.stranded > 0} />
          <Row k="stranded" v={String(health.stranded)} warn={health.stranded > 0} />
          <Row k="cliff cells" v={String(health.cliffCells)} />
          <Row k="no kit piece" v={String(health.missingPiece)} warn={health.missingPiece > 0} />
          <Row k="orphan ramps" v={String(health.orphanRamps)} warn={health.orphanRamps > 0} />
          <Row k="1-cell walls" v={String(health.thinWalls)} warn={health.thinWalls > 0} />
          <Row k="faces too tall" v={String(health.tooTall)} warn={health.tooTall > 0} />
          {health.tooTall > 0 && (
            <button
              onClick={() => {
                commit();
                const moved = legaliseTerraces(map);
                setLegalised(moved);
                bump();
              }}
              style={btn(false, { width: "100%", marginTop: 6 })}
            >
              terrace them ({health.tooTall})
            </button>
          )}
          {legalised > 0 && health.tooTall === 0 && (
            <div style={{ color: "#7fd1c0", marginTop: 5, lineHeight: 1.5 }}>
              Lowered {legalised} cells. The peak stays where you drew it; each
              tier insets until every face fits one cliff piece.
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10 }}>
          {Object.keys(health.levels)
            .map(Number)
            .sort((a, b) => a - b)
            .map((l) => (
              <Row
                key={l}
                k={`level ${l}`}
                v={`${health.levels[l]}  ${((100 * health.levels[l]) / Math.max(1, landCells)).toFixed(1)}%`}
              />
            ))}
        </div>

        <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, lineHeight: 1.7 }}>
          <Legend c="#20140c" label="full cliff (hard barrier)" />
          <Legend c="#e8a13c" label="half step (walkable, blended)" />
          <Legend c="#2b7fff" label="ramp, arrow points uphill" />
          <Legend c="#ff0055" label="broken: no kit piece or no climb" />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
            {PROP_KINDS.map((k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 4, color: "#7d868e" }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    background: PROP_COLOR[k],
                    borderRadius: "50%",
                    border: "1px solid rgba(0,0,0,0.6)",
                  }}
                />
                {k}
              </span>
            ))}
          </div>
          <Row k="markers placed" v={String(props.length)} />
        </div>

        {hover && inBounds(map, hover.x, hover.z) && (
          <div style={{ borderTop: "1px solid #232a31", paddingTop: 10, marginBottom: 10, color: "#8b949e" }}>
            <Row k="cell" v={`${hover.x}, ${hover.z}`} />
            <Row k="level" v={String(levelAt(map, hover.x, hover.z))} />
            <Row k="surface" v={SURFACE_NAME[surfaceAt(map, hover.x, hover.z)] ?? "?"} />
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
            const out = { ...islandMapDoc, ...serialiseIslandMap(map, props, annotations) };
            void navigator.clipboard.writeText(JSON.stringify(out, null, 1));
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          style={btn(false, {
            width: "100%",
            padding: "9px 0",
            background: copied ? "#7fd1c0" : "#1c2126",
            color: copied ? "#12161a" : "#c8cfd4",
          })}
        >
          {copied ? "copied — paste into data/island-map.json" : "Export map → clipboard"}
        </button>
        <div style={{ color: "#5c6670", marginTop: 8, lineHeight: 1.5 }}>
          Paste over <code>web/data/island-map.json</code>. Re-running
          <code> author-elevation.mjs</code> overwrites hand edits.
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
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span style={{ color: "#7d868e" }}>{k}</span>
      <span style={{ color: warn ? "#ff5577" : "#c8cfd4" }}>{v}</span>
    </div>
  );
}
