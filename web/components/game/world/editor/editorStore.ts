/**
 * The world editor's state and operations (specs/world-editor.md v0 step 5), outside React: the scene reads and writes
 * it every frame (the camera, the crosshair, a held button's stroke), the HUD re-renders when `bump` says something it
 * shows changed. Terrain edits go through here so each one is snapshotted for undo, handed to the view (only the
 * touched chunks are rewritten) and, when a stroke ends, to the water's field and the grass.
 */
import { useSyncExternalStore } from "react";
import { LEVEL_STEP } from "@/lib/game/grid";
import { objectFootprint } from "@/lib/game/defaultIsland";
import { isJoinedFence } from "@/lib/game/fences";
import { snapPlacement } from "@/lib/game/painterTools";
import { PROPOSALS, acceptProposed, pendingOf } from "@/lib/game/proposals";
import type { MapObject } from "@/lib/game/villageMap";
import {
  applyBrush, cellAt, cellHeight, cellSet, cellSquare, layRoad, nextLevel, padUnder, unionRect, CELL_EDGE, PAD, ROAD, type BrushTool, type Rect,
} from "@/lib/game/world/brushes";
import { DEFAULT_HOTBAR, HOTBAR_KEY, hotbarFrom, placeItem, type EditorItem } from "@/lib/game/world/editorTools";
import { encodeWorld, toBase64, type World } from "@/lib/game/world/format";
import { History } from "@/lib/game/world/history";
import type { RayHit } from "@/lib/game/world/raycast";
import { Paint, refreshShoreField, terrainHeight, terrainShoreField } from "@/lib/game/world/terrain";
import { patchShoreField, setShoreField } from "../../grid/terrainMaterials";
import type { TerrainView } from "../terrainView";

export type Mode = "brush" | "cell";

export interface Stroke {
  item: EditorItem;
  button: 0 | 2;
  /** 1 raises, places or fills; −1 lowers, removes or cuts. */
  dir: 1 | -1;
  at: number;
  /** The union of what the stroke changed. */
  rect: Rect | null;
  /** Cell mode: the cell the stroke is on, the level it sets, when it last stepped. */
  cell?: string;
  level?: number;
  stepped?: number;
  /** Flatten: the height where the stroke began. */
  target?: number;
  /** A road being laid: its last point and height. */
  road?: { x: number; z: number; y: number };
  seed: number;
}

export const ed = {
  world: null as World | null,
  objects: [] as MapObject[],
  history: new History(),
  view: null as TerrainView | null,
  shore: null as ReturnType<typeof terrainShoreField> | null,
  hotbar: [...DEFAULT_HOTBAR] as EditorItem[],
  slot: 0,
  palette: false,
  help: true,
  mode: "brush" as Mode,
  radius: 5,
  strength: 0.5,
  hard: false,
  cellN: 1,
  cellStep: LEVEL_STEP,
  levelTarget: null as number | null,
  ghostYaw: 0,
  selected: null as string | null,
  overhead: false,
  locked: false,
  walking: false,
  hit: null as RayHit | null,
  stroke: null as Stroke | null,
  /** The road being laid with clicks (point to point), until another tool or the left button ends it. */
  road: null as { x: number; z: number; y: number } | null,
  dirty: false,
  saving: false,
  status: "",
  /** Terrain and object revisions: the grass refills on the first, the objects redraw on the second. */
  grassRevision: 0,
  objectsRevision: 0,
  stats: { fps: 0, draws: 0, triangles: 0, chunks: 0, lods: [0, 0, 0, 0], frameMs: 0, editMs: 0 },
  /** Where the camera is, for "walk it" and the HUD. */
  camera: { x: 0, y: 0, z: 0 },
};

// ── HUD subscription ─────────────────────────────────────────────────
let version = 0;
const listeners = new Set<() => void>();
export function bump(): void { version++; for (const l of listeners) l(); }
export function useEditor(): number {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version, () => 0);
}

export const item = () => ed.hotbar[ed.slot];
export const say = (status: string) => { ed.status = status; bump(); };

