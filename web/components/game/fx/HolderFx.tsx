"use client";

/**
 * The VFX library on any holder (David 2026-11-06: "this wont only be for fishing rod but for weapon, vfx clothes etc";
 * specs/vfx-library.md, lib/game/fx/library.ts). Give it the thing that holds the effect (a rod's model, a sword, a hat:
 * any object with meshes) and the types to wear; it reads only the holder's own shape (its surface sampled once, its
 * long axis, its size, how it moves), never what the holder is.
 *
 * Its draws, each only when a type it wears needs it, nothing lit, no light:
 *   - the glow shell (glow's sun glint, pulse, the burst's flare, gather's and electricity's build, the strike's white
 *     flash): the holder's own shape a hair out;
 *   - the energy lines: the holder's own edges as neon tubes;
 *   - the pool (lib/game/fx/holder.ts): glints, motes, comets, arcs, sparks, flame, petals, light gathering in, the
 *     lightning strike, in the world, so a swung holder leaves them behind (or steers them round it);
 *   - the trail: white and faint behind its outer half as it swings, a bright line at the tip; water when it wears water;
 *   - the water: its wrap (two ribbons spiralling up it) and its drops (a pool of their own, solid).
 * The shells, lines and wrap ride the holder; the pools and the trail are the scene's (world space). `strength` eases
 * (1 as made), `once` throws the one-offs (sparks, the burst) each time it changes, `strike` plays a strike each time
 * its key does: the holder flashes white, its particles freeze a moment, then it shakes (`onHit` lets its host freeze too).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FXLIB_PACK_ROWS, FXLIB_PACK_URL, createCombatParticleMaterial, packTexture, rampMap } from "@/lib/game/fx/fxMaterial";
import { RampTable, sharedRamps } from "@/lib/game/fx/combat";
import { HUSH, HolderPool, KIND_RAMP, POOL_KINDS, ZAP_AT, chargeAt, rampOf, seeded, sweepAt, throwKind, throwStrike, throwWater, type Ctx, type Holder, type PoolKind,
  type StrikeKind } from "@/lib/game/fx/holder";
import { fxAt, fxGrow, type FxKind } from "@/lib/game/fx/library";
import { WATER_PALETTE, dropMaterial, waterAt, waterMaterial, waterWrap } from "@/lib/game/fx/water";

/** The most one holder's pool holds (budget.ts PARTICLE_POOLS). */
const CAPACITY = 320;
/** The most water drops one holder throws at once (budget.ts PARTICLE_POOLS). */
const DROPS = 200;
/** Surface points sampled off the holder. */
const POINTS = 64;
/** The trail's samples. */
const TRAIL_N = 20;
/** The strike's freeze frame (s): the holder white and its particles held still. */
const FREEZE = 0.12;
/** The shake after it (s). */
const SHAKE = 0.32;

const SHELL_VERT = `uniform float uInflate; uniform vec3 uBase; uniform vec3 uAxis; uniform float uLen;
varying vec3 vN; varying vec3 vView; varying vec3 vP; varying float vS;
void main() {
  vS = dot(position - uBase, uAxis) / uLen;
  vP = position;
  vec3 transformed = position + normal * uInflate;
  // through project_vertex, so it bends with the curved world as its holder does (curvedWorld.ts)
  #include <project_vertex>
  vN = normalize(normalMatrix * normal); vView = normalize(-mvPosition.xyz);
}`;
/**
 * The glow shell: lit at its rim with a band running tip-ward, cut in three cel steps (pulse, the burst, a build-up);
 * the sun's glint (a band of sunlight sweeping along it, broken into facets of light with a faint rainbow at their
 * fractures, a facet twinkling now and then); and the strike's white flash.
 */
