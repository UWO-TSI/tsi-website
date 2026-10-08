"use client";

/**
 * The combat effects renderer (design sheet §1.7): drains the runtime's FX events and draws each from its recipe in
 * the registry (lib/game/fx/combat.ts): the painted combat pack in one pooled particle system (768 glow, 256 smoke
 * and ink: nothing allocated per frame), ground decals (16, at most 4 s, half saturated), FxMaterial meshes (24
 * pooled rings, pillars, domes, beams, spikes), two pooled point lights for ults, and the weapon's ribbon trail from
 * its grip to its tip while it swings. Everything is seeded from the event and anchored where it happened, so every
 * client draws the same; it draws over the terrain's painted layers and under the telegraphs' rims (render order 3.4–3.5). Lite graphics: half the
 * particles, no lights. Holds still in the ult's freeze and the hitstop, slows with its slow motion.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { combat } from "@/lib/game/combat/runtime";
import { timeScale as worldSpeed } from "@/lib/game/slowMotion";
import { ParticlePool, FACE } from "@/lib/game/fx/particles";
import { COMBAT_PACK, COMBAT_PACK_URL } from "@/lib/game/fx/combatPack";
import { DEFAULT_RAMP, FX, FX_POOLS, RampTable, sharedRamps, type MeshLayer } from "@/lib/game/fx/combat";
import { createCombatParticleMaterial, createFxMaterial, createTrailMaterial, rampMap } from "@/lib/game/fx/fxMaterial";
import { weaponTrail } from "@/lib/game/fx/trail";
import { quality } from "@/lib/game/perf/governor";

type Ground = (x: number, z: number) => number;
/** An area's effects scale with its radius against this one (the demo slam's). */
const REF_RADIUS = 2.8;
const ramps = (sharedRamps.table ??= new RampTable());
let packTexture: THREE.Texture | null = null;
function combatPackMap() {
  if (!packTexture) { packTexture = new THREE.TextureLoader().load(COMBAT_PACK_URL); packTexture.colorSpace = THREE.NoColorSpace; packTexture.anisotropy = 4; } // heat is data, not colour
  return packTexture;
}

/** A ParticlePool drawn as one instanced quad mesh in a combat material. */
function poolMesh(pool: ParticlePool, material: THREE.Material, order: number) {
  const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
  g.index = quad.index;
  for (const n of ["position", "uv"]) g.setAttribute(n, quad.getAttribute(n));
  const attrs = [pool.a, pool.b, pool.c, pool.d].map((arr, k) => { const a = new THREE.InstancedBufferAttribute(arr, 4).setUsage(THREE.DynamicDrawUsage); g.setAttribute(`i${"ABCD"[k]}`, a); return a; });
  g.instanceCount = 0;
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false; mesh.renderOrder = order;
  return { mesh, attrs, g };
}

/** Rings with a radial uv (u around, v from the inner edge out), so the FxMaterial's centre line runs round them. */
function ringGeometry(seg = 64, inner = 0.78) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * inner, 0, s * inner, c, 0, s); uv.push(i / seg, 0, i / seg, 1);
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}
const SHAPES: Record<MeshLayer["shape"], () => THREE.BufferGeometry> = {
  ring: () => ringGeometry(),
  pillar: () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0),
  dome: () => new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  beam: () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
  spike: () => new THREE.ConeGeometry(1, 1, 6, 1, true).translate(0, 0.5, 0),
};
/** The FX lights stay in the scene at a constant count (dark when idle); Lite has none. Module scope: hook values are never written in a component. */
function showLights(lights: THREE.PointLight[], on: boolean) { for (const l of lights) l.visible = on; }
interface LiveMesh { layer: MeshLayer; t: number; x: number; y: number; z: number; yaw: number; scale: number; row: number; seed: number }
interface LiveLight { t: number; life: number; intensity: number }
interface FxSystem {
  glow: ParticlePool; ink: ParticlePool; decals: ParticlePool; pools: ParticlePool[];
  layers: ReturnType<typeof poolMesh>[]; meshes: THREE.Mesh[]; lights: THREE.PointLight[]; group: THREE.Group;
  geos: Record<MeshLayer["shape"], THREE.BufferGeometry>; live: (LiveMesh | null)[]; lit: (LiveLight | null)[]; color: THREE.Color;
}

