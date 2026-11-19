"use client";

/**
 * The effects library on any holder (David 2026-11-06: "this wont only be for fishing rod but for weapon, vfx clothes
 * etc"; specs/fx-library.md, lib/game/fx/library.ts). Give it the thing that holds the effect (a rod's model, a sword,
 * a hat: any object with meshes) and the types to wear; it reads only the holder's own shape (its surface sampled once,
 * its long axis, its size), never what the holder is.
 *
 * At most four draws, nothing lit, no light:
 *   - the glow shell (glow, pulse, flicker, the burst's flare): the holder's own shape a hair out, lit at its rim, a band
 *     of light running up it, breathing, beating, crackling;
 *   - the aura shell: its shape further out, tongues of light licking up it in cel bands;
 *   - the pool (lib/game/fx/holder.ts): motes, sparks, comets, electricity, embers, flame, sakura petals, light
 *     gathering in, and a strike from outside (lightning, a wave), in the world, so a swung holder leaves them behind;
 *   - the trail: a blade of light swept behind its outer half as it swings (the weapon trail's shader).
 * The shells ride the holder; the pool and the trail are the scene's (world space). `strength` eases (1 as made),
 * `once` throws the one-offs (sparks, the burst) each time it changes, `strike` plays a strike each time its key does.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FXLIB_PACK_ROWS, FXLIB_PACK_URL, createCombatParticleMaterial, createTrailMaterial, packTexture, rampMap } from "@/lib/game/fx/fxMaterial";
import { RampTable, sharedRamps } from "@/lib/game/fx/combat";
import { HolderPool, KIND_RAMP, POOL_KINDS, rampOf, seeded, throwKind, throwStrike, type Ctx, type Holder, type PoolKind, type StrikeKind } from "@/lib/game/fx/holder";
import { fxAt, fxGrow, type FxKind } from "@/lib/game/fx/library";

/** The most one holder's pool holds (budget.ts PARTICLE_POOLS). */
const CAPACITY = 320;
/** Surface points sampled off the holder. */
const POINTS = 64;
/** The trail's samples. */
const TRAIL_N = 20;

const NOISE = `float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
const SHELL_VERT = `uniform float uInflate; uniform vec3 uBase; uniform vec3 uAxis; uniform float uLen; uniform float uWobble; uniform float uFreq; uniform float uTime;
varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vS;
void main() {
  vS = dot(position - uBase, uAxis) / uLen;
  // the aura's edge licks upward: its inflation rippling up the world in two waves
  vec3 w0 = (modelMatrix * vec4(position, 1.0)).xyz;
  float lick = 1.0 + uWobble * (0.6 * sin(w0.y * uFreq * 1.3 - uTime * 4.1 + w0.x * uFreq) + 0.4 * sin(w0.y * uFreq * 2.7 - uTime * 6.3 + w0.z * uFreq * 1.7));
  vec3 transformed = position + normal * uInflate * lick;
  vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  // through project_vertex, so it bends with the curved world as its holder does (curvedWorld.ts)
  #include <project_vertex>
  vN = normalize(normalMatrix * normal); vView = normalize(-mvPosition.xyz);
}`;
/** Lit at its rim, a band of light running tip-ward, cut in three cel steps. */
const GLOW_FRAG = `uniform vec3 uColor; uniform float uAmount; uniform float uTime;
varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vS;
void main() {
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vView)));
  float b = fract(vS * 0.8 - uTime * 0.5);
  float band = smoothstep(0.0, 0.05, b) * (1.0 - smoothstep(0.05, 0.2, b));
  float a = uAmount * (0.2 + 0.8 * rim * rim + 0.9 * band);
  a = a > 0.9 ? 1.0 : a > 0.5 ? 0.62 : a > 0.18 ? 0.3 : 0.0;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;
