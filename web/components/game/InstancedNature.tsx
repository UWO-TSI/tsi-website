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
 * A model with a far version (lib/game/natureLod.ts: the bushes) draws each
 * placement near or far by its distance from the camera: two sets of meshes,
 * the placements re-packed between them only when one crosses the line.
 */

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
import { lodOf, updateNear } from "@/lib/game/natureLod";
import { addContact, modelContact } from "./ContactShadows";

export interface NaturePlacement {
  position: [number, number, number];
  rotation?: number; // y-axis radians
  scale?: number;
}

const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const matrixOf = (p: NaturePlacement, base: number) =>
  new THREE.Matrix4().compose(_p.set(...p.position), _q.setFromAxisAngle(_up, p.rotation ?? 0), _s.setScalar((p.scale ?? 1) * base));

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

/** One contact shadow per placement, from the model's own bounds (what GLBProp registers per clone). */
function useContacts(model: THREE.Object3D, url: string, cls: ReturnType<typeof shadowClassFor>, matrices: readonly THREE.Matrix4[]) {
  const world = useThree((s) => s.scene);
  const contact = useMemo(() => modelContact(model, url, cls), [model, url, cls]);
  const anchors = useMemo(() => matrices.map((matrix) => {
    const o = new THREE.Object3D();
    o.matrixAutoUpdate = false;
    o.matrix.copy(matrix);
    return o;
  }), [matrices]);
  useEffect(() => {
    if (!contact) return;
    const removals = anchors.map((a) => addContact(world, a, contact));
    return () => removals.forEach((remove) => remove());
  }, [world, anchors, contact]);
  return anchors;
}

/** Render N placements of one GLB: one InstancedMesh per sub-mesh, all sharing the placements. */
export default function InstancedGLB({ url, placements, baseScale = 1, emissiveIntensity }: InstancedGLBProps) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, baseScale)), [placements, baseScale]);
  const { model, meshes, cls } = useInstanced(url, matrices, emissiveIntensity);
  const anchors = useContacts(model, url, cls, matrices);
  return <>
    {meshes.map((m, i) => <primitive key={i} object={m} />)}
    {anchors.map((a, i) => <primitive key={`contact-${i}`} object={a} />)}
  </>;
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
 * A GLB with a far model (lib/game/natureLod.ts, the bushes): each placement draws the near model within LOD1_DISTANCE
 * of the camera and the far one past it, re-sorted only when one crosses. Contact shadows come from the near model.
 */
function InstancedLodGLB({ url, far, placements }: { url: string; far: string; placements: readonly NaturePlacement[] }) {
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, 1)), [placements]);
  const hi = useInstanced(url, matrices), lo = useInstanced(far, matrices);
  const anchors = useContacts(hi.model, url, hi.cls, matrices);
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
  return <>
    {[...hi.meshes, ...lo.meshes].map((m, i) => <primitive key={i} object={m} />)}
    {anchors.map((a, i) => <primitive key={`contact-${i}`} object={a} />)}
  </>;
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
