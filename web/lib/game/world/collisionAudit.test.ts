/**
 * The collision audit (specs/evidence/collision/audit.md): every object of the new world, what it draws at body height
 * (0.3 to 1.8 over its ground) against what blocks the walker, as top-down PNGs and a JSON table. Skipped unless
 * AUDIT_OUT names the folder to write to: `AUDIT_OUT=/tmp/audit npx vitest run lib/game/world/collisionAudit.test.ts`.
 * Rerun it after the world is repainted. AUDIT_PNG=0 writes the table only.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import * as THREE from "three";
import { it } from "vitest";
import { BUILDING_SOLID, FIRE_PIT_RING, LANDMARK_INFO, PROP_FOOTPRINT, ROUND_PROPS, TREE_TRUNK, propsOf, villageIsland, wharfDock, type LandmarkId } from "../defaultIsland";
import { acceptProposed, PROPOSALS } from "../proposals";
import { CAMPFIRE_URL, NEW_LAMPS, propUrl } from "../propModels";
import { isRockModel, rockUrl } from "../rocks";
import { treeParts } from "../natureParts";
import { SEASON_TREES } from "../seasonalLook";
import { BARRIERS, barrierPlacements } from "../barriers";
import { EDGE_SHOPS, JETTY, SELL_BARREL, deckPieces, dockToWorld } from "../wharf";
import { objectsOf, type MapObject } from "../villageMap";
import { loadWorldFromDisk } from "./disk";
import { terrainHeight } from "./terrain";
import { villageOfWorld } from "./village";

const OUT = process.env.AUDIT_OUT ?? "";
const PUB = join(__dirname, "../../../public");
const world = loadWorldFromDisk(join(__dirname, "../../../data/world"));
const t = world.terrain;
const objects = acceptProposed(world.objects, PROPOSALS.filter(p => p.target === "world-map").flatMap(p => p.objects).filter(o => o.kind !== "barrier"));
const v = villageOfWorld({ terrain: t, objects });
const island = villageIsland(v);
const ground = island.ground;
const BAND = [0.3, 1.8] as const;

type Tri = Float32Array; // 9 floats per triangle
const cache = new Map<string, Tri>();
function tris(url: string): Tri {
  const hit = cache.get(url);
  if (hit) return hit;
  const buf = readFileSync(join(PUB, url.split("?")[0])), jl = buf.readUInt32LE(12), j = JSON.parse(buf.subarray(20, 20 + jl).toString());
  const bin = buf.subarray(20 + jl + 8), out: number[] = [];
  const read = (ai: number) => {
    const a = j.accessors[ai], bv = j.bufferViews[a.bufferView], base = bin.byteOffset + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const dv = new DataView(bin.buffer, base), n = { SCALAR: 1, VEC3: 3 }[a.type as "SCALAR" | "VEC3"]!;
    const size = a.componentType === 5126 || a.componentType === 5125 ? 4 : a.componentType === 5123 ? 2 : 1, stride = bv.byteStride ?? size * n;
    const get = (o: number) => a.componentType === 5126 ? dv.getFloat32(o, true) : a.componentType === 5125 ? dv.getUint32(o, true) : a.componentType === 5123 ? dv.getUint16(o, true) : dv.getUint8(o);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, k) => get(i * stride + k * size)));
  };
  const visit = (ni: number, parent: THREE.Matrix4) => {
    const n = j.nodes[ni], m = new THREE.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
    m.premultiply(parent);
    if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) {
      if ((p.mode ?? 4) !== 4 || /^mShadow(Shake)?$/.test(j.materials?.[p.material]?.name ?? "")) continue; // shadow casters are never drawn
      const pos = read(p.attributes.POSITION).map(q => new THREE.Vector3(q[0], q[1], q[2]).applyMatrix4(m));
      const idx = p.indices !== undefined ? read(p.indices).map(q => q[0]) : pos.map((_, i) => i);
      for (let i = 0; i + 2 < idx.length; i += 3) for (const k of [0, 1, 2]) { const q = pos[idx[i + k]]; out.push(q.x, q.y, q.z); }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  for (const r of j.scenes[j.scene ?? 0].nodes) visit(r, new THREE.Matrix4());
  const arr = new Float32Array(out);
  cache.set(url, arr);
  return arr;
}

const M = (x: number, y: number, z: number, yaw = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
const ACNH = new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeScale(0.1, 0.1, 0.1));
const B = "/assets/acnh/buildings";
const CHALET: Record<string, string[]> = {
  brown: [`${B}/chalet-wall-a.glb`, `${B}/chalet-roof-b.glb`, `${B}/chalet-door.glb`],
  red: [`${B}/chalet-wall-c.glb`, `${B}/chalet-roof-g.glb`, `${B}/chalet-door.glb`],
  yellow: [`${B}/chalet-wall-e.glb`, `${B}/chalet-roof-e.glb`, `${B}/chalet-door.glb`],
};
type Part = { url: string; m: THREE.Matrix4 };
/** Where an object's models stand, as the game draws them (DefaultIslandWorld, NatureModels, AmbientProps). */
function drawn(o: MapObject): Part[] {
  const g = ground(o.x, o.z), yaw = o.yaw ?? 0, k = o.scale ?? 1;
  if (o.kind === "house") return CHALET[(o.model ?? "chalet-brown").replace("chalet-", "")].map(url => ({ url, m: M(o.x, g, o.z, yaw, k).multiply(ACNH) }));
  if (o.kind === "landmark") {
    if (o.id === "hq") return [`${B}/hq-office.glb`, `${B}/hq-office-door.glb`].map(url => ({ url, m: M(o.x + Math.sin(yaw) * -2.35 * k, g, o.z - Math.cos(yaw) * 2.35 * k, yaw, k).multiply(ACNH) }));
    if (o.id === "shop") return [`${B}/shop-market.glb`, `${B}/shop-market-door.glb`].map(url => ({ url, m: M(o.x, g, o.z, yaw, k).multiply(ACNH) }));
    if (o.id === "oracle") return [{ url: `${B}/oracle-museum.glb`, m: M(o.x, g, o.z, yaw, k).multiply(ACNH) }];
    if (o.id === "museum") return CHALET.red.map(url => ({ url, m: M(o.x, g, o.z, yaw, k).multiply(ACNH) }));
    if (o.id === "cafe") return [{ url: "/assets/game/buildings/cafe.glb", m: M(o.x, g, o.z, yaw, k) }];
    // The monument before its first stage (ClubMonument): its sign and the rope fence round the site.
    if (o.id === "monument") return [{ url: "/assets/game/props/monument-sign.glb", m: M(o.x + 1.3, g, o.z - 1.25, -0.3) },
      ...[[-1.1, -1.1, 0], [1.1, -1.1, 0], [-1.1, 1.1, Math.PI], [1.1, 1.1, Math.PI]].map(([x, z, r]) => ({ url: "/assets/acnh/props/fence-rope-a.glb", m: M(o.x + x, g, o.z + z, r) }))];
    return [];
  }
  if (o.kind === "tree") return treeParts(o.seed ?? 0, SEASON_TREES.summer).map(p => ({ url: p.url, m: M(o.x + p.offset[0], g + p.offset[1], o.z + p.offset[2], p.yaw, p.scale) }));
  if (o.kind === "lamp") { const l = NEW_LAMPS[o.model as keyof typeof NEW_LAMPS]; return l ? [{ url: l.url, m: M(o.x, g, o.z, yaw) }] : []; }
  if (o.kind === "campfire") return [{ url: CAMPFIRE_URL, m: M(o.x, g, o.z, 0, k) }];
  if ((o.kind === "prop" || o.kind === "bench" || o.kind === "rock") && o.model) {
    const y = EDGE_SHOPS.includes(o.model) ? ground(o.x + 2 * Math.sin(yaw), o.z + 2 * Math.cos(yaw)) : o.model === "bunting-string" ? g + 3.1 : g;
    return [{ url: isRockModel(o.model) ? rockUrl(o.model) : propUrl(o.model), m: M(o.x, y, o.z, yaw, k) }];
  }
  return [];
}

