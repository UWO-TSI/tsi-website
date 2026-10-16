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
 */

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { shadowClassFor } from "@/lib/game/shadows";
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

/** Render N placements of one GLB: one InstancedMesh per sub-mesh, all sharing the placements. */
export default function InstancedGLB({ url, placements, baseScale = 1, emissiveIntensity }: InstancedGLBProps) {
  const { scene } = useGLTF(url);
  const world = useThree((s) => s.scene);
  const cls = shadowClassFor(url);
  const model = useMemo(() => prepareModel(scene, url, emissiveIntensity, cls), [scene, url, emissiveIntensity, cls]);
  useEffect(() => {
    applyModelTextures(model, url);
    return () => disposeModelMaterials(model);
  }, [model, url]);
  const matrices = useMemo(() => placements.map((p) => matrixOf(p, baseScale)), [placements, baseScale]);
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    model.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !m.geometry || !matrices.length) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
      matrices.forEach((matrix, i) => im.setMatrixAt(i, matrix));
      // The shadow role prepareModel gave this sub-mesh (caster-only hulls stay hidden until SunShadows draws them).
      Object.assign(im, { name: m.name, castShadow: m.castShadow, receiveShadow: m.receiveShadow, visible: m.visible, frustumCulled: false, customDepthMaterial: m.customDepthMaterial });
      im.userData = { ...m.userData };
      out.push(im);
    });
    return out;
  }, [model, matrices]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  // One contact shadow per instance, from the model's own bounds (what GLBProp registers per clone).
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
  return <>
    {meshes.map((m, i) => <primitive key={i} object={m} />)}
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
  return <>{groups.map(([url, placements]) => <Suspense key={url} fallback={null}><InstancedGLB url={url} placements={placements} /></Suspense>)}</>;
}
