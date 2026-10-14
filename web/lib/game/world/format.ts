/**
 * The world files (specs/world-editor.md "Data format"): three files in `web/data/world/`, read by one loader that the
 * game, the editor, the dev save route, the conversion script and the tests share.
 *
 * - `world.json`: the document. Its grid (cells, origin, samples per unit), the heightmap's range, the sea level, the
 *   paint names, the two image files' names, then the annotations and the objects, one per line (a readable diff).
 * - `height.png`: 16-bit greyscale, (width·res + 1) × (depth·res + 1) samples, row 0 at the map's low z. A sample's
 *   value q is the height heightRange[0] + q · (heightRange[1] − heightRange[0]) / 65535, about 0.7 mm a step.
 * - `surface.png`: 8-bit indexed, the same grid, each pixel a paint id (the palette is only how it previews).
 *
 * LOSSLESS. Heights are quantised to the 16-bit step when written and read back to exactly the value they stand for,
 * so load → save gives the same bytes and save → load → save is stable. The PNG writer is deterministic.
 */
import type { MapAnnotation } from "../grid";
import { parseObjects, type MapObject } from "../villageMap";
import { decodePng, encodeGray16, encodeIndexed, gray16Of, indicesOf } from "./png";
import { PAINT_NAMES, PAINT_SWATCH, createTerrain, type WorldTerrain } from "./terrain";

export const WORLD_FORMAT = "tethos-world";
export const WORLD_VERSION = 1;
export const HEIGHT_FILE = "height.png";
export const SURFACE_FILE = "surface.png";

/** `world.json`. */
export interface WorldDoc {
  format: typeof WORLD_FORMAT;
  version: number;
  /** Cells (world units) along x and z, and the world centre of cell (0, 0): the old grid's, unchanged. */
  width: number;
  depth: number;
  originX: number;
  originZ: number;
  /** Height and paint samples per world unit. */
  resolution: number;
  /** World heights of the heightmap's 0 and 65535. */
  heightRange: [number, number];
  /** The still water's surface, world units. */
  seaLevel: number;
  /** Paint names by id: what surface.png's values mean. */
  surfaces: string[];
  /** The two image files, beside world.json. */
  height: string;
  surface: string;
  /** Where the terrain came from (the conversion stamps it). Written, never read. */
  source?: string;
  annotations?: { name: string; color?: string; cells: number[][] }[];
  objects?: { id: string; kind: string; x: number; z: number; yaw?: number; scale?: number; seed?: number; model?: string }[];
}

/** A world in memory: its terrain, its objects and its annotations. */
export interface World {
  terrain: WorldTerrain;
  objects: MapObject[];
  annotations: MapAnnotation[];
  source?: string;
}

/** The three files' bytes. */
export interface WorldFiles {
  json: string;
  height: Uint8Array;
  surface: Uint8Array;
}

/** Why a document can't be read, or null. */
export function worldDocProblem(doc: unknown): string | null {
  if (!doc || typeof doc !== "object") return "not a world document";
  const d = doc as Partial<WorldDoc>;
  if (d.format !== WORLD_FORMAT) return `format must be "${WORLD_FORMAT}"`;
  if (d.version !== WORLD_VERSION) return `version ${d.version} is not ${WORLD_VERSION}`;
  const whole = (n: unknown, max: number) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= max;
  if (!whole(d.width, 2048) || !whole(d.depth, 2048)) return "width and depth must be whole numbers of cells up to 2048";
  if (!whole(d.resolution, 8)) return "resolution must be 1 to 8 samples per unit";
  if (!Number.isFinite(d.originX) || !Number.isFinite(d.originZ) || !Number.isFinite(d.seaLevel)) return "origin and sea level must be numbers";
  if (!Array.isArray(d.heightRange) || d.heightRange.length !== 2 || !(d.heightRange[1] > d.heightRange[0])) return "heightRange must be [low, high]";
  if (!Array.isArray(d.surfaces) || !d.surfaces.length) return "surfaces must name the paints";
  if (typeof d.height !== "string" || typeof d.surface !== "string") return "height and surface must name the image files";
  if (d.objects !== undefined && !Array.isArray(d.objects)) return "objects must be a list";
  if (d.annotations !== undefined && !Array.isArray(d.annotations)) return "annotations must be a list";
  return null;
}

