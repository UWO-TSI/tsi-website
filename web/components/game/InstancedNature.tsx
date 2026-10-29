"use client";

/**
 * Instanced rendering for GLB scenery (perf 2026-06-01; the village's nature
 * and props since the island painter, specs/island-painter.md §10).
 *
 * Replaces per-position clones (one draw call per sub-mesh per instance) with
 * one `THREE.InstancedMesh` per sub-mesh shared across every placement of the
 * model. A painted island scales its tree count with its size; this keeps the
 * draw count flat.
 *
 * Nothing about the look changes: the model is prepared exactly as GLBProp
 * prepares it (materials, shadow roles, ACNH caster hulls, the sway caster's
 * depth material), each instance gets the contact shadow GLBProp would have
 * registered (from the model's own bounds, lib/game/shadows.ts), and the tree
 * sway reads each instance's own root (modelMaterials addTreeSway).
 *
 * The plant and prop GLBs carry no node transforms (measured), so a sub-mesh's
 * geometry is already in the model's frame and the instance matrix is the
 * whole placement.
 *
 * A model with a far version (lib/game/natureLod.ts: our trees) draws each
 * placement near or far by its distance from the camera: two sets of meshes,
 * the placements re-packed between them only when one crosses the line.
 */

import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { lodOf, updateNear } from "@/lib/game/natureLod";
import { CurvedCull, cullMeshes } from "@/lib/game/curvedCull";
import { fxOn } from "@/lib/game/perf/fxBench";
import { hash01 } from "@/lib/game/worldFx";
import { addContact, modelContact } from "./ContactShadows";

export interface NaturePlacement {
  position: [number, number, number];
  rotation?: number; // y-axis radians
  scale?: number;
}

const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const matrixOf = (p: NaturePlacement, base: number) =>
  new THREE.Matrix4().compose(_p.set(...p.position), _q.setFromAxisAngle(_up, p.rotation ?? 0), _s.setScalar((p.scale ?? 1) * base));

const _tint = new THREE.Color();
/** A crown's tint from where it stands: a touch lighter or darker, yellower or bluer. */
function crownTint(m: THREE.Matrix4, out: THREE.Color): THREE.Color {
  const e = m.elements, a = hash01(Math.round(e[12] * 7), Math.round(e[14] * 7)), b = hash01(Math.round(e[14] * 5), Math.round(e[12] * 3));
  const v = 0.86 + 0.24 * a, warm = 0.12 * (b - 0.5);
  return out.setRGB(v * (1 + warm), v, v * (1 - warm));
}

interface InstancedGLBProps {
  url: string;
  placements: readonly NaturePlacement[];
  /** Per-instance scale multiplier — multiplied with the placement's scale. */
  baseScale?: number;
  emissiveIntensity?: number;
}

/** A prepared model as one InstancedMesh per sub-mesh, each holding every placement (as GLBProp prepares it). */
function useInstanced(url: string, matrices: readonly THREE.Matrix4[], emissiveIntensity?: number) {
  const { scene } = useGLTF(url);
  const cls = shadowClassFor(url);
  const model = useMemo(() => prepareModel(scene, url, emissiveIntensity, cls), [scene, url, emissiveIntensity, cls]);
  useEffect(() => {
    applyModelTextures(model, url);
    return () => disposeModelMaterials(model);
  }, [model, url]);
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    model.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !m.geometry || !matrices.length) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
      matrices.forEach((matrix, i) => im.setMatrixAt(i, matrix));
      // The forest's crowns, each tree its own shade of green (trees-art: the hue is in the vertex colour, the tint multiplies it).
      if ((m.material as THREE.Material).name === "mForestCrown") matrices.forEach((matrix, i) => im.setColorAt(i, crownTint(matrix, _tint)));
      // The shadow role prepareModel gave this sub-mesh (caster-only hulls stay hidden until SunShadows draws them).
      Object.assign(im, { name: m.name, castShadow: m.castShadow, receiveShadow: m.receiveShadow, visible: m.visible, frustumCulled: false, customDepthMaterial: m.customDepthMaterial });
      // Its own visibility, which a level's packing (InstancedLodGLB) keeps: a caster-only hull stays hidden.
      im.userData = { ...m.userData, levelVisible: m.visible };
      out.push(im);
    });
    return out;
  }, [model, matrices]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return { model, meshes, cls };
}