/** One frame of the effects (module scope: hook values are never written in a component): spawn the events, step and draw the pools, meshes and lights. */
function stepFx(s: FxSystem, cam: { p: THREE.Vector3; d: THREE.Vector3 }, ground: Ground, lite: boolean, camera: THREE.Camera, clock: { elapsedTime: number }, delta: number) {
  const rt = combat.rt, dt = combat.hitstop > 0 || combat.freeze ? 0 : Math.min(delta, 0.05) * worldSpeed();
  // Spawn this frame's events.
  for (const ev of rt.fx) {
    const r = FX[ev.key];
    if (!r) continue;
    const row = ramps.row(r.ramp ?? ev.ramp ?? DEFAULT_RAMP), gy = ground(ev.x, ev.z), byR = ev.radius ? Math.min(2.4, Math.max(0.5, ev.radius / REF_RADIUS)) : 1;
    r.layers.forEach((l, li) => {
      const seed = (ev.seed + li * 0x9e3779b1) | 0;
      if (l.kind === "particles") {
        const pool = l.pool === "glow" ? s.glow : s.ink, dx = l.toward ? (ev.aim.x - ev.x) * (l.toward === "away" ? -1 : 1) : 0, dz = l.toward ? (ev.aim.z - ev.z) * (l.toward === "away" ? -1 : 1) : 0;
        pool.burst(l.recipe, ev.x, gy + (l.lift ?? 0), ev.z, gy, dx, dz, l.byRadius ? byR : 1, 0xffffff, seed, 1, row, (lite ? 0.5 : 1) * quality.knobs.particles);
      } else if (l.kind === "decal") {
        const size = l.size * (l.byRadius ? ev.radius ?? 1 : 1);
        s.decals.burst({ sprite: l.sprite, count: [1, 1], life: [l.life, l.life], size: [size, size], grow: 1.05, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0,
          alpha: 0.9, face: FACE.ground, fadeIn: 25, spin: l.spin }, ev.x, gy + 0.02, ev.z, gy, 0, 0, 1, 0xffffff, seed, 1, row);
      } else if (l.kind === "mesh") {
        const i = s.live.findIndex(x => !x), at = i < 0 ? s.live.length : i;
        if (at >= s.meshes.length) return; // the pool's full: the oldest effects already fill the screen
        s.live[at] = { layer: l, t: 0, x: ev.x, y: gy + (l.lift ?? 0), z: ev.z, yaw: Math.atan2(ev.aim.x - ev.x, ev.aim.z - ev.z), scale: l.byRadius ? byR : 1, row, seed: (seed >>> 0) % 997 };
        const m = s.meshes[at], up = l.shape === "pillar" || l.shape === "dome" || l.shape === "spike";
        m.geometry = s.geos[l.shape];
        (m.material as THREE.ShaderMaterial).uniforms.uUp.value = up ? 1 : 0;
        (m.material as THREE.ShaderMaterial).uniforms.uRim.value = l.shape === "dome" || l.shape === "pillar" ? 0.9 : 0.3;
      } else if (!lite) {
        const i = s.lit.findIndex(x => !x), at = i < 0 ? Math.min(s.lit.length, s.lights.length - 1) : i;
        s.lit[at] = { t: 0, life: l.life, intensity: l.intensity };
        const light = s.lights[at];
        light.position.set(ev.x, gy + 1.5, ev.z); light.distance = l.distance; light.color.set((r.ramp ?? ev.ramp ?? DEFAULT_RAMP)[1]);
      }
    });
  }
  rt.fx.length = 0;
  // Travel recipes: a wake thrown along each v2 shot every frame it flies.
  if (dt > 0) for (const sh of rt.projectiles) {
    const r = sh.hit?.travel ? FX[sh.hit.travel] : undefined;
    if (!r) continue;
    const row = ramps.row(sh.hit!.ramp ?? DEFAULT_RAMP), gy = ground(sh.x, sh.z);
    for (let li = 0; li < r.layers.length; li++) {
      const l = r.layers[li];
      if (l.kind === "particles") (l.pool === "glow" ? s.glow : s.ink).burst(l.recipe, sh.x, gy + (l.lift ?? 0), sh.z, gy, 0, 0, 1, 0xffffff, (sh.id * 7919 + li + Math.floor(clock.elapsedTime * 60)) | 0, 1, row, (lite ? 0.5 : 1) * quality.knobs.particles);
    }
  }
  // Step and draw the pools.
  camera.getWorldPosition(cam.p); camera.getWorldDirection(cam.d);
  const { p, d } = cam;
  for (let k = 0; k < s.pools.length; k++) {
    const pool = s.pools[k];
    pool.update(dt, 0, 0);
    const n = pool.write(p.x, p.y, p.z, d.x, d.y, d.z), layer = s.layers[k];
    layer.g.instanceCount = n;
    layer.mesh.visible = n > 0;
    if (n) for (const a of layer.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  }
  rampMap(ramps); // a new kit's ramp uploads once
  for (let i = 0; i < s.meshes.length; i++) {
    const m = s.meshes[i], live = s.live[i];
    if (!live) { m.visible = false; continue; }
    live.t += dt;
    const l = live.layer, u = Math.min(1, live.t / l.life), size = (l.from + (l.to - l.from) * (1 - (1 - u) * (1 - u))) * live.scale;
    if (u >= 1) { s.live[i] = null; m.visible = false; continue; }
    m.visible = true;
    m.position.set(live.x, live.y, live.z);
    m.rotation.set(0, l.shape === "beam" ? live.yaw : 0, 0);
    if (l.shape === "beam") m.scale.set(Math.max(0.2, size * 0.25), 1, l.to * live.scale);
    else m.scale.set(size, l.shape === "ring" ? 1 : (l.height ?? 1) * (l.shape === "dome" ? size / Math.max(0.01, l.to) : 1), size);
    const un = (m.material as THREE.ShaderMaterial).uniforms;
    un.uRow.value = live.row; un.uLife.value = u * u; un.uTime.value = clock.elapsedTime; un.uSeed.value = live.seed; un.uOpacity.value = 1 - u * 0.3;
  }
  for (let i = 0; i < s.lights.length; i++) {
    const light = s.lights[i], l = s.lit[i];
    if (l && (l.t += dt) >= l.life) s.lit[i] = null;
    light.intensity = s.lit[i] ? l!.intensity * (1 - l!.t / l!.life) : 0;
  }
}

export default function CombatFx({ ground, lite = false }: { ground: Ground; lite?: boolean }) {
  const scene = useThree(s => s.scene);
  const sys = useMemo((): FxSystem => {
    const map = combatPackMap(), ramp = rampMap(ramps);
    const glow = new ParticlePool(FX_POOLS.glow, COMBAT_PACK), ink = new ParticlePool(FX_POOLS.ink, COMBAT_PACK), decals = new ParticlePool(FX_POOLS.decals, COMBAT_PACK);
    // Above the terrain's painted sand and soil layers (render orders 2, 3, transparent), under the telegraphs' rims (4).
    const layers = [poolMesh(decals, createCombatParticleMaterial(map, ramp, false, 0.5), 3.4), poolMesh(ink, createCombatParticleMaterial(map, ramp, false), 3.45), poolMesh(glow, createCombatParticleMaterial(map, ramp, true), 3.5)];
    const geos = Object.fromEntries(Object.entries(SHAPES).map(([k, f]) => [k, f()])) as Record<MeshLayer["shape"], THREE.BufferGeometry>;
    const meshes = Array.from({ length: FX_POOLS.meshes }, () => {
      const m = new THREE.Mesh(geos.ring, createFxMaterial(ramp, { profile: "across" }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 3.5;
      return m;
    });
    // Always in the scene at a constant count (dark when idle): a light appearing changes every lit material's program,
    // which recompiled the whole scene on the first ult (specs/perf/2026-10-baseline.md). Lite has none.
    const lights = Array.from({ length: FX_POOLS.lights }, () => { const l = new THREE.PointLight("#ffffff", 0, 10, 2); return l; });
    const group = new THREE.Group();
    for (const l of layers) group.add(l.mesh);
    for (const m of meshes) group.add(m);
    for (const l of lights) group.add(l);
    return { glow, ink, decals, layers, meshes, lights, group, geos, pools: [decals, ink, glow], live: [] as (LiveMesh | null)[], lit: [] as (LiveLight | null)[], color: new THREE.Color() };
  }, []);
  useEffect(() => {
    scene.add(sys.group);
    return () => { scene.remove(sys.group); for (const l of sys.layers) { l.g.dispose(); (l.mesh.material as THREE.Material).dispose(); } for (const m of sys.meshes) (m.material as THREE.Material).dispose(); for (const g of Object.values(sys.geos)) g.dispose(); };
  }, [scene, sys]);
  useEffect(() => showLights(sys.lights, !lite), [sys, lite]);
  const cam = useRef({ p: new THREE.Vector3(), d: new THREE.Vector3() });

  useFrame(({ camera, clock }, delta) => stepFx(sys, cam.current, ground, lite, camera, clock, delta));
  return <WeaponTrail ramp={ramps} />;
}

/** The ribbon behind a swing: the held weapon's grip and tip sampled each frame while it swings, fading over 0.16 s. */
const TRAIL = { samples: 18, life: 0.16 } as const;
const tipLocal = new WeakMap<THREE.Object3D, number>();
function tipLength(model: THREE.Object3D): number {
  let len = tipLocal.get(model);
  if (len !== undefined) return len;
  len = 0.4;
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert(), box = new THREE.Box3(), m = new THREE.Matrix4();
  model.traverse(o => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; mesh.geometry.computeBoundingBox(); box.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(inv, mesh.matrixWorld)); len = Math.max(len!, box.max.y); });
  tipLocal.set(model, len);
  return len;
}
function WeaponTrail({ ramp }: { ramp: RampTable }) {
  const scene = useThree(s => s.scene);
  const t = useMemo(() => {
    const n = TRAIL.samples, pos = new Float32Array(n * 2 * 3), trail = new Float32Array(n * 2 * 2), idx: number[] = [];
    for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aTrail", new THREE.BufferAttribute(trail, 2).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, createTrailMaterial(rampMap(ramp)));
    mesh.frustumCulled = false; mesh.renderOrder = 3.5; mesh.visible = false;
    return { mesh, g, pos, trail, ages: new Float32Array(n).fill(1), head: 0, base: new THREE.Vector3(), tip: new THREE.Vector3() };
  }, [ramp]);
  useEffect(() => { scene.add(t.mesh); return () => { scene.remove(t.mesh); t.g.dispose(); (t.mesh.material as THREE.Material).dispose(); }; }, [scene, t]);
  useFrame((_, delta) => {
    const rt = combat.rt, model = weaponTrail.model as THREE.Object3D | null, n = TRAIL.samples, dt = Math.min(delta, 0.05);
    const v = rt.v2;
    for (let i = 0; i < n; i++) t.ages[i] = Math.min(1, t.ages[i] + dt / TRAIL.life);
    if (v && model?.parent && rt.player.swing > 0) {
      // Newest sample at the head: shift the ring down one.
      t.pos.copyWithin(6, 0, (n - 1) * 6); t.ages.copyWithin(1, 0, n - 1);
      model.updateWorldMatrix(true, false);
      t.base.set(0, 0, 0).applyMatrix4(model.matrixWorld); t.tip.set(0, tipLength(model), 0).applyMatrix4(model.matrixWorld);
      t.pos.set([t.base.x, t.base.y, t.base.z, t.tip.x, t.tip.y, t.tip.z], 0); t.ages[0] = 0;
      if (t.ages[1] >= 1) for (let i = 1; i < n; i++) t.pos.copyWithin(i * 6, 0, 6); // a new swing: no streak back to the last one
      (t.mesh.material as THREE.ShaderMaterial).uniforms.uRow.value = ramps.row(v.kit.look.ramp);
    }
    let alive = false;
    for (let i = 0; i < n; i++) { t.trail[i * 4] = t.ages[i]; t.trail[i * 4 + 1] = 0; t.trail[i * 4 + 2] = t.ages[i]; t.trail[i * 4 + 3] = 1; alive ||= t.ages[i] < 1; }
    t.mesh.visible = alive;
    if (alive) { (t.g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (t.g.attributes.aTrail as THREE.BufferAttribute).needsUpdate = true; }
  });
  return null;
}