export function loadHotbar(): void {
  try { ed.hotbar = hotbarFrom(JSON.parse(window.localStorage.getItem(HOTBAR_KEY) ?? "null")); } catch { ed.hotbar = [...DEFAULT_HOTBAR]; }
}
export function setSlotItem(i: number, it: EditorItem): void {
  ed.hotbar[i] = it;
  try { window.localStorage.setItem(HOTBAR_KEY, JSON.stringify(ed.hotbar.map(h => h.label))); } catch { /* per-browser convenience */ }
  endRoad();
  bump();
}
export function selectSlot(i: number): void {
  if (i === ed.slot) return;
  ed.slot = i;
  endRoad();
  bump();
}

// ── Terrain edits ────────────────────────────────────────────────────
/** Around a circle, as a rect. */
const around = (x: number, z: number, r: number): Rect => ({ x0: x - r, z0: z - r, x1: x + r, z1: z + r });

/** Snapshot what an edit may change, apply it, hand the result to the view. */
function edit(rect: Rect, apply: () => Rect | null): Rect | null {
  const t = ed.world!.terrain;
  ed.history.touch(t, rect);
  const changed = apply();
  if (changed) {
    ed.view?.edit(changed.x0, changed.z0, changed.x1, changed.z1);
    if (ed.stroke) ed.stroke.rect = unionRect(ed.stroke.rect, changed);
    if (!ed.dirty) { ed.dirty = true; bump(); }
  }
  return changed;
}

/** The water's field and the grass, for what a stroke changed (once the stroke is done: the field's transform is the heavy part). */
export function settle(rect: Rect | null): void {
  if (!rect || !ed.world) return;
  const t = ed.world.terrain;
  if (ed.shore) {
    refreshShoreField(t, ed.shore, rect.x0 - 1, rect.z0 - 1, rect.x1 + 1, rect.z1 + 1);
    const j0 = Math.floor((rect.z0 - 14 - ed.shore.minZ) * ed.shore.scale), j1 = Math.ceil((rect.z1 + 14 - ed.shore.minZ) * ed.shore.scale);
    if (!patchShoreField(ed.shore, j0, j1)) setShoreField(ed.shore);
  }
  ed.grassRevision++;
  bump();
}

const cellKey = (cx: number, cz: number) => `${cx}:${cz}`;
const isTerrainTool = (tool: BrushTool) => tool === "raise" || tool === "lower" || tool === "flatten" || tool === "level";

/** Begin a stroke: a button went down with the crosshair on the ground. */
export function beginStroke(button: 0 | 2, alt: boolean): void {
  const hit = ed.hit, it = item();
  if (!hit || !ed.world) return;
  // Alt (or the middle button, handled by the caller) samples a height for the level tool.
  if (alt) { ed.levelTarget = hit.y; say(`Level height ${hit.y.toFixed(2)}`); return; }
  const dir: 1 | -1 = button === 2 ? 1 : -1;
  ed.stroke = { item: it, button, dir, at: performance.now(), rect: null, seed: Math.floor(Math.random() * 1e6) };
  ed.history.begin(it.label);
  if (it.type === "place") { placeOrRemove(it, dir, hit); return; }
  if (it.type === "select") { if (button === 0) pick(hit); else if (selectedObject()) ed.history.objects(ed.objects); return; }
  if (it.type === "road") { if (button === 0) { endRoad(); say("Road ended"); } else roadTo(hit, it.paint); return; }
  if (it.type === "brush" && it.tool === "flatten") ed.stroke.target = hit.y;
  if (it.type === "brush" && it.tool === "level" && ed.levelTarget === null) { ed.levelTarget = hit.y; bump(); }
  strokeFrame(0, true);
}