/** One contact shadow per placement, from the model's own bounds (what GLBProp registers per clone), shown with the returned group. */
function useContacts(model: THREE.Object3D, url: string, cls: ReturnType<typeof shadowClassFor>, matrices: readonly THREE.Matrix4[]) {
  const world = useThree((s) => s.scene);
  const contact = useMemo(() => modelContact(model, url, cls), [model, url, cls]);
  const owner = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    if (!contact) return;
    const removals = matrices.map((matrix) => addContact(world, owner, contact, matrix));
    return () => removals.forEach((remove) => remove());
  }, [world, owner, matrices, contact]);
  return owner;
}

/** Render N placements of one GLB: one InstancedMesh per sub-mesh, all sharing the placements. */
export default function InstancedGLB({ url, placements, baseScale = 1, emissiveIntensity }: InstancedGLBProps) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, baseScale)), [placements, baseScale]);
  const { model, meshes, cls } = useInstanced(url, matrices, emissiveIntensity);
  const owner = useContacts(model, url, cls, matrices);
  return <primitive object={owner}>{meshes.map((m, i) => <primitive key={i} object={m} />)}</primitive>;
}

/** Module scope, as assignLevels: the level meshes' matrices change as the camera moves. */
function prepareLevels(meshes: readonly THREE.InstancedMesh[]) {
  for (const m of meshes) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
}

/**
 * Module scope (the react compiler forbids writing through hook values): give each placement to its level's meshes,
 * near ones to `near`, the rest to `far`, packed from index 0 with the count set. A level with none is hidden.
 */
function assignLevels(flags: Uint8Array, matrices: readonly THREE.Matrix4[], near: readonly THREE.InstancedMesh[], far: readonly THREE.InstancedMesh[]) {
  for (const [meshes, want] of [[near, 1], [far, 0]] as const) for (const m of meshes) {
    let n = 0;
    for (let i = 0; i < flags.length; i++) if (flags[i] === want) m.setMatrixAt(n++, matrices[i]);
    m.count = n;
    m.visible = n > 0 && m.userData.levelVisible !== false;
    m.instanceMatrix.needsUpdate = true;
  }
}

/**
 * A GLB with a far model (lib/game/natureLod.ts, our trees): each placement draws the near model within LOD1_DISTANCE
 * of the camera and the far one past it, re-sorted only when one crosses. Contact shadows come from the near model.
 */
function InstancedLodGLB({ url, far, placements }: { url: string; far: string; placements: readonly NaturePlacement[] }) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, 1)), [placements]);
  const hi = useInstanced(url, matrices), lo = useInstanced(far, matrices);
  const owner = useContacts(hi.model, url, hi.cls, matrices);
  const state = useMemo(() => {
    const xyz = new Float32Array(placements.length * 3);
    placements.forEach((p, i) => xyz.set(p.position, i * 3));
    // Every placement starts far; the first frame brings the near ones in.
    const flags = new Uint8Array(placements.length);
    prepareLevels([...hi.meshes, ...lo.meshes]);
    assignLevels(flags, matrices, hi.meshes, lo.meshes);
    return { xyz, flags };
  }, [placements, matrices, hi.meshes, lo.meshes]);
  useFrame(({ camera }) => {
    if (updateNear(state.flags, state.xyz, camera.position.x, camera.position.y, camera.position.z)) assignLevels(state.flags, matrices, hi.meshes, lo.meshes);
  });
  return <primitive object={owner}>{[...hi.meshes, ...lo.meshes].map((m, i) => <primitive key={i} object={m} />)}</primitive>;
}

/**
 * Culled placements (perf-tris, the new world): each placement drawn only while the bent view can see it
 * (lib/game/curvedCull.ts), at its level where the model has a far one (as InstancedLodGLB). A sub-mesh that casts hands
 * its casting to a twin that holds every placement and draws in the shadow passes alone (SunShadows casterOnly), as the
 * caster hulls already do, so a culled placement keeps its shadow. Every placement shows on the first frame, so every
 * program compiles while the scene loads.
 */
