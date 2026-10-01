"use client";

/**
 * The café's hand-modeled GLBs (art/cafe/build_cafe.py) as authored: every
 * instance shares the cached materials (one program per material however many
 * chairs), glass and steel take the look's classes (lib/game/modelMaterials),
 * and single-sided faces stay single-sided (the ceiling and its lights face
 * down, so the game camera looks past them into the room).
 */
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import type { ContactSize } from "@/lib/game/shadows";
import { addContact } from "../ContactShadows";

export const cafeUrl = (name: string) => `/assets/game/cafe/${name}.glb`;
const prepared = new WeakSet<THREE.Object3D>();

function prepare(scene: THREE.Object3D, url: string) {
  if (prepared.has(scene)) return;
  prepared.add(scene);
  tagLookClasses(scene, url);
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m.transparent) m.depthWrite = false;
  });
}

/** A clone of a café GLB (or of one named node in it, e.g. a furniture set in cafe-kit) sharing its materials. */
export function useCafeModel(file: string, node?: string): THREE.Object3D {
  const url = cafeUrl(file);
  const { scene } = useGLTF(url);
  return useMemo(() => {
    prepare(scene, url);
    const part = node ? scene.getObjectByName(node) : scene;
    if (!part) throw new Error(`${file}.glb has no ${node}`);
    const clone = part.clone(true);
    clone.position.set(0, 0, 0);
    return clone;
  }, [scene, url, file, node]);
}

/** One café model (or kit node) placed in the room; `contact` grounds it with a soft contact shadow (in its own frame). */
export function CafeModel({ name, node, position = [0, 0, 0], yaw = 0, contact }: { name: string; node?: string; position?: [number, number, number]; yaw?: number; contact?: ContactSize }) {
  const model = useCafeModel(name, node);
  const scene = useThree(s => s.scene);
  useEffect(() => (contact ? addContact(scene, model, contact) : undefined), [scene, model, contact]);
  return <primitive object={model} position={position} rotation={[0, yaw, 0]} />;
}

export function preloadCafe(names: string[]) {
  for (const n of names) useGLTF.preload(cafeUrl(n));
}
