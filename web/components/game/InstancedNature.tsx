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

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { lodOf, updateNear } from "@/lib/game/natureLod";
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

/** One placed model: its url and world transform. */
export interface ModelPlacement extends NaturePlacement { url: string }

/** Many models at once, grouped by url into one InstancedGLB each (each loads on its own). */
export function InstancedModels({ items }: { items: readonly ModelPlacement[] }) {
  const groups = useMemo(() => {
    const byUrl = new Map<string, NaturePlacement[]>();
    for (const { url, ...p } of items) { const group = byUrl.get(url); if (group) group.push(p); else byUrl.set(url, [p]); }
    return [...byUrl];
  }, [items]);
  return <>{groups.map(([url, placements]) => {
    const far = lodOf(url);
    return <Suspense key={url} fallback={null}>{far ? <InstancedLodGLB url={url} far={far} placements={placements} /> : <InstancedGLB url={url} placements={placements} />}</Suspense>;
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
 */
export function mergeByLook(placed: readonly (readonly [THREE.Object3D, THREE.Matrix4])[], images?: ReadonlyMap<THREE.Texture, string>) {
  const groups = new Map<string, { material: THREE.Material; cast: boolean; geometries: THREE.BufferGeometry[] }>();
  for (const [model, place] of placed) {
    model.updateMatrixWorld(true);
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material)) return;
      const g = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(place, mesh.matrixWorld));
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      const key = `${lookKey(mesh.material, images)}#${layoutKey(g)}#${mesh.castShadow}`;
      const group = groups.get(key) ?? { material: mesh.material, cast: mesh.castShadow, geometries: [] };
      group.geometries.push(g);
      groups.set(key, group);
    });
  }
  return [...groups.values()].map(({ material, cast, geometries }) => {
    const mesh = new THREE.Mesh(geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false) ?? geometries[0], material);
    // The curved world bends far things down into view (modelMaterials prepareModel): never culled by their own bounds.
    mesh.castShadow = cast; mesh.receiveShadow = true; mesh.frustumCulled = false;
    return mesh;
  });
}

/**
 * Still props merged (the new world's dressing, R2c perf): every placement of every model baked into place and joined
 * into one mesh per look across all the models (the art lanes share their material presets so parts merge: David,
 * 2026-10-17), so dozens of small props draw in a handful of calls. Each placement keeps its contact shadow. For models
 * that never move, sway or glow on their own.
 */
export function MergedModels({ items, emissiveIntensity }: { items: readonly ModelPlacement[]; emissiveIntensity?: number }) {
  const urls = useMemo(() => [...new Set(items.map(i => i.url))], [items]);
  const gltfs = useGLTF(urls) as unknown as GLTF[];
  const images = useMemo(() => gltfs.reduce((out, gltf) => imageKeys(gltf, out), new Map<THREE.Texture, string>()), [gltfs]);
  const models = useMemo(() => urls.map((url, i) => prepareModel(gltfs[i].scene, url, emissiveIntensity, shadowClassFor(url))), [gltfs, urls, emissiveIntensity]);
  useEffect(() => {
    models.forEach((model, i) => applyModelTextures(model, urls[i]));
    return () => models.forEach(model => disposeModelMaterials(model));
  }, [models, urls]);
  const meshes = useMemo(() => mergeByLook(items.map(({ url, ...p }) => [models[urls.indexOf(url)], matrixOf(p, 1)] as const), images), [models, urls, items, images]);
  useEffect(() => () => meshes.forEach(m => m.geometry.dispose()), [meshes]);
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
      f.meshes.push(im);
      f.local.push(m.matrixWorld.clone());
    });
    return f;
  }, [model, cap]);
  useEffect(() => {
    const key = `${url}|${scale}`;
    flocks.set(key, flock);
    return () => { flocks.delete(key); flock.meshes.forEach(m => m.dispose()); };
  }, [flocks, flock, url, scale]);
  return <>{flock.meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
}
const _copyAt = new THREE.Matrix4(), _part = new THREE.Matrix4();
let _ownShown = true;
function showOwnOne(o: THREE.Object3D) { if ((o as THREE.Mesh).isMesh) o.visible = _ownShown; }
/** A copy's own meshes shown (drawn alone) or hidden (drawn in its flock); its group, and so its contact shadow, stay. */
export function showOwn(group: THREE.Object3D, on: boolean) { _ownShown = on; group.traverse(showOwnOne); }
export const startFlock = (f: Flock) => { f.n = 0; };
/** The copy whose group is `group` (moved this frame) into the flock's next slot. */
export function addToFlock(f: Flock, group: THREE.Object3D) {
  if (!group.parent || f.n >= f.meshes[0]?.instanceMatrix.count) return;
  group.updateMatrix();
  _copyAt.multiplyMatrices(group.parent.matrixWorld, group.matrix);
  for (let k = 0; k < f.meshes.length; k++) f.meshes[k].setMatrixAt(f.n, _part.multiplyMatrices(_copyAt, f.local[k]));
  f.n++;
}
export function endFlock(f: Flock) { for (const m of f.meshes) { m.count = f.n; m.instanceMatrix.needsUpdate = true; } }