interface Culled { xyz: Float32Array; spheres: THREE.Sphere[]; near: Uint8Array; shown: Uint8Array; levels: THREE.InstancedMesh[][]; twins: THREE.InstancedMesh[] }

/** Module scope (the react compiler forbids writing through hook values): each casting sub-mesh's twin, the sub-mesh no longer casting. */
function casterTwins(meshes: readonly THREE.InstancedMesh[]): THREE.InstancedMesh[] {
  return meshes.flatMap(m => {
    if (!m.castShadow || m.userData.levelVisible === false) return [];
    const twin = new THREE.InstancedMesh(m.geometry, m.material, m.instanceMatrix.count);
    Object.assign(twin, { name: m.name, castShadow: true, receiveShadow: false, visible: false, frustumCulled: false, customDepthMaterial: m.customDepthMaterial });
    twin.userData = { ...m.userData, casterOnly: true, levelVisible: false };
    m.castShadow = false;
    return [twin];
  });
}

/** Pack each level's meshes from index 0: the casters (hidden, levelVisible false) every placement at their level, the rest only those shown. */
function packCulled(c: Culled, matrices: readonly THREE.Matrix4[], casters: boolean) {
  c.levels.forEach((meshes, level) => {
    for (const m of meshes) {
      const caster = m.userData.levelVisible === false;
      if (caster && !casters) continue;
      let n = 0;
      for (let i = 0; i < matrices.length; i++) {
        if ((c.levels.length > 1 && c.near[i] !== (level === 0 ? 1 : 0)) || (!caster && !c.shown[i])) continue;
        m.setMatrixAt(n, matrices[i]);
        if (m.instanceColor) m.setColorAt(n, crownTint(matrices[i], _tint));
        n++;
      }
      m.count = n;
      m.visible = n > 0 && !caster;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });
}

function culledState(matrices: readonly THREE.Matrix4[], model: THREE.Object3D, meshes: readonly (readonly THREE.InstancedMesh[])[]): Culled {
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()), n = matrices.length;
  const twins = meshes.map(casterTwins);
  const c: Culled = {
    xyz: new Float32Array(matrices.flatMap(m => [m.elements[12], m.elements[13], m.elements[14]])),
    spheres: matrices.map(m => sphere.clone().applyMatrix4(m)),
    // Every placement starts far and shown: the first frame brings the near ones in and culls the rest.
    near: new Uint8Array(n), shown: new Uint8Array(n).fill(1),
    levels: meshes.map((ms, i) => [...ms, ...twins[i]]), twins: twins.flat(),
  };
  for (const m of c.levels.flat()) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  packCulled(c, matrices, true);
  return c;
}

function frameCulled(c: Culled, matrices: readonly THREE.Matrix4[], cull: CurvedCull, camera: THREE.Camera) {
  const p = camera.position, levels = c.levels.length > 1 && updateNear(c.near, c.xyz, p.x, p.y, p.z);
  cull.update(camera);
  // The bench's switch (lib/game/perf/fxBench.ts `viewCull`): every placement shown, as before the cull.
  const all = !fxOn("viewCull");
  let shown = false;
  for (let i = 0; i < c.spheres.length; i++) {
    const on = all || cull.visible(c.spheres[i]) ? 1 : 0;
    if (on !== c.shown[i]) { c.shown[i] = on; shown = true; }
  }
  if (levels || shown) packCulled(c, matrices, levels);
}

function useCulled(matrices: readonly THREE.Matrix4[], model: THREE.Object3D, meshes: readonly (readonly THREE.InstancedMesh[])[]) {
  const cull = useMemo(() => new CurvedCull(), []);
  const c = useMemo(() => culledState(matrices, model, meshes), [matrices, model, meshes]);
  useEffect(() => () => c.twins.forEach(m => m.dispose()), [c]);
  useFrame(({ camera }) => frameCulled(c, matrices, cull, camera));
  return c.levels.flat();
}

