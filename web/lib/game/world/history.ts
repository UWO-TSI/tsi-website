/**
 * The world editor's undo and redo (Ctrl+Z, Ctrl+Shift+Z). An edit is one stroke: the terrain tiles it touched, as
 * they were before it (heights and paint, TILE × TILE samples a tile, copied the first time the stroke reaches them),
 * and the object list before it when the stroke changed objects. Undo swaps them back in (keeping what it replaced
 * for redo), so memory follows what was edited, not the map's size.
 */
import type { MapObject } from "../villageMap";
import type { Rect } from "./brushes";
import type { WorldTerrain } from "./terrain";

/** Samples a tile side. */
export const TILE = 32;
/** Strokes kept. */
export const UNDO_DEPTH = 200;

interface Tile { heights: Float32Array; paint: Uint8Array }
export interface Edit {
  tiles: Map<number, Tile>;
  objects: MapObject[] | null;
  label: string;
}

export class History {
  private undos: Edit[] = [];
  private redos: Edit[] = [];
  private open: Edit | null = null;

  /** Start a stroke (a press of a button, a placement). */
  begin(label: string): void {
    this.end();
    this.open = { tiles: new Map(), objects: null, label };
  }

  /** Before changing the terrain inside `r`: snapshot the tiles it reaches that this stroke has not yet. */
  touch(t: WorldTerrain, r: Rect): void {
    const e = this.open;
    if (!e) return;
    const tx = Math.ceil(t.cols / TILE);
    for (const key of tilesOf(t, r)) {
      if (e.tiles.has(key)) continue;
      e.tiles.set(key, copyTile(t, key % tx, Math.floor(key / tx)));
    }
  }

  /** Before changing the object list: keep it as it was (once a stroke). */
  objects(before: readonly MapObject[]): void {
    if (this.open && !this.open.objects) this.open.objects = before.map(o => ({ ...o }));
  }

  /** Finish the stroke; an empty one is dropped. */
  end(): void {
    const e = this.open;
    this.open = null;
    if (!e || (!e.tiles.size && !e.objects)) return;
    this.undos.push(e);
    if (this.undos.length > UNDO_DEPTH) this.undos.shift();
    this.redos = [];
  }

  get canUndo() { return this.undos.length > 0; }
  get canRedo() { return this.redos.length > 0; }
  get depth() { return this.undos.length; }

  /** Undo the last stroke: returns the rect of terrain it restored (null if none) and the objects to restore (null if unchanged). */
  undo(t: WorldTerrain, objects: readonly MapObject[]): { rect: Rect | null; objects: MapObject[] | null; label: string } | null {
    this.end();
    const e = this.undos.pop();
    if (!e) return null;
    const back = swap(t, e, objects);
    this.redos.push(back);
    return { rect: rectOfTiles(t, e.tiles), objects: e.objects, label: e.label };
  }

  redo(t: WorldTerrain, objects: readonly MapObject[]): { rect: Rect | null; objects: MapObject[] | null; label: string } | null {
    this.end();
    const e = this.redos.pop();
    if (!e) return null;
    const back = swap(t, e, objects);
    this.undos.push(back);
    return { rect: rectOfTiles(t, e.tiles), objects: e.objects, label: e.label };
  }
}

/** Put an edit's tiles and objects in place, returning the edit that puts back what was there. */
function swap(t: WorldTerrain, e: Edit, objects: readonly MapObject[]): Edit {
  const tx = Math.ceil(t.cols / TILE), back: Edit = { tiles: new Map(), objects: e.objects ? objects.map(o => ({ ...o })) : null, label: e.label };
  for (const [key, tile] of e.tiles) {
    const ti = key % tx, tk = Math.floor(key / tx);
    back.tiles.set(key, copyTile(t, ti, tk));
    pasteTile(t, ti, tk, tile);
  }
  t.revision++;
  return back;
}

function tilesOf(t: WorldTerrain, r: Rect): number[] {
  const tx = Math.ceil(t.cols / TILE), tz = Math.ceil(t.rows / TILE);
  const i0 = Math.max(0, Math.floor(((r.x0 - t.x0) * t.res - 1) / TILE)), i1 = Math.min(tx - 1, Math.floor(((r.x1 - t.x0) * t.res + 1) / TILE));
  const k0 = Math.max(0, Math.floor(((r.z0 - t.z0) * t.res - 1) / TILE)), k1 = Math.min(tz - 1, Math.floor(((r.z1 - t.z0) * t.res + 1) / TILE));
  const out: number[] = [];
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) out.push(k * tx + i);
  return out;
}

function copyTile(t: WorldTerrain, ti: number, tk: number): Tile {
  const i0 = ti * TILE, k0 = tk * TILE, w = Math.min(TILE, t.cols - i0), h = Math.min(TILE, t.rows - k0);
  const heights = new Float32Array(w * h), paint = new Uint8Array(w * h);
  for (let k = 0; k < h; k++) {
    const from = (k0 + k) * t.cols + i0;
    heights.set(t.heights.subarray(from, from + w), k * w);
    paint.set(t.paint.subarray(from, from + w), k * w);
  }
  return { heights, paint };
}

function pasteTile(t: WorldTerrain, ti: number, tk: number, tile: Tile) {
  const i0 = ti * TILE, k0 = tk * TILE, w = Math.min(TILE, t.cols - i0), h = Math.min(TILE, t.rows - k0);
  for (let k = 0; k < h; k++) {
    const to = (k0 + k) * t.cols + i0;
    t.heights.set(tile.heights.subarray(k * w, (k + 1) * w), to);
    t.paint.set(tile.paint.subarray(k * w, (k + 1) * w), to);
  }
}

function rectOfTiles(t: WorldTerrain, tiles: Map<number, Tile>): Rect | null {
  if (!tiles.size) return null;
  const tx = Math.ceil(t.cols / TILE);
  let i0 = Infinity, i1 = -Infinity, k0 = Infinity, k1 = -Infinity;
  for (const key of tiles.keys()) {
    const ti = key % tx, tk = Math.floor(key / tx);
    i0 = Math.min(i0, ti * TILE); i1 = Math.max(i1, Math.min(t.cols - 1, ti * TILE + TILE - 1));
    k0 = Math.min(k0, tk * TILE); k1 = Math.max(k1, Math.min(t.rows - 1, tk * TILE + TILE - 1));
  }
  return { x0: t.x0 + i0 / t.res, z0: t.z0 + k0 / t.res, x1: t.x0 + i1 / t.res, z1: t.z0 + k1 / t.res };
}