type Item = { id: string; key: string; x: number; z: number; yaw: number; y: number; parts: Part[]; k?: number; o?: MapObject };
const items: Item[] = [];
for (const o of objects) { const parts = drawn(o); if (parts.length) items.push({ id: `${o.kind}:${o.id}`, key: `${o.kind}:${o.model ?? (o.kind === "landmark" ? o.id : "")}`, x: o.x, z: o.z, yaw: o.yaw ?? 0, y: o.kind === "landmark" || o.kind === "house" ? ground(o.x, o.z) : parts[0].m.elements[13], parts, k: o.scale ?? 1, o }); }
for (const b of barrierPlacements(v)) { const url = BARRIERS[b.model].url; if (url) items.push({ id: `barrier:${b.model}@${b.x.toFixed(0)},${b.z.toFixed(0)}`, key: `barrier:${b.model}`, x: b.x, z: b.z, yaw: b.yaw, y: ground(b.x, b.z), parts: [{ url, m: M(b.x, ground(b.x, b.z), b.z, b.yaw, b.scale) }] }); }
{
  const d = wharfDock(v), land = d?.y ? dockToWorld(d, 0, JETTY.land, { x: 0, z: 0 }) : undefined;
  deckPieces(objectsOf("deck", v), ground, land, undefined, propsOf(v).filter(o => EDGE_SHOPS.includes(o.model!) || o.id === SELL_BARREL))
    .forEach((p, i) => { if (p.model !== "deck-tile") items.push({ id: `kit:${p.model}-${i}`, key: `kit:${p.model}`, x: p.x, z: p.z, yaw: p.yaw, y: p.y, parts: [{ url: propUrl(p.model), m: M(p.x, p.y, p.z, p.yaw) }] }); });
}