/** While a button is held (each frame): the tool's work at the crosshair. */
export function strokeFrame(dt: number, first = false): void {
  const s = ed.stroke, hit = ed.hit, t = ed.world?.terrain;
  if (!s || !hit || !t) return;
  const it = s.item;
  if (it.type === "select" && s.button === 2) { moveSelected(hit); return; }
  if (it.type === "road" && s.button === 2 && !first) {
    // Dragging: lay the road on in 2-unit segments.
    if (ed.road && Math.hypot(hit.x - ed.road.x, hit.z - ed.road.z) >= 2) roadTo(hit, it.paint);
    return;
  }
  if (it.type !== "brush" && it.type !== "paint") return;
  if (ed.mode === "cell" && (it.type === "paint" || isTerrainTool(it.tool))) { cellFrame(s, hit, first); return; }
  const tool: BrushTool = it.type === "paint" ? "paint" : it.tool === "raise" || it.tool === "lower" ? (s.dir > 0 ? "raise" : "lower") : it.tool;
  const r = ed.radius, b = {
    x: hit.x, z: hit.z, radius: r, strength: ed.strength * (s.button === 2 && (tool === "smooth" || tool === "roughen" || tool === "erode") ? 1.6 : 1),
    hard: ed.hard, dt: first ? 1 / 60 : dt, seed: s.seed,
    target: it.type === "brush" && it.tool === "level" ? ed.levelTarget ?? hit.y : s.target,
    mode: (s.dir > 0 ? "fill" : "cut") as "fill" | "cut",
    paint: it.type === "paint" ? (s.dir > 0 ? it.paint : Paint.Grass) : undefined,
  };
  edit(around(hit.x, hit.z, r), () => applyBrush(t, tool, b));
}

/** Cell mode: a press sets the square a step up or down; held, it steps again every CELL_REPEAT; dragged, it carries the level on. */
const CELL_REPEAT = 0.35;
function cellFrame(s: Stroke, hit: RayHit, first: boolean) {
  const t = ed.world!.terrain, it = s.item, [cx, cz] = cellAt(t, hit.x, hit.z), key = cellKey(cx, cz), now = performance.now() / 1000;
  const sq = cellSquare(t, cx, cz, ed.cellN);
  const rect: Rect = { x0: t.originX + sq.cx0 - 0.5 - CELL_EDGE.reach, z0: t.originZ + sq.cz0 - 0.5 - CELL_EDGE.reach, x1: t.originX + sq.cx1 + 0.5 + CELL_EDGE.reach, z1: t.originZ + sq.cz1 + 0.5 + CELL_EDGE.reach };
  if (it.type === "paint") {
    if (!first && key === s.cell) return;
    s.cell = key;
    const id = s.dir > 0 ? it.paint : Paint.Grass;
    edit(rect, () => {
      let changed = false;
      for (let k = sq.cz0 * t.res; k <= (sq.cz1 + 1) * t.res; k++) for (let i = sq.cx0 * t.res; i <= (sq.cx1 + 1) * t.res; i++) {
        const p = k * t.cols + i;
        if (p >= 0 && p < t.paint.length && t.paint[p] !== id) { t.paint[p] = id; changed = true; }
      }
      if (changed) t.revision++;
      return changed ? rect : null;
    });
    return;
  }
  if (it.type !== "brush") return;
  const dir = it.tool === "lower" ? (s.dir > 0 ? 1 : -1) : s.dir;
  if (first || key !== s.cell) {
    // A new cell: the stroke's level (set by its first cell), or the level/flatten target.
    if (s.level === undefined) {
      const h = cellHeight(t, cx, cz);
      s.level = it.tool === "level" ? ed.levelTarget ?? h : it.tool === "flatten" ? h : nextLevel(h, ed.cellStep, dir);
    }
    s.cell = key; s.stepped = now;
  } else if (now - (s.stepped ?? now) >= CELL_REPEAT && (it.tool === "raise" || it.tool === "lower")) {
    // Held on one cell: another step.
    s.level = nextLevel(s.level!, ed.cellStep, dir); s.stepped = now;
  } else return;
  edit(rect, () => cellSet(t, sq, s.level!, dir, ed.cellStep));
}

/** The button came up. */
export function endStroke(): void {
  const s = ed.stroke;
  if (!s) return;
  ed.stroke = null;
  if (s.item.type === "select" && s.button === 2) padSelected();
  ed.history.end();
  settle(s.rect);
  bump();
}