function CulledOne({ url, placements }: { url: string; placements: readonly NaturePlacement[] }) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, 1)), [placements]);
  const one = useInstanced(url, matrices);
  const owner = useContacts(one.model, url, one.cls, matrices);
  const levels = useMemo(() => [one.meshes], [one.meshes]);
  const meshes = useCulled(matrices, one.model, levels);
  return <primitive object={owner}>{meshes.map((m, i) => <primitive key={i} object={m} />)}</primitive>;
}

function CulledLod({ url, far, placements }: { url: string; far: string; placements: readonly NaturePlacement[] }) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, 1)), [placements]);
  const hi = useInstanced(url, matrices), lo = useInstanced(far, matrices);
  const owner = useContacts(hi.model, url, hi.cls, matrices);
  const levels = useMemo(() => [hi.meshes, lo.meshes], [hi.meshes, lo.meshes]);
  const meshes = useCulled(matrices, hi.model, levels);
  return <primitive object={owner}>{meshes.map((m, i) => <primitive key={i} object={m} />)}</primitive>;
}

const CulledGLB = ({ url, far, placements }: { url: string; far: string | null; placements: readonly NaturePlacement[] }) =>
  far ? <CulledLod url={url} far={far} placements={placements} /> : <CulledOne url={url} placements={placements} />;

/** One placed model: its url and world transform. */
export interface ModelPlacement extends NaturePlacement { url: string }

/**
 * Many models at once, grouped by url into one InstancedGLB each (each loads on its own). `cull` (the new world,
 * perf-tris): each model draws only the placements the bent view can see (CulledGLB).
 */
export function InstancedModels({ items, cull }: { items: readonly ModelPlacement[]; cull?: boolean }) {
  const groups = useMemo(() => {
    const byUrl = new Map<string, NaturePlacement[]>();
    for (const { url, ...p } of items) { const group = byUrl.get(url); if (group) group.push(p); else byUrl.set(url, [p]); }
    return [...byUrl];
  }, [items]);
  return <>{groups.map(([url, placements]) => {
    const far = lodOf(url);
    return <Suspense key={url} fallback={null}>{cull ? <CulledGLB url={url} far={far} placements={placements} /> : far ? <InstancedLodGLB url={url} far={far} placements={placements} /> : <InstancedGLB url={url} placements={placements} />}</Suspense>;
  })}</>;
}

/** A material's look, for merging: two materials that draw alike share a merged mesh. `images` names textures by their image (imageKeys). */
export const lookKey = (m: THREE.Material, images?: ReadonlyMap<THREE.Texture, string>) => {
  const s = m as THREE.MeshStandardMaterial, tex = (t: THREE.Texture | null) => t && (images?.get(t) ?? t.uuid);
  return [m.name, s.color?.getHexString(), tex(s.map), tex(s.emissiveMap), s.vertexColors, m.transparent, m.opacity, s.roughness, s.metalness, m.side, m.userData.lookClass].join("|");
};
/** Each of a GLB's textures by its image's bytes: every file loads its own copy of a shared image (the rope, the decor wood), and the copies merge. */
function imageKeys(gltf: GLTF, out: Map<THREE.Texture, string>) {
  const { json, associations, extensions } = gltf.parser, body: ArrayBuffer | undefined = extensions.KHR_binary_glTF?.body;
  for (const [texture, ref] of associations) {
    const view = body && ref.textures !== undefined && json.bufferViews[json.images[json.textures[ref.textures].source]?.bufferView];
    if (!view) continue;
    let h = 2166136261;
    for (const b of new Uint8Array(body, view.byteOffset ?? 0, view.byteLength)) h = Math.imul(h ^ b, 16777619);
    out.set(texture as THREE.Texture, `${view.byteLength}:${h >>> 0}`);
  }
  return out;
}
/** The geometry's attribute layout (mergeGeometries needs it the same). */
export const layoutKey = (g: THREE.BufferGeometry) => Object.entries(g.attributes).map(([n, a]) => `${n}:${a.itemSize}:${(a as THREE.BufferAttribute).array.constructor.name}:${a.normalized}`).sort().join(",") + `|${g.index ? "i" : "n"}`;

