/**
 * The smallest PNG codec the world files need (specs/world-editor.md "Data format"): 16-bit greyscale for the
 * heightmap and 8-bit indexed (with a palette, so the file previews in colour) for the surface map. Pure and
 * synchronous on both sides: zlib comes from the fflate build three ships, so the game, the editor, the dev save
 * route, the conversion script and the tests all read and write the same bytes.
 *
 * Writing is deterministic (the same pixels give the same file: every row takes the PNG filter with the smallest sum
 * of absolute bytes, then zlib at level 9), so re-saving an unchanged world leaves git clean. Reading checks every
 * chunk's CRC and refuses interlaced or unexpected images rather than guessing.
 */
import { unzlibSync, zlibSync } from "three/examples/jsm/libs/fflate.module.js";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  /** 0 greyscale, 3 indexed (the two this codec writes; 2 and 6 are read for completeness). */
  colorType: number;
  /** Unfiltered pixel bytes, row after row (16-bit samples big-endian). */
  pixels: Uint8Array;
  /** RGB triples, for indexed images. */
  palette?: number[];
}

const channelsOf = (colorType: number) => (colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Filter one row (`cur`, previous `prev`) with filter `f` into `out` (no filter byte). */
function filterRow(f: number, cur: Uint8Array, prev: Uint8Array | null, bpp: number, out: Uint8Array) {
  for (let i = 0; i < cur.length; i++) {
    const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
    const x = cur[i];
    out[i] = (f === 0 ? x : f === 1 ? x - a : f === 2 ? x - b : f === 3 ? x - ((a + b) >> 1) : x - paeth(a, b, c)) & 0xff;
  }
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/** A PNG from raw pixel bytes (rows top to bottom), each row's filter picked by the minimum-sum heuristic. */
function encode(pixels: Uint8Array, width: number, height: number, bitDepth: number, colorType: number, palette?: number[]): Uint8Array {
  const bpp = Math.max(1, (channelsOf(colorType) * bitDepth) >> 3), stride = (width * channelsOf(colorType) * bitDepth + 7) >> 3;
  const raw = new Uint8Array((stride + 1) * height), trial = new Uint8Array(stride), best = new Uint8Array(stride);
  for (let k = 0; k < height; k++) {
    const cur = pixels.subarray(k * stride, (k + 1) * stride), prev = k ? pixels.subarray((k - 1) * stride, k * stride) : null;
    let bestF = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      filterRow(f, cur, prev, bpp, trial);
      let sum = 0;
      for (let i = 0; i < stride; i++) sum += trial[i] < 128 ? trial[i] : 256 - trial[i];
      if (sum < bestSum) { bestSum = sum; bestF = f; best.set(trial); }
    }
    raw[k * (stride + 1)] = bestF;
    raw.set(best, k * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = bitDepth; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [new Uint8Array(SIGNATURE), chunk("IHDR", ihdr)];
  if (palette) parts.push(chunk("PLTE", new Uint8Array(palette)));
  parts.push(chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** 16-bit greyscale PNG from samples row after row. */
export function encodeGray16(values: Uint16Array, width: number, height: number): Uint8Array {
  if (values.length !== width * height) throw new Error(`gray16: ${values.length} samples for ${width}×${height}`);
  const px = new Uint8Array(values.length * 2);
  for (let i = 0; i < values.length; i++) { px[i * 2] = values[i] >> 8; px[i * 2 + 1] = values[i] & 0xff; }
  return encode(px, width, height, 16, 0);
}

/** 8-bit indexed PNG: `ids` row after row, `palette` the RGB of each id (it is what a viewer shows; readers take the ids). */
export function encodeIndexed(ids: Uint8Array, width: number, height: number, palette: readonly (readonly [number, number, number])[]): Uint8Array {
  if (ids.length !== width * height) throw new Error(`indexed: ${ids.length} ids for ${width}×${height}`);
  if (!palette.length || palette.length > 256) throw new Error("indexed: the palette needs 1 to 256 colours");
  for (const id of ids) if (id >= palette.length) throw new Error(`indexed: id ${id} has no palette colour`);
  return encode(ids, width, height, 8, 3, palette.flatMap(c => [c[0], c[1], c[2]]));
}

/** Read a PNG: every chunk's CRC checked, the image data inflated and unfiltered. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error("not a PNG file");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8, width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0, palette: number[] | undefined;
  const idat: Uint8Array[] = [];
  let ended = false;
  while (at + 12 <= bytes.length) {
    const len = dv.getUint32(at), type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    if (at + 12 + len > bytes.length) throw new Error(`PNG chunk ${type} runs past the end of the file`);
    if (crc32(bytes, at + 4, at + 8 + len) !== dv.getUint32(at + 8 + len)) throw new Error(`PNG chunk ${type} is corrupt (CRC mismatch)`);
    const data = bytes.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      width = dv.getUint32(at + 8); height = dv.getUint32(at + 12); bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "PLTE") palette = Array.from(data);
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") { ended = true; break; }
    at += 12 + len;
  }
  if (!ended || !width || !height || colorType < 0) throw new Error("PNG is missing IHDR, IDAT or IEND");
  if (interlace) throw new Error("interlaced PNGs are not supported");
  const total = idat.reduce((n, d) => n + d.length, 0), z = new Uint8Array(total);
  let p = 0;
  for (const d of idat) { z.set(d, p); p += d.length; }
  const raw = unzlibSync(z);
  const bpp = Math.max(1, (channelsOf(colorType) * bitDepth) >> 3), stride = (width * channelsOf(colorType) * bitDepth + 7) >> 3;
  if (raw.length < (stride + 1) * height) throw new Error("PNG image data is truncated");
  const pixels = new Uint8Array(stride * height);
  for (let k = 0; k < height; k++) {
    const f = raw[k * (stride + 1)], src = raw.subarray(k * (stride + 1) + 1, (k + 1) * (stride + 1));
    const row = pixels.subarray(k * stride, (k + 1) * stride), prev = k ? pixels.subarray((k - 1) * stride, k * stride) : null;
    if (f > 4) throw new Error(`PNG row ${k} has an unknown filter ${f}`);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
      const x = src[i];
      row[i] = (f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    }
  }
  return { width, height, bitDepth, colorType, pixels, palette };
}

/** The samples of a 16-bit greyscale PNG. */
export function gray16Of(png: DecodedPng): { width: number; height: number; data: Uint16Array } {
  if (png.colorType !== 0 || png.bitDepth !== 16) throw new Error(`expected a 16-bit greyscale PNG, got colour type ${png.colorType} at ${png.bitDepth} bits`);
  const data = new Uint16Array(png.width * png.height);
  for (let i = 0; i < data.length; i++) data[i] = (png.pixels[i * 2] << 8) | png.pixels[i * 2 + 1];
  return { width: png.width, height: png.height, data };
}

/** The palette indices of an 8-bit indexed PNG. */
export function indicesOf(png: DecodedPng): { width: number; height: number; data: Uint8Array } {
  if (png.colorType !== 3 || png.bitDepth !== 8) throw new Error(`expected an 8-bit indexed PNG, got colour type ${png.colorType} at ${png.bitDepth} bits`);
  return { width: png.width, height: png.height, data: png.pixels.slice() };
}