// ── Roads ────────────────────────────────────────────────────────────
function roadTo(hit: RayHit, paint: number) {
  const t = ed.world!.terrain;
  if (!ed.road) { ed.road = { x: hit.x, z: hit.z, y: terrainHeight(t, hit.x, hit.z) }; say("Road started: right-click on along it, left-click ends"); return; }
  const from = ed.road, pts: [number, number][] = [[from.x, from.z], [hit.x, hit.z]], reach = ROAD.width / 2 + ROAD.shoulder + 0.5;
  const rect: Rect = { x0: Math.min(from.x, hit.x) - reach, z0: Math.min(from.z, hit.z) - reach, x1: Math.max(from.x, hit.x) + reach, z1: Math.max(from.z, hit.z) + reach };
  edit(rect, () => layRoad(t, pts, { paint, startY: from.y }));
  ed.road = { x: hit.x, z: hit.z, y: terrainHeight(t, hit.x, hit.z) };
}
export function endRoad(): void { ed.road = null; }

// ── Objects ──────────────────────────────────────────────────────────
export const keyOf = (o: Pick<MapObject, "kind" | "id">) => `${o.kind}:${o.id}`;
export const selectedObject = () => ed.objects.find(o => keyOf(o) === ed.selected) ?? null;

function setObjects(next: MapObject[]) {
  ed.objects = next;
  ed.objectsRevision++;
  ed.dirty = true;
  bump();
}