/**
 * Each prepared model baked in at each of its placements and joined into one mesh per look across them all, casting as
 * its class says (prepareModel) and receiving (still props and buildings). `images` merges looks whose textures share an image (imageKeys).
 * `part` (MergedModels `cull`): "view" joins what draws per block of `block` units, none of it casting; "caster" joins
 * only what casts, across the whole world, drawn in the shadow passes alone (SunShadows casterOnly).
 */
export function mergeByLook(placed: readonly (readonly [THREE.Object3D, THREE.Matrix4])[], images?: ReadonlyMap<THREE.Texture, string>, part?: { view: number } | "caster") {
  const groups = new Map<string, { material: THREE.Material; cast: boolean; geometries: THREE.BufferGeometry[] }>();
  for (const [model, place] of placed) {
    model.updateMatrixWorld(true);
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material) || (part === "caster" && !mesh.castShadow)) return;
      const g = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(place, mesh.matrixWorld));
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      const cast = part ? part === "caster" : mesh.castShadow, e = place.elements;
      const block = part && part !== "caster" ? `#${Math.floor(e[12] / part.view)}:${Math.floor(e[14] / part.view)}` : "";
      const key = `${lookKey(mesh.material, images)}#${layoutKey(g)}#${cast}${block}`;
      const group = groups.get(key) ?? { material: mesh.material, cast, geometries: [] };
      group.geometries.push(g);
      groups.set(key, group);
    });
  }
  return [...groups.values()].map(({ material, cast, geometries }) => {
    const mesh = new THREE.Mesh(geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false) ?? geometries[0], material);
    // The curved world bends far things down into view (modelMaterials prepareModel): never culled by their own bounds.
    mesh.castShadow = cast; mesh.receiveShadow = true; mesh.frustumCulled = false;
    if (part === "caster") { mesh.userData.casterOnly = true; mesh.visible = false; }
    return mesh;
  });
}

/** Module scope (frame loops write no hook values): each view block shown while the bent view can see it, or all of them with the bench's `viewCull` off. */
function cullView(cull: CurvedCull, camera: THREE.Camera, view: readonly THREE.Mesh[]) {
  if (!view.length) return;
  if (fxOn("viewCull")) cullMeshes(cull.update(camera), view);
  else for (const m of view) m.visible = true;
}
/** The blocks (world units) MergedModels `cull` joins the view by: a look's parts in a block draw as one mesh. */
const CULL_BLOCK = 32;
/**
 * Still props merged (the new world's dressing, R2c perf): every placement of every model baked into place and joined
 * into one mesh per look across all the models (the art lanes share their material presets so parts merge: David,
 * 2026-10-17), so dozens of small props draw in a handful of calls. Each placement keeps its contact shadow. For models
 * that never move, sway or glow on their own.
 */
export function MergedModels({ items, emissiveIntensity, cull }: { items: readonly ModelPlacement[]; emissiveIntensity?: number; cull?: boolean }) {
  const urls = useMemo(() => [...new Set(items.map(i => i.url))], [items]);
  const gltfs = useGLTF(urls) as unknown as GLTF[];
  const images = useMemo(() => gltfs.reduce((out, gltf) => imageKeys(gltf, out), new Map<THREE.Texture, string>()), [gltfs]);
  const models = useMemo(() => urls.map((url, i) => prepareModel(gltfs[i].scene, url, emissiveIntensity, shadowClassFor(url))), [gltfs, urls, emissiveIntensity]);
  useEffect(() => {
    models.forEach((model, i) => applyModelTextures(model, urls[i]));
    return () => models.forEach(model => disposeModelMaterials(model));
  }, [models, urls]);
  const [meshes, view] = useMemo(() => {
    const placed = items.map(({ url, ...p }) => [models[urls.indexOf(url)], matrixOf(p, 1)] as const);
    if (!cull) return [mergeByLook(placed, images), []];
    // `cull` (perf-tris, the new world): the view joined per block and each block drawn only while the bent view can
    // see it; the shadows from a whole-world caster copy, so a culled block keeps its shadow.
    const view = mergeByLook(placed, images, { view: CULL_BLOCK });
    return [[...view, ...mergeByLook(placed, images, "caster")], view];
  }, [models, urls, items, images, cull]);
  useEffect(() => () => meshes.forEach(m => m.geometry.dispose()), [meshes]);
  const curved = useMemo(() => new CurvedCull(), []);
  useFrame(({ camera }) => cullView(curved, camera, view));
  const world = useThree(s => s.scene);
  const owner = useMemo(() => new THREE.Group(), []);
  useEffect(() => {
    const contacts = urls.map((url, i) => modelContact(models[i], url, shadowClassFor(url)));
    const removals = items.flatMap(({ url, ...p }) => {
      const contact = contacts[urls.indexOf(url)];
      return contact ? [addContact(world, owner, contact, matrixOf(p, 1))] : [];
    });
    return () => removals.forEach(remove => remove());
  }, [world, owner, items, urls, models]);
  return <primitive object={owner}>{meshes.map((m, i) => <primitive key={i} object={m} />)}</primitive>;
}

