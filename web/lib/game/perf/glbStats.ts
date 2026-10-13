/**
 * What a GLB costs to draw, read straight from its bytes (specs/perf/budget.md; the asset budget tests,
 * lib/game/perf/budget.test.ts): triangles, draw primitives, distinct materials, the largest embedded texture and
 * the skins' bone counts. No three.js, no DOM: the JSON chunk and the embedded images' headers only.
 */

export interface GlbStats {
  /** Triangles over every mesh primitive (indexed or not; strips and fans counted as triangles; points and lines 0). */
  triangles: number;
  /** Mesh primitives: each is one draw call where its node is drawn (instancing aside). */
  primitives: number;
  /** Distinct materials the primitives use. */
  materials: number;
  /** Embedded images, and the largest one's longer side in pixels (0 when there are none). */
  textures: number;
  maxTexture: number;
  /** The longest skin's joint count (0: not skinned). */
  bones: number;
  /** Animation clips. */
  animations: number;
}

interface Accessor { count: number }
interface Primitive { indices?: number; attributes: Record<string, number>; material?: number; mode?: number }
interface GltfJson {
  accessors?: Accessor[];
  meshes?: { primitives: Primitive[] }[];
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  skins?: { joints: number[] }[];
  animations?: unknown[];
}

const MAGIC = 0x46546c67, JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;

/** The JSON and the binary chunk of a GLB (throws on anything that isn't one). */
export function readGlb(bytes: Uint8Array): { json: GltfJson; bin: Uint8Array | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) throw new Error("not a GLB");
  let at = 12, json: GltfJson | null = null, bin: Uint8Array | null = null;
  while (at + 8 <= bytes.byteLength) {
    const length = view.getUint32(at, true), type = view.getUint32(at + 4, true), body = bytes.subarray(at + 8, at + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(new TextDecoder().decode(body)) as GltfJson;
    else if (type === BIN_CHUNK) bin = body;
    at += 8 + length;
  }
  if (!json) throw new Error("GLB without a JSON chunk");
  return { json, bin };
}

/** An image's pixel size from its header (PNG, JPEG, WebP, KTX2); null for a format it doesn't know. */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 24 && v.getUint32(0) === 0x89504e47) return { width: v.getUint32(16), height: v.getUint32(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: v.getUint16(i + 5), width: v.getUint16(i + 7) };
      i += 2 + v.getUint16(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === "VP8 ") return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
    if (kind === "VP8L") { const bits = v.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    if (kind === "VP8X") return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    return null;
  }
  if (b.length >= 28 && b[0] === 0xab && b[1] === 0x4b && b[2] === 0x54 && b[3] === 0x58) return { width: v.getUint32(20, true), height: v.getUint32(24, true) };
  return null;
}

/** Triangles a primitive draws (glTF modes: 4 triangles, 5 strip, 6 fan; 0–3 points and lines). */
function trianglesOf(p: Primitive, accessors: Accessor[]): number {
  const mode = p.mode ?? 4, n = p.indices !== undefined ? accessors[p.indices]?.count ?? 0 : accessors[p.attributes.POSITION]?.count ?? 0;
  if (mode === 4) return Math.floor(n / 3);
  if (mode === 5 || mode === 6) return Math.max(0, n - 2);
  return 0;
}

export function glbStats(bytes: Uint8Array): GlbStats {
  const { json, bin } = readGlb(bytes), accessors = json.accessors ?? [];
  let triangles = 0, primitives = 0;
  const materials = new Set<number>();
  for (const mesh of json.meshes ?? []) for (const p of mesh.primitives) {
    triangles += trianglesOf(p, accessors);
    primitives++;
    materials.add(p.material ?? -1);
  }
  let maxTexture = 0;
  for (const img of json.images ?? []) {
    const view = img.bufferView !== undefined ? json.bufferViews?.[img.bufferView] : undefined;
    if (!view || !bin) continue;
    const size = imageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    if (size) maxTexture = Math.max(maxTexture, size.width, size.height);
  }
  return {
    triangles, primitives, materials: materials.size, textures: json.images?.length ?? 0, maxTexture,
    bones: Math.max(0, ...(json.skins ?? []).map(s => s.joints.length)), animations: json.animations?.length ?? 0,
  };
}
