"use client";

/**
 * A shop item large and turning (the shop overlay's detail view): its icon's 3D model, in its icon's tints (a character
 * part posed on its rig, a long tool laid on the diagonal as its icon is), fitted to the stage. Where it has no model
 * (a wallpaper, a flooring) its picture shows instead, large, with the pixel finish.
 */
import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { prepareModel } from "@/lib/game/modelMaterials";
import type { IconSpec } from "@/lib/icons/manifest";
import PixelImage from "./PixelImage";
import TurnStage from "./TurnStage";

/** The model's materials tinted as its icon is (a "none" tint hides that part: the hair under a hat). */
function tint(model: THREE.Object3D, tints?: Record<string, string>) {
  if (!tints) return;
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material) => {
      const t = Object.entries(tints).find(([name]) => m.name === name || m.name.endsWith(`_${name}`))?.[1];
      if (!t) return m;
      if (t === "none") { mesh.visible = false; return m; }
      const c = m.clone() as THREE.MeshStandardMaterial;
      c.color?.set(t);
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}

const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
/** Bounds as drawn: a character part's skeleton posed first. */
function measure(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  o.traverse(c => { const m = c as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.update(); });
  return box.setFromObject(o, true);
}

/**
 * A fish lies on its side as it swims (David, 2026-10-18: "lie sideways, swimming, head to one side"): its length along
 * the stage's x, its depth up the y, its thin side toward you, whatever way its model was authored (the old dump's
 * fish stand nose-down). The slow turn then spins it round the vertical.
 */
function laySideways(inner: THREE.Group) {
  measure(inner).getSize(size);
  if (size.y >= size.x && size.y >= size.z) inner.rotation.z += Math.PI / 2;
  else if (size.z >= size.x && size.z >= size.y) inner.rotation.y += Math.PI / 2;
  measure(inner).getSize(size);
  if (size.z > size.y) inner.rotation.x += Math.PI / 2;
}

/** The model, centred on the stage's middle and scaled to `span` across its biggest side. */
export function FittedModel({ spec, span = 1.7 }: { spec: IconSpec; span?: number }) {
  const { scene } = useGLTF(spec.url);
  const object = useMemo(() => {
    const model = spec.skinned ? cloneSkinned(scene) : prepareModel(scene, spec.url);
    tint(model, spec.tints);
    if (spec.rotX) model.rotation.x = spec.rotX;
    const inner = new THREE.Group();
    inner.add(model);
    // Character parts face +z, everything else −z: turn so the stage starts on its front.
    if (!spec.skinned) inner.rotation.y = Math.PI;
    if (spec.view === "diagonal") inner.rotation.z = -Math.PI / 4;
    if (spec.view === "profile") laySideways(inner);
    measure(inner).getSize(size);
    box.getCenter(mid);
    const k = span / Math.max(size.x, size.y, size.z, 1e-3);
    const outer = new THREE.Group();
    inner.position.set(-mid.x, -mid.y, -mid.z);
    outer.add(inner);
    outer.scale.setScalar(k);
    outer.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
    return outer;
  }, [scene, spec, span]);
  return <primitive object={object} />;
}

export default function ItemViewer({ spec, picture, name, className, pictureClassName }: {
  /** Its model, or null where it has none. */
  spec: IconSpec | null;
  /** Its picture (the icon), shown large where there's no model. */
  picture: string; name: string; className?: string; pictureClassName?: string;
}) {
  if (!spec) return <div className={className}><PixelImage src={picture} px={72} className={pictureClassName} label={name} /></div>;
  // Something seen from above in its icon (a butterfly, a dragonfly with its wings spread) leans toward you more, so
  // its wings read as it turns rather than edge on.
  return <TurnStage className={className} label={name} restPitch={spec.view === "above" ? 0.62 : undefined}><Suspense fallback={null}><FittedModel spec={spec} /></Suspense></TurnStage>;
}