/** Body-height triangles of an item in world XZ (2D, 6 floats each). */
function slice(it: Item): number[] {
  const out: number[] = [], v3 = new THREE.Vector3();
  for (const p of it.parts) {
    const a = tris(p.url);
    for (let i = 0; i < a.length; i += 9) {
      const pts: number[] = [];
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < 9; k += 3) { v3.set(a[i + k], a[i + k + 1], a[i + k + 2]).applyMatrix4(p.m); pts.push(v3.x, v3.z); lo = Math.min(lo, v3.y); hi = Math.max(hi, v3.y); }
      if (hi < it.y + BAND[0] || lo > it.y + BAND[1]) continue;
      out.push(...pts);
    }
  }
  return out;
}

/** A raster over a region: rasterises triangles (filled, plus their edges for the walls seen edge on). */
class Raster {
  w: number; h: number; px: Uint8Array;
  constructor(public x0: number, public z0: number, x1: number, z1: number, public ppu: number) { this.w = Math.ceil((x1 - x0) * ppu); this.h = Math.ceil((z1 - z0) * ppu); this.px = new Uint8Array(this.w * this.h); }
  set(i: number, j: number) { if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.px[j * this.w + i] = 1; }
  line(ax: number, az: number, bx: number, bz: number) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * this.ppu * 2) + 1;
    for (let s = 0; s <= n; s++) this.set(Math.floor((ax + ((bx - ax) * s) / n - this.x0) * this.ppu), Math.floor((az + ((bz - az) * s) / n - this.z0) * this.ppu));
  }
  tri(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
    this.line(ax, az, bx, bz); this.line(bx, bz, cx, cz); this.line(cx, cz, ax, az);
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - this.x0) * this.ppu)), i1 = Math.min(this.w - 1, Math.floor((Math.max(ax, bx, cx) - this.x0) * this.ppu));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - this.z0) * this.ppu)), j1 = Math.min(this.h - 1, Math.floor((Math.max(az, bz, cz) - this.z0) * this.ppu));
    const d = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (Math.abs(d) < 1e-9) return;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.x0 + (i + 0.5) / this.ppu, z = this.z0 + (j + 0.5) / this.ppu;
      const u = ((bx - x) * (cz - z) - (bz - z) * (cx - x)) / d, w = ((cx - x) * (az - z) - (cz - z) * (ax - x)) / d;
      if (u >= 0 && w >= 0 && u + w <= 1) this.px[j * this.w + i] = 1;
    }
  }
  fill(s: number[]) { for (let i = 0; i < s.length; i += 6) this.tri(s[i], s[i + 1], s[i + 2], s[i + 3], s[i + 4], s[i + 5]); }
  at(x: number, z: number) { const i = Math.floor((x - this.x0) * this.ppu), j = Math.floor((z - this.z0) * this.ppu); return i >= 0 && j >= 0 && i < this.w && j < this.h ? this.px[j * this.w + i] : 0; }
}