/** Height ↔ the heightmap's 16-bit value. */
export function quantise(h: number, range: readonly [number, number]): number {
  const q = Math.round(((h - range[0]) / (range[1] - range[0])) * 65535);
  return q < 0 ? 0 : q > 65535 ? 65535 : q;
}
export const dequantise = (q: number, range: readonly [number, number]) => range[0] + (q * (range[1] - range[0])) / 65535;

/** Snap every height to what the file will hold (an editor can call it before saving, so what it shows is what it saves). */
export function quantiseTerrain(t: WorldTerrain): void {
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = dequantise(quantise(t.heights[i], t.heightRange), t.heightRange);
}

/** Read a world from its document and its two images' bytes. Throws, naming the problem, on anything malformed. */
export function decodeWorld(doc: WorldDoc, heightPng: Uint8Array, surfacePng: Uint8Array): World {
  const bad = worldDocProblem(doc);
  if (bad) throw new Error(`world.json: ${bad}`);
  const t = createTerrain(doc.width, doc.depth, doc.originX, doc.originZ, { res: doc.resolution, seaLevel: doc.seaLevel, heightRange: [doc.heightRange[0], doc.heightRange[1]] });
  const h = gray16Of(decodePng(heightPng)), s = indicesOf(decodePng(surfacePng));
  for (const [name, img] of [[doc.height, h], [doc.surface, s]] as const) {
    if (img.width !== t.cols || img.height !== t.rows) throw new Error(`${name} is ${img.width}×${img.height}, the grid wants ${t.cols}×${t.rows}`);
  }
  for (let i = 0; i < t.heights.length; i++) t.heights[i] = dequantise(h.data[i], t.heightRange);
  for (let i = 0; i < t.paint.length; i++) {
    if (s.data[i] >= doc.surfaces.length) throw new Error(`${doc.surface}: sample ${i} has paint ${s.data[i]}, which surfaces does not name`);
    t.paint[i] = s.data[i];
  }
  const annotations: MapAnnotation[] = (doc.annotations ?? []).map(a => ({
    name: String(a.name), color: a.color ?? "#ffffff",
    cells: (a.cells ?? []).filter(c => Array.isArray(c) && c.length === 2).map(c => [c[0], c[1]] as [number, number]),
  }));
  return { terrain: t, objects: parseObjects(doc.objects), annotations, ...(doc.source ? { source: doc.source } : {}) };
}

/** The document for a world (no image bytes). */
export function worldDocOf(w: World): WorldDoc {
  const t = w.terrain;
  return {
    format: WORLD_FORMAT, version: WORLD_VERSION,
    width: t.width, depth: t.depth, originX: t.originX, originZ: t.originZ,
    resolution: t.res, heightRange: [t.heightRange[0], t.heightRange[1]], seaLevel: t.seaLevel,
    surfaces: [...PAINT_NAMES], height: HEIGHT_FILE, surface: SURFACE_FILE,
    ...(w.source ? { source: w.source } : {}),
    ...(w.annotations.length ? { annotations: w.annotations.map(a => ({ name: a.name, color: a.color, cells: a.cells.map(c => [c[0], c[1]]) })) } : {}),
    objects: w.objects.map(o => ({ ...o })),
  };
}

/** Pretty JSON for the repo: the header a key a line, then one annotation and one object a line. */
export function worldJson(doc: WorldDoc): string {
  const rows = (a: readonly unknown[]) => `[\n${a.map(r => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
  const keys = ["format", "version", "width", "depth", "originX", "originZ", "resolution", "heightRange", "seaLevel", "surfaces", "height", "surface", "source"] as const;
  const head = keys.filter(k => doc[k] !== undefined).map(k => `  "${k}": ${JSON.stringify(doc[k])}`);
  const tail: string[] = [];
  if (doc.annotations?.length) tail.push(`  "annotations": ${rows(doc.annotations)}`);
  tail.push(`  "objects": ${rows(doc.objects ?? [])}`);
  return `{\n${[...head, ...tail].join(",\n")}\n}\n`;
}

/** A world's three files. Heights are quantised on the way out (the terrain in memory is not touched). */
export function encodeWorld(w: World): WorldFiles {
  const t = w.terrain, q = new Uint16Array(t.heights.length);
  for (let i = 0; i < q.length; i++) q[i] = quantise(t.heights[i], t.heightRange);
  return {
    json: worldJson(worldDocOf(w)),
    height: encodeGray16(q, t.cols, t.rows),
    surface: encodeIndexed(t.paint, t.cols, t.rows, PAINT_SWATCH),
  };
}

/** Bytes ↔ base64, for moving the images through JSON (the dev save route). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