/** The object under (x, z): inside a footprint, else the nearest within reach. */
export function objectAt(x: number, z: number, reach = 1.4): MapObject | null {
  let best: MapObject | null = null, bestD = reach;
  for (const o of ed.objects) {
    const f = objectFootprint(o), yaw = o.yaw ?? 0, dx = x - o.x, dz = z - o.z;
    if (f) {
      const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw) - f.cx, lz = dx * Math.sin(yaw) + dz * Math.cos(yaw) - f.cz;
      if (Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd) return o;
    }
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/** Is this a building (it levels its pad)? */
const isBuilding = (o: MapObject) => o.kind === "house" || (o.kind === "landmark" && o.id !== "wharf" && !!objectFootprint(o));

function padFor(o: MapObject) {
  const f = objectFootprint(o), t = ed.world!.terrain;
  if (!f || !isBuilding(o)) return;
  const reach = Math.hypot(f.hw, f.hd) + PAD.rim + PAD.ease + 1;
  edit(around(o.x, o.z, reach), () => padUnder(t, o.x, o.z, f.hw, f.hd, o.yaw ?? 0));
}

function placeOrRemove(it: Extract<EditorItem, { type: "place" }>, dir: 1 | -1, hit: RayHit) {
  ed.history.objects(ed.objects);
  if (dir < 0) {
    const o = objectAt(hit.x, hit.z);
    if (o) { setObjects(ed.objects.filter(x => x !== o)); say(`Removed ${o.kind} ${o.id}`); }
    return;
  }
  // Buildings sit their footprint's edges on cell edges (ACNH grid law, as /lab/map snaps them); the rest on half cells.
  const probe = { id: it.object.id ?? "x", kind: it.object.kind, x: 0, z: 0, model: it.object.model, yaw: ed.ghostYaw, scale: it.object.kind === "landmark" && it.building ? 1.15 : 1 } as MapObject;
  const f = it.building ? objectFootprint(probe) : null;
  // A connectable fence post on a whole cell, so the posts beside it join (lib/game/fences.ts).
  const [x, z] = f ? snapPlacement(hit.x, hit.z, 0, [f.hw, f.hd]) : snapPlacement(hit.x, hit.z, isJoinedFence(probe) ? 1 : 0.5);
  const next = placeItem(it, ed.objects, x, z, ed.ghostYaw);
  const placed = next.find(o => !ed.objects.includes(o)) ?? null;
  setObjects(next);
  if (placed) { ed.selected = keyOf(placed); if (it.building) padFor(placed); say(`Placed ${placed.kind} ${placed.id}`); }
}

function pick(hit: RayHit) {
  const o = objectAt(hit.x, hit.z);
  ed.selected = o ? keyOf(o) : null;
  say(o ? `Selected ${o.kind} ${o.id}${o.model ? ` (${o.model})` : ""}` : "Nothing selected");
}

function moveSelected(hit: RayHit) {
  const o = selectedObject();
  if (!o) return;
  const r = (v: number) => (isJoinedFence(o) ? Math.round(v) : Math.round(v * 1000) / 1000);
  setObjects(ed.objects.map(x => (x === o ? { ...o, x: r(hit.x), z: r(hit.z) } : x)));
}

function padSelected() {
  const o = selectedObject();
  if (o && isBuilding(o)) padFor(o);
}

/** Turn the selection (or the placement ghost) by a step. */
export function rotate(step: number): void {
  const o = selectedObject(), it = item();
  if (it.type === "place") { ed.ghostYaw += step; bump(); return; }
  if (!o) return;
  ed.history.begin("Rotate");
  ed.history.objects(ed.objects);
  setObjects(ed.objects.map(x => (x === o ? { ...o, yaw: Math.round((((o.yaw ?? 0) + step) % (Math.PI * 2)) * 1000) / 1000 } : x)));
  const moved = selectedObject();
  if (moved && isBuilding(moved)) padFor(moved);
  endStrokeHistory();
}

export function scaleSelected(factor: number): void {
  const o = selectedObject();
  if (!o) return;
  ed.history.begin("Scale");
  ed.history.objects(ed.objects);
  const scale = Math.max(0.3, Math.min(3, Math.round((o.scale ?? 1) * factor * 100) / 100));
  setObjects(ed.objects.map(x => (x === o ? { ...o, ...(scale === 1 ? { scale: undefined } : { scale }) } : x)));
  endStrokeHistory();
}

export function deleteSelected(): void {
  const o = selectedObject();
  if (!o) return;
  ed.history.begin("Delete");
  ed.history.objects(ed.objects);
  setObjects(ed.objects.filter(x => x !== o));
  ed.selected = null;
  endStrokeHistory();
  say(`Deleted ${o.kind} ${o.id}`);
}

function endStrokeHistory() {
  const rect = ed.stroke?.rect ?? null;
  ed.history.end();
  settle(rect);
}

/** Accept a proposal's pending objects (or all proposals'), undoable. */
export function acceptProposals(index?: number): void {
  const items = PROPOSALS.filter(p => p.target === "world-map").filter((_, i) => index === undefined || i === index).flatMap(p => pendingOf(p, ed.objects));
  if (!items.length) return;
  ed.history.begin("Accept proposals");
  ed.history.objects(ed.objects);
  setObjects(acceptProposed(ed.objects, items));
  ed.history.end();
  say(`Accepted ${items.length} proposed object${items.length === 1 ? "" : "s"}`);
}

// ── Undo, redo, save ─────────────────────────────────────────────────
export function undo(redo = false): void {
  if (!ed.world) return;
  endStroke();
  const r = redo ? ed.history.redo(ed.world.terrain, ed.objects) : ed.history.undo(ed.world.terrain, ed.objects);
  if (!r) { say(redo ? "Nothing to redo" : "Nothing to undo"); return; }
  if (r.rect) { ed.view?.edit(r.rect.x0, r.rect.z0, r.rect.x1, r.rect.z1); settle(r.rect); }
  if (r.objects) setObjects(r.objects);
  ed.dirty = true;
  say(`${redo ? "Redid" : "Undid"}: ${r.label}`);
}

export async function save(): Promise<void> {
  if (!ed.world || ed.saving) return;
  ed.saving = true;
  say("Saving…");
  try {
    const files = encodeWorld({ ...ed.world, objects: ed.objects });
    const res = await fetch("/api/lab/world", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: files.json, height: toBase64(files.height), surface: toBase64(files.surface) }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    ed.dirty = false;
    say(`Saved web/data/world (${Math.round(files.height.length / 1024)} KB heights) at ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    say(`Save failed: ${(e as Error).message}`);
  } finally {
    ed.saving = false;
    bump();
  }
}

/** The world's water field, baked once the world is loaded (the editor refreshes it by region after each stroke). */
export function bakeShore(): void {
  if (!ed.world) return;
  ed.shore = terrainShoreField(ed.world.terrain);
  setShoreField(ed.shore);
}