/** What the walker blocks for an item, before its scale: hw x hd (@ its centre offset). */
function blockerOf(it: Item): string {
  const o = it.o, box = (b: readonly (number | undefined)[]) => `${b[0]} x ${b[1]}${b[2] || b[3] ? ` @ ${b[2] ?? 0}, ${b[3] ?? 0}` : ""}`;
  if (!o) return it.key.startsWith("barrier:") ? "barrier box" : "none";
  const solid = o.kind === "house" ? BUILDING_SOLID.house : o.kind === "landmark" ? BUILDING_SOLID[o.id as LandmarkId] : undefined;
  if (solid) return `turned ${box([solid[2], solid[3], solid[0], solid[1]])}`;
  if (o.kind === "landmark") return LANDMARK_INFO[o.id as LandmarkId]?.half ? box(LANDMARK_INFO[o.id as LandmarkId].half!) : "none";
  if (o.kind === "lamp") { const post = NEW_LAMPS[o.model as keyof typeof NEW_LAMPS]?.post; return post ? `post ${post}` : "none"; }
  if (o.kind === "tree") return `trunk r ${TREE_TRUNK}`;
  if (o.kind === "campfire") return `round r ${FIRE_PIT_RING}`;
  const f = o.model ? PROP_FOOTPRINT[o.model] : undefined;
  return f ? (ROUND_PROPS.has(o.model!) ? `round r ${f[0]}` : box(f)) : "none";
}

const blocked = (x: number, z: number) => island.top(x, z) > ground(x, z) + 0.3;

/** Models that should not stop a body (the lane file's soft list). */
const SOFT = /^(flower|bug|shell|bottle)|:(flower-meadow|flower-tallgrass|shrub-|reeds-|coral|lily-pads|river-stones|starfish|sand-dollar|conch|beach-towel|beach-ball|bunting|plaza-tiles|driftwood|forest-tree|sushi-bar-pier|shipwright-ship)|kit:(life-ring|rope-net|wharf-ladder|dock-pile-rope)|lamp:hand|^tree:/;

function png(file: string, w: number, h: number, rgb: Uint8Array) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let j = 0; j < h; j++) { raw[j * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + j * w * 3, w * 3).copy(raw, j * (w * 3 + 1) + 1); }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

/** Top-down: ground and water, soft things pale green, then solid-or-should-be things: grey = drawn and blocks, orange = drawn but walked through, red = blocks with nothing drawn. */
function render(name: string, x0: number, z0: number, x1: number, z1: number, ppu: number) {
  const hard = new Raster(x0, z0, x1, z1, ppu), soft = new Raster(x0, z0, x1, z1, ppu);
  for (const it of items) { if (it.x < x0 - 15 || it.x > x1 + 15 || it.z < z0 - 15 || it.z > z1 + 15) continue; (SOFT.test(it.key) ? soft : hard).fill(slice(it)); }
  const rgb = new Uint8Array(hard.w * hard.h * 3);
  for (let j = 0; j < hard.h; j++) for (let i = 0; i < hard.w; i++) {
    // Screen: +x is left and +z up in the game's camera; draw with +x to the left, +z up.
    const x = x0 + (i + 0.5) / ppu, z = z0 + (j + 0.5) / ppu, o = ((hard.h - 1 - j) * hard.w + (hard.w - 1 - i)) * 3;
    const h = terrainHeight(t, x, z), wet = island.wet(x, z), b = blocked(x, z), d = hard.px[j * hard.w + i], s = soft.px[j * hard.w + i];
    let c = wet ? [70, 110, 170] : h < t.seaLevel ? [120, 170, 210] : [Math.min(235, 150 + h * 6), Math.min(235, 175 + h * 4), 130];
    if (ground(x, z) > h + 0.05) c = [190, 160, 120]; // a deck
    if (s && !b) c = [150, 210, 150];
    if ((d || s) && b) c = [90, 90, 90];
    else if (d) c = [255, 150, 0];
    else if (b) c = [230, 30, 30];
    rgb.set(c, o);
  }
  png(join(OUT, `${name}.png`), hard.w, hard.h, rgb);
}