/** Tongues of light licking up it (world up), brightest toward its rim, in three cel bands. */
const AURA_FRAG = `${NOISE}uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uEdge; uniform float uAmount; uniform float uTime; uniform float uFreq;
varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vS;
void main() {
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vView)));
  vec2 q = vec2((vW.x + vW.z) * uFreq, vW.y * uFreq * 0.55 - uTime * 1.8);
  float n = fxNoise(q) * 0.6 + fxNoise(q * 2.3 + vec2(0.0, -uTime * 1.3)) * 0.4;
  float heat = uAmount * (0.35 + 0.65 * rim) * (0.2 + 1.15 * n);
  if (heat < 0.36) discard;
  vec3 c = heat > 0.8 ? uCore : heat > 0.52 ? uMid : uEdge;
  gl_FragColor = vec4(c * (heat > 0.52 ? 0.95 : 0.6), 1.0);
  #include <colorspace_fragment>
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

const shellMaterial = (frag: string, uniforms: Record<string, THREE.IUniform>) => new THREE.ShaderMaterial({
  vertexShader: SHELL_VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uInflate: { value: 0 }, uBase: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 }, uTime: { value: 0 }, uAmount: { value: 0 },
    uWobble: { value: 0 }, uFreq: { value: 1 }, ...uniforms },
});
const SHELL_KINDS: FxKind[] = ["glow", "pulse", "flicker", "burst"];

/** One holder's effect: its pool and trail (the scene's), its two shell materials, and what it remembers frame to frame. */
interface Fx {
  pool: HolderPool; mesh: THREE.Mesh; attrs: THREE.InstancedBufferAttribute[]; rowOf: (kind: string) => number; trail: THREE.Mesh;
  glow: THREE.ShaderMaterial; aura: THREE.ShaderMaterial; rnd: () => number; state: Record<string, number>; strikeState: Record<string, number>;
  live: { k: number; t: number; flare: number; once: number; strikeKey: number; strikeT: number; shape: Shape | null; shells: THREE.Mesh[]; trailAt: { a: THREE.Vector3; b: THREE.Vector3; t: number }[] };
}

export interface Strike { kind: StrikeKind; /** Seconds from its start to when it lands. */ hit: number; /** A new key plays it again. */ key: number }

export default function HolderFx({ holder, kinds, strength = 1, colour = "#7FD8FF", once = 0, strike }: {
  holder: THREE.Object3D; kinds: readonly FxKind[]; strength?: number; colour?: string; once?: number; strike?: Strike;
}) {
  const scene = useThree(s => s.scene);
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
    const pool = new HolderPool(CAPACITY), geometry = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    geometry.index = quad.index;
    for (const n of ["position", "uv"]) geometry.setAttribute(n, quad.getAttribute(n));
    const attrs = [pool.a, pool.b, pool.c, pool.d].map((arr, k) => {
      const a = new THREE.InstancedBufferAttribute(arr, 4).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(`i${"ABCD"[k]}`, a);
      return a;
    });
    geometry.instanceCount = 0;
    const mesh = new THREE.Mesh(geometry, createCombatParticleMaterial(packTexture(FXLIB_PACK_URL), rampMap(table), true, 1, FXLIB_PACK_ROWS));
    mesh.frustumCulled = false; mesh.renderOrder = 3.6; mesh.name = "HolderFx";
    // the trail: TRAIL_N samples of its outer half, two vertices each
    const tg = new THREE.BufferGeometry(), idx: number[] = [];
    for (let i = 0; i < TRAIL_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute("aTrail", new THREE.BufferAttribute(new Float32Array(TRAIL_N * 4), 2).setUsage(THREE.DynamicDrawUsage));
    tg.setIndex(idx);
    for (const kind of [...kinds, strike?.kind]) if (kind) rowOf(kind);     // its rows ready before the first frame
    const trailMat = createTrailMaterial(rampMap(table));
    trailMat.uniforms.uRow.value = rowOf("trail");
    const trail = new THREE.Mesh(tg, trailMat);
    trail.frustumCulled = false; trail.renderOrder = 3.5; trail.visible = false;
    const glow = shellMaterial(GLOW_FRAG, { uColor: { value: new THREE.Color(colour) } });
    const [core, mid, edge] = rampOf(colour);
    const aura = shellMaterial(AURA_FRAG, { uCore: { value: new THREE.Color(core) }, uMid: { value: new THREE.Color(mid) }, uEdge: { value: new THREE.Color(edge) }, uWobble: { value: 0.45 } });
    return { pool, mesh, attrs, rowOf, trail, glow, aura, rnd: seeded(holder.id * 7919 + 3), state: {} as Record<string, number>, strikeState: {} as Record<string, number>,
      live: { k: strength, t: 0, flare: 0, once, strikeKey: strike?.key ?? 0, strikeT: -1, shape: null as Shape | null, shells: [] as THREE.Mesh[], trailAt: [] as { a: THREE.Vector3; b: THREE.Vector3; t: number }[] } };
    // the holder and its colour make it; strength, once and strike are read each frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder, colour]);
  useEffect(() => {
    scene.add(fx.mesh, fx.trail);
    return () => {
      scene.remove(fx.mesh, fx.trail);
      for (const s of fx.live.shells) s.removeFromParent();
      fx.mesh.geometry.dispose(); fx.trail.geometry.dispose(); fx.glow.dispose(); fx.aura.dispose();
      (fx.mesh.material as THREE.Material).dispose(); (fx.trail.material as THREE.Material).dispose();
    };
  }, [scene, fx]);
  useFrame(({ camera }, delta) => frame(fx, holder, kinds, strength, once, strike, camera, Math.min(delta, 0.1)));
  return null;
}


const right = new THREE.Vector3(), up = new THREE.Vector3(), ws = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
/** A step of crackle: a fresh level sixteen times a second. */
const crackle = (t: number) => { const k = Math.floor(t * 16); return 0.45 + 0.55 * Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1); };
/** A heartbeat: lub, then a softer dub, every 1.1 s. */
const lubdub = (t: number) => { const ph = (t / 1.1) % 1; return Math.exp(-(((ph - 0.04) / 0.05) ** 2)) + 0.6 * Math.exp(-(((ph - 0.26) / 0.05) ** 2)); };
const shownIn = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false; return true; };

/** Module scope (the react compiler forbids writing through hook values): one frame. */
function frame(fx: Fx, holder: THREE.Object3D, kinds: readonly FxKind[], strength: number, once: number, strike: Strike | undefined, camera: THREE.Camera, dt: number) {
  const L = fx.live;
  L.t += dt;
  L.k += (strength - L.k) * (1 - Math.exp(-dt * 3));
  if (!L.shape) {
    L.shape = shapeOf(holder);
    if (!L.shape) return;
    const s = L.shape, axis = s.tip.clone().sub(s.base).normalize();
    for (const m of [fx.glow, fx.aura]) { m.uniforms.uBase.value.copy(s.base); m.uniforms.uAxis.value.copy(axis); m.uniforms.uLen.value = s.length; }
    fx.trail.visible = kinds.includes("trail");
    for (const [mat, on] of [[fx.glow, kinds.some(k => SHELL_KINDS.includes(k))], [fx.aura, kinds.includes("aura")]] as const) {
      if (!on) continue;
      const shell = new THREE.Mesh(s.geometry, mat);
      shell.userData.fx = true; shell.raycast = () => {}; shell.renderOrder = 2; shell.frustumCulled = false;
      holder.add(shell);
      L.shells.push(shell);
    }
  }
  const s = L.shape, k = L.k, t = L.t, shown = shownIn(holder);
  holder.updateWorldMatrix(true, false);
  const mw = holder.matrixWorld, size = s.length * holder.getWorldScale(ws).x;
  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize(); up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const h: Holder = {
    n: POINTS, size, right,
    point: (i, out) => out.fromArray(s.points, i * 3).applyMatrix4(mw),
    normal: (i, out) => out.fromArray(s.normals, i * 3).transformDirection(mw),
    along: (u, out) => out.copy(s.base).lerp(s.tip, u).applyMatrix4(mw),
  };
  const ctx = (kind: string, state: Record<string, number>): Ctx => ({ pool: fx.pool, rnd: fx.rnd, holder: h, ramp: fx.rowOf(kind), k, t, dt, state });
  // The one-offs, each time `once` changes; the burst flares the glow shell.
  if (once !== L.once) {
    L.once = once;
    if (shown) for (const kind of ["sparks", "burst"] as const) if (kinds.includes(kind)) throwKind(kind, ctx(kind, fx.state));
    if (kinds.includes("burst")) L.flare = 1;
  }
  L.flare *= Math.exp(-dt * 5);
  if (shown) for (const kind of POOL_KINDS) if (kind !== "sparks" && kind !== "burst" && kinds.includes(kind)) throwKind(kind, ctx(kind, fx.state));
  if (strike) {
    if (strike.key !== L.strikeKey) { L.strikeKey = strike.key; L.strikeT = 0; for (const key of Object.keys(fx.strikeState)) delete fx.strikeState[key]; }
    if (L.strikeT >= 0) {
      L.strikeT += dt;
      throwStrike(strike.kind, ctx(strike.kind, fx.strikeState), L.strikeT, strike.hit);
      if (L.strikeT > strike.hit + 1.5) L.strikeT = -1;
    }
  }
  fx.pool.step(dt);
  const n = fx.pool.write(right, up);
  // always drawn (no instances when empty), so its shader compiles when it mounts, not on a strike's first frame
  (fx.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
  if (n) for (const at of fx.attrs) { at.clearUpdateRanges(); at.addUpdateRange(0, n * 4); at.needsUpdate = true; }
  // The shells.
  const beat = kinds.includes("pulse") ? lubdub(t) * fxGrow("pulse", "size", k) : 0;
  let g = kinds.includes("glow") ? fxAt("glow", "amount", k) * (0.8 + 0.2 * Math.sin(t * 1.3 * Math.PI * 2)) : 0;
  if (kinds.includes("pulse")) g += 0.25 + 0.9 * beat;
  if (kinds.includes("flicker")) g = (g || 0.9) * crackle(t);
  g += L.flare * fxAt("burst", "peak");
  fx.glow.uniforms.uAmount.value = g;
  fx.glow.uniforms.uTime.value = t;
  // A hair off its shape: its thickness's share (a rod's), never more than a little of its length (a sword's guard).
  const hair = Math.min(s.thick, s.length * 0.08);
  fx.glow.uniforms.uInflate.value = hair * (0.1 + 0.25 * beat + 0.35 * L.flare) * (kinds.includes("flicker") ? 0.8 + 0.4 * crackle(t + 0.37) : 1);
  fx.aura.uniforms.uAmount.value = (fxAt("aura", "opacity", k) / 0.55) * (0.85 + 0.15 * Math.sin(t * fxAt("aura", "breathe") * Math.PI * 2));
  fx.aura.uniforms.uTime.value = t;
  // The aura stands further off.
  fx.aura.uniforms.uInflate.value = hair * (fxAt("aura", "inflate") - 1) * 0.5 * Math.sqrt(k);
  fx.aura.uniforms.uFreq.value = 7 / Math.max(size, 1e-3);
  // The trail: a sample of its outer half each frame, kept for the trail's length.
  if (kinds.includes("trail")) laySweep(fx, h, t, fxAt("trail", "length", k), shown);
}

/** The swept blade: its outer half's samples, newest first, aged by the trail's length; hidden while it stays still. */
function laySweep(fx: Fx, h: Holder, t: number, length: number, shown: boolean) {
  const at = fx.live.trailAt;
  if (shown) at.unshift({ a: h.along(0.45, a).clone(), b: h.along(1, b).clone(), t });
  while (at.length > TRAIL_N || (at.length && t - at[at.length - 1].t > length)) at.pop();
  const pos = fx.trail.geometry.getAttribute("position") as THREE.BufferAttribute, age = fx.trail.geometry.getAttribute("aTrail") as THREE.BufferAttribute;
  const moved = at.length > 1 && at[0].b.distanceTo(at[at.length - 1].b) > h.size * 0.05;
  fx.trail.geometry.setDrawRange(0, moved ? Infinity : 0);
  if (!moved) return;
  for (let i = 0; i < TRAIL_N; i++) {
    const s = at[Math.min(i, at.length - 1)], u = Math.min(1, (t - s.t) / length);
    pos.setXYZ(i * 2, s.a.x, s.a.y, s.a.z); pos.setXYZ(i * 2 + 1, s.b.x, s.b.y, s.b.z);
    age.setXY(i * 2, u, 0); age.setXY(i * 2 + 1, u, 1);
  }
  pos.needsUpdate = true; age.needsUpdate = true;
}