const GLOW_FRAG = `uniform vec3 uColor; uniform float uAmount; uniform float uTime; uniform float uGlint; uniform float uSweep; uniform float uWhite; uniform float uLen;
varying vec3 vN; varying vec3 vView; varying vec3 vP; varying float vS;
vec3 gHash(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  float rim = 1.0 - abs(dot(n, normalize(vView)));
  vec3 c = vec3(0.0);
  if (uAmount > 0.0) {
    float b = fract(vS * 0.8 - uTime * 0.5);
    float band = smoothstep(0.0, 0.05, b) * (1.0 - smoothstep(0.05, 0.2, b));
    float a = uAmount * (0.2 + 0.8 * rim * rim + 0.9 * band);
    a = a > 0.9 ? 1.0 : a > 0.5 ? 0.62 : a > 0.18 ? 0.3 : 0.0;
    c += uColor * a;
  }
  if (uGlint > 0.0) {
    // facets: the cells of its surface (3D Voronoi in its own space), each catching the sun or not
    vec3 q = vP * (30.0 / uLen), id = floor(q), f = fract(q);
    float f1 = 9.0, f2 = 9.0; vec3 cell = vec3(0.0);
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 o = vec3(float(x), float(y), float(z)), r = o + gHash(id + o) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; cell = id + o; } else if (d < f2) f2 = d;
    }
    vec3 h = gHash(cell + 3.7);
    float edge = 1.0 - smoothstep(0.015, 0.06, sqrt(f2) - sqrt(f1));
    float lean = vS + 0.14 * n.x - 0.06 * n.y;                       // the band leans as the facets turn
    float band = 1.0 - smoothstep(0.05, 0.17, abs(lean - uSweep));
    float lit = band * (h.x > 0.45 ? 0.55 + 0.6 * h.y : 0.1) + 0.5 * (1.0 - smoothstep(0.0, 0.02, abs(lean - uSweep)));
    lit = lit > 0.8 ? 1.0 : lit > 0.4 ? 0.5 : lit > 0.08 ? 0.12 : 0.0;
    vec3 rainbow = 0.55 + 0.45 * cos(6.2832 * (h.z + vS * 1.5 + vec3(0.0, 0.33, 0.67)));
    float twinkle = step(0.985, gHash(cell + floor(uTime * 3.0)).x) * (1.0 - smoothstep(0.0, 0.05, sqrt(f1)));
    c += uGlint * (vec3(1.0, 0.88, 0.6) * (lit * 0.95 + twinkle) + rainbow * edge * band * 0.8);
  }
  c += vec3(uWhite * 2.0);
  if (max(c.r, max(c.g, c.b)) <= 0.0) discard;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/** The energy lines (David 2026-11-06: "like neon with slight glow effect and is like accessory parts"): each edge a tube facing you. */
const ENERGY_VERT = `attribute vec3 aOther; attribute float aSide; attribute float aS;
uniform float uWidth;
varying float vAcross; varying float vS;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0), b = modelViewMatrix * vec4(aOther, 1.0);
  vec2 dir = b.xy - a.xy;
  dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
  vec3 transformed = position;
  #include <project_vertex>
  mvPosition.xy += vec2(-dir.y, dir.x) * aSide * uWidth - dir * uWidth * 0.6;   // its width, and past its ends so the joins close
  mvPosition.z += uWidth * 2.0;                                                    // in front of the faces it lies on
  gl_Position = projectionMatrix * mvPosition;
  vAcross = aSide; vS = aS;
}`;
const ENERGY_FRAG = `uniform vec3 uColor; uniform vec3 uCore; uniform float uAmount; uniform float uTime; uniform float uPulses;
varying float vAcross; varying float vS;
void main() {
  float x = abs(vAcross);
  float core = 1.0 - smoothstep(0.1, 0.16, x), tube = 1.0 - smoothstep(0.16, 0.3, x), halo = (1.0 - x) * (1.0 - x);
  float pulse = smoothstep(0.82, 1.0, fract(vS * 3.0 - uTime * uPulses));
  vec3 c = uCore * core * (0.5 + 0.6 * pulse) + uColor * (tube * 1.1 + halo * 0.3) * (0.8 + 1.4 * pulse);
  gl_FragColor = vec4(c * uAmount, 1.0);
  #include <colorspace_fragment>
}`;

/** The trail (David 2026-11-06: "white, less opacity, make the tip a more opacity line"): x its age (0 new, 1 gone), y its side (1 the tip). */
const TRAIL_VERT = `attribute vec2 aTrail; varying vec2 vT;
void main() { vT = aTrail; vec3 transformed = position;
  #include <project_vertex>
}`;
const TRAIL_FRAG = `varying vec2 vT;
void main() {
  float fade = 1.0 - vT.x;
  float a = max(0.22 * fade * smoothstep(0.0, 0.45, vT.y), step(0.92, vT.y) * sqrt(fade) * 0.9);
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}`;

/** The holder's shape, once: its meshes (not an effect's) merged in its own space, smoothed, and points sampled off it. */
interface Shape { geometry: THREE.BufferGeometry; points: Float32Array; normals: Float32Array; base: THREE.Vector3; tip: THREE.Vector3; length: number; thick: number }
function shapeOf(holder: THREE.Object3D): Shape | null {
  holder.updateMatrixWorld(true);
  const inv = holder.matrixWorld.clone().invert(), parts: THREE.BufferGeometry[] = [];
  holder.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.fx || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
    for (let n: THREE.Object3D | null = m; n && n !== holder; n = n.parent) if (!n.visible) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", m.geometry.getAttribute("position").clone());
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    parts.push(g.index ? g.toNonIndexed() : g);
  });
  if (!parts.length) return null;
  const geometry = mergeVertices(mergeGeometries(parts), 1e-4);
  geometry.computeVertexNormals();
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build(), p = new THREE.Vector3(), nm = new THREE.Vector3();
  const points = new Float32Array(POINTS * 3), normals = new Float32Array(POINTS * 3), cloud: THREE.Vector3[] = [];
  for (let i = 0; i < POINTS; i++) { sampler.sample(p, nm); p.toArray(points, i * 3); nm.toArray(normals, i * 3); }
  for (let i = 0; i < 256; i++) { const v = new THREE.Vector3(); sampler.sample(v, nm); cloud.push(v); }
  // Its long axis: the cloud's main direction (power iteration on its spread), so a thing lying on a slant has it too;
  // its tip the end that is higher in the world as it is held now (a rod's, a sword's).
  const mid = cloud.reduce((m, v) => m.add(v), new THREE.Vector3()).divideScalar(cloud.length), axis = new THREE.Vector3(0.3, 1, 0.2).normalize(), d = new THREE.Vector3();
  for (let it = 0; it < 24; it++) {
    const next = new THREE.Vector3();
    for (const v of cloud) { d.subVectors(v, mid); next.addScaledVector(d, d.dot(axis)); }
    if (next.lengthSq() < 1e-12) break;
    axis.copy(next.normalize());
  }
  if (axis.clone().transformDirection(holder.matrixWorld).y < 0) axis.negate();
  let lo = Infinity, hi = -Infinity, spread = 0;
  for (const v of cloud) { const u = d.subVectors(v, mid).dot(axis); lo = Math.min(lo, u); hi = Math.max(hi, u); spread += d.addScaledVector(axis, -u).lengthSq(); }
  const length = hi - lo, thick = 2 * Math.sqrt(spread / cloud.length) * 1.4;
  return { geometry, points, normals, base: mid.clone().addScaledVector(axis, lo), tip: mid.clone().addScaledVector(axis, hi), length, thick };
}

/** The energy lines off a shape: its feature edges (where its faces turn sharply), each a quad of four corners. */
function energyLines(s: Shape): THREE.BufferGeometry {
  let edges = new THREE.EdgesGeometry(s.geometry, 40);
  if (edges.getAttribute("position").count < 24) { edges.dispose(); edges = new THREE.EdgesGeometry(s.geometry, 20); }
  const src = edges.getAttribute("position"), segs = src.count / 2, keep = Math.max(1, Math.ceil(segs / 900)), axis = s.tip.clone().sub(s.base).normalize();
  const pos: number[] = [], other: number[] = [], side: number[] = [], along: number[] = [], idx: number[] = [], a = new THREE.Vector3(), b = new THREE.Vector3();
  const sOf = (v: THREE.Vector3) => v.clone().sub(s.base).dot(axis) / s.length;
  for (let i = 0; i < segs; i += keep) {
    a.fromBufferAttribute(src, i * 2); b.fromBufferAttribute(src, i * 2 + 1);
    const n = pos.length / 3;
    for (const [p, q] of [[a, b], [b, a]] as const) for (const sd of [-1, 1]) { pos.push(p.x, p.y, p.z); other.push(q.x, q.y, q.z); side.push(sd); along.push(sOf(p)); }
    idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  }
  edges.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aOther", new THREE.Float32BufferAttribute(other, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  return g;
}

const additive = (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
});
/** The types the glow shell draws. */
const SHELL_KINDS: FxKind[] = ["glow", "pulse", "burst", "gather", "electricity"];

/** An instanced quad mesh drawing a pool, its instance attributes bound to the pool's arrays. */
function poolMesh(pool: HolderPool, material: THREE.Material): { mesh: THREE.Mesh; attrs: THREE.InstancedBufferAttribute[] } {
  const geometry = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
  geometry.index = quad.index;
  for (const n of ["position", "uv"]) geometry.setAttribute(n, quad.getAttribute(n));
  const attrs = [pool.a, pool.b, pool.c, pool.d].map((arr, k) => {
    const a = new THREE.InstancedBufferAttribute(arr, 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(`i${"ABCD"[k]}`, a);
    return a;
  });
  geometry.instanceCount = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, attrs };
}
function upload(mesh: THREE.Mesh, attrs: THREE.InstancedBufferAttribute[], n: number) {
  (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
  if (n) for (const at of attrs) { at.clearUpdateRanges(); at.addUpdateRange(0, n * 4); at.needsUpdate = true; }
}

/** One holder's effect: its pools and trail (the scene's), its materials, and what it remembers frame to frame. */
interface Fx {
  pool: HolderPool; mesh: THREE.Mesh; attrs: THREE.InstancedBufferAttribute[]; drops: HolderPool; dropMesh: THREE.Mesh; dropAttrs: THREE.InstancedBufferAttribute[];
  rowOf: (kind: string) => number; trail: THREE.Mesh; water: boolean;
  glow: THREE.ShaderMaterial; energy: THREE.ShaderMaterial; wet: THREE.ShaderMaterial; rnd: () => number; state: Record<string, number>; strikeState: Record<string, number>;
  live: { k: number; t: number; flare: number; once: number; strikeKey: number; strikeT: number; hit: boolean; white: number; shake: THREE.Vector3; prev: THREE.Matrix4 | null;
    shape: Shape | null; shells: THREE.Object3D[]; charge: number; trailAt: { a: THREE.Vector3; b: THREE.Vector3; t: number }[] };
}

export interface Strike {
  kind: StrikeKind; /** Seconds from its start to when it lands. */ hit: number; /** A new key plays it again. */ key: number;
  /** Called as it lands with the freeze frame's length (ms), so its host can hold its own motion still too. */
  onHit?: (ms: number) => void;
}

export default function HolderFx({ holder, kinds, strength = 1, colour = "#7FD8FF", once = 0, strike }: {
  holder: THREE.Object3D; kinds: readonly FxKind[]; strength?: number; colour?: string; once?: number; strike?: Strike;
}) {
  const scene = useThree(s => s.scene), water = kinds.includes("water");
  const fx = useMemo((): Fx => {
    const table = (sharedRamps.table ??= new RampTable()), rows = new Map<string, number>();
    // a kind's ramp row, added on first use (and the ramp texture flagged for upload: a strike's row comes late)
    const rowOf = (kind: string) => {
      const known = rows.get(kind);
      if (known !== undefined) return known;
      const row = table.row(KIND_RAMP[kind as PoolKind] ?? rampOf(colour));
      rows.set(kind, row);
      rampMap(table);
      return row;
    };
    const pool = new HolderPool(CAPACITY), drops = new HolderPool(DROPS);
    const { mesh, attrs } = poolMesh(pool, createCombatParticleMaterial(packTexture(FXLIB_PACK_URL), rampMap(table), true, 1, FXLIB_PACK_ROWS));
    mesh.renderOrder = 3.6; mesh.name = "HolderFx";
    const { mesh: dropMesh, attrs: dropAttrs } = poolMesh(drops, dropMaterial());
    dropMesh.name = "HolderFxDrops";
    // the trail: TRAIL_N samples of its outer half, two vertices each (its age and side; as water, its uv and its end)
    const tg = new THREE.BufferGeometry(), idx: number[] = [];
    for (let i = 0; i < TRAIL_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute("aTrail", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 4), 2).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 4), 2).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    tg.setIndex(idx);
    for (const kind of [...kinds, strike?.kind]) if (kind) rowOf(kind);     // its rows ready before the first frame
    const wet = waterMaterial("Water", new THREE.Color(WATER_PALETTE.body));
    const trailMat = water ? waterMaterial("Water", new THREE.Color(WATER_PALETTE.body))
      : Object.assign(additive(TRAIL_VERT, TRAIL_FRAG, {}), { side: THREE.DoubleSide });
    const trail = new THREE.Mesh(tg, trailMat);
    trail.frustumCulled = false; trail.renderOrder = 3.5; trail.visible = false;
    const glow = additive(SHELL_VERT, GLOW_FRAG, { uInflate: { value: 0 }, uBase: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 },
      uTime: { value: 0 }, uAmount: { value: 0 }, uGlint: { value: 0 }, uSweep: { value: -1 }, uWhite: { value: 0 }, uColor: { value: new THREE.Color(colour) } });
    const energy = additive(ENERGY_VERT, ENERGY_FRAG, { uWidth: { value: 0.01 }, uAmount: { value: 1 }, uTime: { value: 0 }, uPulses: { value: 1 },
      uColor: { value: new THREE.Color(colour) }, uCore: { value: new THREE.Color(colour).lerp(new THREE.Color(1, 1, 1), 0.35) } });
    return { pool, mesh, attrs, drops, dropMesh, dropAttrs, rowOf, trail, water, glow, energy, wet, rnd: seeded(holder.id * 7919 + 3), state: {}, strikeState: {},
      live: { k: strength, t: 0, flare: 0, once, strikeKey: strike?.key ?? 0, strikeT: -1, hit: false, white: 0, shake: new THREE.Vector3(), prev: null,
        shape: null, shells: [], charge: 0, trailAt: [] } };
    // the holder, its colour and whether it wears water make it; strength, once and strike are read each frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder, colour, water]);
  useEffect(() => {
    scene.add(fx.mesh, fx.trail);
    if (fx.water) scene.add(fx.dropMesh);
    return () => {
      scene.remove(fx.mesh, fx.trail, fx.dropMesh);
      for (const s of fx.live.shells) { s.removeFromParent(); if (s.userData.own) (s as THREE.Mesh).geometry.dispose(); }
      holder.position.sub(fx.live.shake);
      for (const m of [fx.mesh, fx.dropMesh, fx.trail]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      fx.glow.dispose(); fx.energy.dispose(); fx.wet.dispose();
    };
  }, [scene, fx, holder]);
  useFrame(({ camera }, delta) => frame(fx, holder, kinds, strength, once, strike, camera, Math.min(delta, 0.1)));
  return null;
}


const right = new THREE.Vector3(), up = new THREE.Vector3(), ws = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), pa = new THREE.Vector3();
/** A step of crackle: a fresh level sixteen times a second. */
const crackle = (t: number) => { const k = Math.floor(t * 16); return 0.45 + 0.55 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1); };
/** A heartbeat: lub, then a softer dub, every 1.1 s. */
const lubdub = (t: number) => { const ph = (t / 1.1) % 1; return Math.exp(-(((ph - 0.04) / 0.05) ** 2)) + 0.6 * Math.exp(-(((ph - 0.26) / 0.05) ** 2)); };
const shownIn = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false; return true; };

/** The shells, lines and wrap a holder wears, made once its shape is known. */
function dress(fx: Fx, holder: THREE.Object3D, kinds: readonly FxKind[], strike: Strike | undefined, s: Shape) {
  const L = fx.live, axis = s.tip.clone().sub(s.base).normalize();
  fx.glow.uniforms.uBase.value.copy(s.base); fx.glow.uniforms.uAxis.value.copy(axis); fx.glow.uniforms.uLen.value = s.length;
  fx.trail.visible = kinds.includes("trail") || fx.water;
  const wear = (geometry: THREE.BufferGeometry, material: THREE.Material, own: boolean, order: number) => {
    const m = new THREE.Mesh(geometry, material);
    m.userData.fx = true; m.userData.own = own; m.raycast = () => {}; m.renderOrder = order; m.frustumCulled = false;
    holder.add(m);
    L.shells.push(m);
  };
  if (strike || kinds.some(k => SHELL_KINDS.includes(k))) wear(s.geometry, fx.glow, false, 2);
  if (kinds.includes("energy")) wear(energyLines(s), fx.energy, true, 2.1);
  if (fx.water) wear(waterWrap(s.base, s.tip, Math.max(s.thick * 0.62, s.length * 0.035)), fx.wet, true, 1);
}

/** Module scope (the react compiler forbids writing through hook values): one frame. */
function frame(fx: Fx, holder: THREE.Object3D, kinds: readonly FxKind[], strength: number, once: number, strike: Strike | undefined, camera: THREE.Camera, dt: number) {
  const L = fx.live;
  // the shake's offset off, before anything reads where the holder is
  holder.position.sub(L.shake); L.shake.set(0, 0, 0);
  L.t += dt;
  L.k += (strength - L.k) * (1 - Math.exp(-dt * 3));
  if (!L.shape) {
    L.shape = shapeOf(holder);
    if (!L.shape) return;
    dress(fx, holder, kinds, strike, L.shape);
  }
  const s = L.shape, k = L.k, t = L.t, shown = shownIn(holder);
  holder.updateWorldMatrix(true, false);
  const mw = holder.matrixWorld, size = s.length * holder.getWorldScale(ws).x, prev = L.prev ?? mw.clone();
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize(); up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const h: Holder = {
    n: POINTS, size, right,
    point: (i, out) => out.fromArray(s.points, i * 3).applyMatrix4(mw),
    normal: (i, out) => out.fromArray(s.normals, i * 3).transformDirection(mw),
    along: (u, out) => out.copy(s.base).lerp(s.tip, u).applyMatrix4(mw),
    vel: (u, out) => dt > 0 ? out.copy(s.base).lerp(s.tip, u).applyMatrix4(mw).sub(pa.copy(s.base).lerp(s.tip, u).applyMatrix4(prev)).divideScalar(dt) : out.set(0, 0, 0),
  };
  const ctx = (kind: string, state: Record<string, number>, pool = fx.pool): Ctx => ({ pool, rnd: fx.rnd, holder: h, ramp: fx.rowOf(kind), k, t, dt, state });

  // The strike: its charge, the held breath, the hit (white, a freeze, then a shake).
  let frozen = false, build = 0;
  if (strike) {
    if (strike.key !== L.strikeKey) { L.strikeKey = strike.key; L.strikeT = 0; L.hit = false; for (const key of Object.keys(fx.strikeState)) delete fx.strikeState[key]; }
    if (L.strikeT >= 0) {
      L.strikeT += dt;
      const since = L.strikeT - strike.hit;
      if (since >= 0 && !L.hit) { L.hit = true; L.white = 1; strike.onHit?.(FREEZE * 1000); }
      frozen = since >= 0 && since < FREEZE;
      if (!frozen) throwStrike(strike.kind, ctx(strike.kind, fx.strikeState), L.strikeT, strike.hit);
      if (since < -HUSH) build = Math.max(0, L.strikeT / Math.max(0.01, strike.hit - HUSH)) ** 2;
      if (since > FREEZE && since < FREEZE + SHAKE) {
        const amp = 0.03 * s.length * holder.scale.x * (1 - (since - FREEZE) / SHAKE);
        L.shake.set((fx.rnd() - 0.5) * 2 * amp, (fx.rnd() - 0.5) * 2 * amp, (fx.rnd() - 0.5) * amp);
      }
      if (L.strikeT > strike.hit + 1.5) L.strikeT = -1;
    }
  }
  if (!frozen) L.white *= Math.exp(-dt * 14);
  const pdt = frozen ? 0 : dt;

  // The one-offs, each time `once` changes; the burst flares the glow shell.
  if (once !== L.once) {
    L.once = once;
    if (shown) for (const kind of ["sparks", "burst"] as const) if (kinds.includes(kind)) throwKind(kind, ctx(kind, fx.state));
    if (kinds.includes("burst")) L.flare = 1;
  }
  L.flare *= Math.exp(-dt * 5);
  if (shown && !frozen) {
    for (const kind of POOL_KINDS) if (kind !== "sparks" && kind !== "burst" && kinds.includes(kind)) throwKind(kind, ctx(kind, fx.state));
    if (fx.water) throwWater(ctx("water", fx.state, fx.drops), Math.max(s.thick * 0.62, s.length * 0.035) * holder.getWorldScale(ws).x);
  }
  const axis = { a: h.along(0, a).clone(), b: h.along(1, b).clone() };
  fx.pool.step(pdt, axis); fx.drops.step(pdt, axis);
  upload(fx.mesh, fx.attrs, fx.pool.write(right, up));
  if (fx.water) upload(fx.dropMesh, fx.dropAttrs, fx.drops.write(right, up));

  // The glow shell.
  const beat = kinds.includes("pulse") ? lubdub(t) * fxGrow("pulse", "size", k) : 0;
  let g = kinds.includes("pulse") ? 0.25 + 0.9 * beat : 0;
  if (kinds.includes("gather")) g += 0.45 * k * (0.75 + 0.25 * Math.sin(t * 11));
  if (kinds.includes("electricity")) {
    const ch = chargeAt(t, k);
    if (ch < L.charge) L.flare = Math.max(L.flare, 0.8);                // it zapped
    L.charge = ch;
    if (ch < ZAP_AT) g += 0.42 * (ch / ZAP_AT) ** 2 * crackle(t);
  }
  g += build * 0.9 * crackle(t) + L.flare * fxAt("burst", "peak");
  const gl = fx.glow.uniforms;
  gl.uAmount.value = g; gl.uTime.value = t; gl.uWhite.value = L.white;
  gl.uGlint.value = kinds.includes("glow") ? fxAt("glow", "amount", k) : 0;
  gl.uSweep.value = sweepAt(t, k);
  // A hair off its shape: its thickness's share (a rod's), never more than a little of its length (a sword's guard).
  const hair = Math.min(s.thick, s.length * 0.08);
  gl.uInflate.value = hair * (0.1 + 0.15 * gl.uGlint.value + 0.25 * beat + 0.35 * L.flare + 0.2 * L.white);
  // The energy lines.
  const en = fx.energy.uniforms;
  en.uAmount.value = fxAt("energy", "amount", k) * (0.9 + 0.1 * Math.sin(t * 2.4)); en.uTime.value = t; en.uPulses.value = fxAt("energy", "pulses", k);
  en.uWidth.value = 0.011 * size * fxAt("energy", "width", k);
  // The water.
  if (fx.water) { waterAt(fx.wet, t, k); waterAt(fx.trail.material as THREE.ShaderMaterial, t, k); }
  // The trail: a sample of its outer half each frame, kept for the trail's length.
  if (fx.trail.visible) laySweep(fx, h, t, fxAt("trail", "length", k) * (fx.water ? 1.4 : 1), shown && !frozen);
  L.prev = (L.prev ?? new THREE.Matrix4()).copy(mw);
  holder.position.add(L.shake);
}

/** The swept trail: its outer half's samples, newest first, aged by the trail's length; hidden while it stays still. */
function laySweep(fx: Fx, h: Holder, t: number, length: number, fresh: boolean) {
  const at = fx.live.trailAt, wet = fx.water;
  if (fresh) at.unshift({ a: h.along(wet ? 0.35 : 0.45, a).clone(), b: h.along(wet ? 1.06 : 1, b).clone(), t });
  while (at.length > TRAIL_N || (at.length && t - at[at.length - 1].t > length)) at.pop();
  const g = fx.trail.geometry, pos = g.getAttribute("position") as THREE.BufferAttribute, age = g.getAttribute("aTrail") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute, col = g.getAttribute("color") as THREE.BufferAttribute;
  const moved = at.length > 1 && at[0].b.distanceTo(at[at.length - 1].b) > h.size * 0.05;
  g.setDrawRange(0, moved ? Infinity : 0);
  if (!moved) return;
  const width = at[0].a.distanceTo(at[0].b) || 1;
  let run = 0;
  for (let i = 0; i < TRAIL_N; i++) {
    const s = at[Math.min(i, at.length - 1)], u = Math.min(1, (t - s.t) / length);
    if (i && i < at.length) run += s.b.distanceTo(at[i - 1].b) / width;
    pos.setXYZ(i * 2, s.a.x, s.a.y, s.a.z); pos.setXYZ(i * 2 + 1, s.b.x, s.b.y, s.b.z);
    age.setXY(i * 2, u, 0); age.setXY(i * 2 + 1, u, 1);
    uv.setXY(i * 2, 0, run * 3); uv.setXY(i * 2 + 1, 1, run * 3);
    // as water its end breaks up into foam: the oldest third, and anything past the samples kept
    const end = i >= at.length - 1 ? 1 : Math.max(0, (u - 0.55) / 0.45);
    col.setXYZ(i * 2, 0, 0, end); col.setXYZ(i * 2 + 1, 0, 0, end);
  }
  pos.needsUpdate = true; age.needsUpdate = true; uv.needsUpdate = true; col.needsUpdate = true;
}