/** One model's InstancedMeshes (one a sub-mesh), each sub-mesh's place in the model, and how many are filled this frame. */
export interface Flock { meshes: THREE.InstancedMesh[]; local: THREE.Matrix4[]; n: number }
/**
 * Every moving copy of one model at one scale (the bugs, the shore crabs) as one InstancedMesh per sub-mesh
 * (perf-newworld: each copy was a draw per material). Each copy keeps its own group and model, its meshes hidden
 * (`showOwn`) while it draws in the flock; the frame loop that moves the groups fills it (startFlock, addToFlock,
 * endFlock), in `flocks` under `url|scale`.
 */
export function ModelFlock({ url, scale, cap, flocks }: { url: string; scale: number; cap: number; flocks: Map<string, Flock> }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const m = prepareModel(scene, url);
    m.scale.setScalar(scale);
    m.updateMatrixWorld(true);
    return m;
  }, [scene, url, scale]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  const flock = useMemo(() => {
    const f: Flock = { meshes: [], local: [], n: 0 };
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, cap);
      // The curved world bends far things down into view (modelMaterials prepareModel): never culled by their own bounds.
      Object.assign(im, { castShadow: m.castShadow, receiveShadow: m.receiveShadow, frustumCulled: false, count: 0 });
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Its copies move: SunShadows casts it every frame, never from the cached static map.
      if (m.castShadow) im.userData.sunCaster = "dynamic";
      f.meshes.push(im);
      f.local.push(m.matrixWorld.clone());
    });
    return f;
  }, [model, cap]);
  // Before the frame after the commit that mounts its meshes, so a rebuilt flock (a new count) never misses a frame.
  useLayoutEffect(() => {
    const key = `${url}|${scale}`;
    flocks.set(key, flock);
    return () => { flocks.delete(key); flock.meshes.forEach(m => m.dispose()); };
  }, [flocks, flock, url, scale]);
  return <>{flock.meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}
const _part = new THREE.Matrix4();
let _ownShown = true;
function showOwnOne(o: THREE.Object3D) { if ((o as THREE.Mesh).isMesh) o.visible = _ownShown; }
/** A copy's own meshes shown (drawn alone) or hidden (drawn in its flock); its group, and so its contact shadow, stay. */
export function showOwn(group: THREE.Object3D, on: boolean) { _ownShown = on; group.traverse(showOwnOne); }
export const startFlock = (f: Flock) => { f.n = 0; };
/** The copy whose group is `group` (moved this frame, a sibling of the flock's meshes) into the flock's next slot; false when the flock is full. */
export function addToFlock(f: Flock, group: THREE.Object3D): boolean {
  if (f.n >= (f.meshes[0]?.instanceMatrix.count ?? 0)) return false;
  group.updateMatrix();
  for (let k = 0; k < f.meshes.length; k++) f.meshes[k].setMatrixAt(f.n, _part.multiplyMatrices(group.matrix, f.local[k]));
  f.n++;
  return true;
}
export function endFlock(f: Flock) { for (const m of f.meshes) { m.count = f.n; m.instanceMatrix.needsUpdate = true; } }