it.skipIf(!OUT)("audit", { timeout: 600000 }, () => {
  mkdirSync(OUT, { recursive: true });
  // Per item: its drawn body-height footprint in its own frame and how much of it blocks, and how much blocks round it with nothing drawn.
  const rows = new Map<string, { n: number; hw: number; hd: number; cx: number; cz: number; drawnBlocked: number; drawn: number; phantom: number; ring: number; sample: string; local: number[]; blocker: string }>();
  for (const it of items) {
    const s = slice(it);
    if (!s.length) continue;
    const c = Math.cos(it.yaw), sn = Math.sin(it.yaw);
    let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity, wx0 = Infinity, wx1 = -Infinity, wz0 = Infinity, wz1 = -Infinity;
    for (let i = 0; i < s.length; i += 2) {
      const dx = s[i] - it.x, dz = s[i + 1] - it.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      lx0 = Math.min(lx0, lx); lx1 = Math.max(lx1, lx); lz0 = Math.min(lz0, lz); lz1 = Math.max(lz1, lz);
      wx0 = Math.min(wx0, s[i]); wx1 = Math.max(wx1, s[i]); wz0 = Math.min(wz0, s[i + 1]); wz1 = Math.max(wz1, s[i + 1]);
    }
    const r = new Raster(wx0 - 1, wz0 - 1, wx1 + 1, wz1 + 1, 10);
    r.fill(s);
    let drawn = 0, db = 0, phantom = 0, ring = 0;
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
      const x = r.x0 + (i + 0.5) / 10, z = r.z0 + (j + 0.5) / 10, b = blocked(x, z);
      if (r.px[j * r.w + i]) { drawn++; if (b) db++; } else { ring++; if (b) phantom++; }
    }
    const row = rows.get(it.key) ?? { n: 0, hw: 0, hd: 0, cx: 0, cz: 0, drawnBlocked: 0, drawn: 0, phantom: 0, ring: 0, sample: it.id, local: [lx0, lx1, lz0, lz1].map(q => +(q / (it.k ?? 1)).toFixed(2)), blocker: blockerOf(it) };
    row.n++; row.hw = Math.max(row.hw, (lx1 - lx0) / 2); row.hd = Math.max(row.hd, (lz1 - lz0) / 2); row.cx = (lx0 + lx1) / 2; row.cz = (lz0 + lz1) / 2;
    row.drawnBlocked += db; row.drawn += drawn; row.phantom += phantom / 100; row.ring += ring;
    rows.set(it.key, row);
  }
  const table = [...rows.entries()].sort().map(([key, r]) => ({ key, n: r.n, soft: SOFT.test(key), drawnHalf: [+r.hw.toFixed(2), +r.hd.toFixed(2)], centre: [+r.cx.toFixed(2), +r.cz.toFixed(2)],
    blockedPct: r.drawn ? Math.round((100 * r.drawnBlocked) / r.drawn) : 0, phantomArea: +(r.phantom / r.n).toFixed(2), sample: r.sample, local: r.local, blocker: r.blocker }));
  writeFileSync(join(OUT, "audit.json"), JSON.stringify(table, null, 1));
  if (process.env.AUDIT_PNG !== "0") {
    render("open-area", -55, 5, 100, 135, 5);
    render("plaza", -6, 22, 50, 80, 16);
    render("wharf", 55, 8, 100, 84, 14);
    render("beach", -55, 85, 45, 135, 10);
  }
});
