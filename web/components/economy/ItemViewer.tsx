"use client";

/**
 * A shop item large and turning (the shop overlay's detail view): its icon's 3D model, in its icon's tints (a character
 * part posed on its rig, a long tool laid on the diagonal as its icon is), fitted to the stage. Where it has no model
 * (a wallpaper, a flooring) its picture shows instead, large, with the pixel finish.
 */
import { Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { prepareModel } from "@/lib/game/modelMaterials";
import { rodTip } from "@/lib/game/rodTip";
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
 * The model, centred on the stage's middle and scaled to `span` across its biggest side. `hang` draws things hanging
 * from its top (a rod's tip): placed at the tip, in stage units, with down still down as it turns.
 */
export function FittedModel({ spec, span = 1.7, hang }: { spec: IconSpec; span?: number; hang?: ReactNode }) {
  const { scene } = useGLTF(spec.url);
  const hangs = hang !== undefined;
  const object = useMemo(() => {
    const model = spec.skinned ? cloneSkinned(scene) : prepareModel(scene, spec.url);
    tint(model, spec.tints);
    if (spec.rotX) model.rotation.x = spec.rotX;
    const inner = new THREE.Group();
    inner.add(model);
    // Character parts face +z, everything else −z: turn so the stage starts on its front.
    if (!spec.skinned) inner.rotation.y = Math.PI;
    if (spec.view === "diagonal") inner.rotation.z = -Math.PI / 4;
    measure(inner).getSize(size);
    box.getCenter(mid);
    const k = span / Math.max(size.x, size.y, size.z, 1e-3);
    const outer = new THREE.Group();
    inner.position.set(-mid.x, -mid.y, -mid.z);
    outer.add(inner);
    outer.scale.setScalar(k);
    outer.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
    outer.updateMatrixWorld(true);
    const tip = hangs ? rodTip(model).applyMatrix4(model.matrix).applyMatrix4(inner.matrix) : null;
    return { outer, tip, k };
  }, [scene, spec, span, hangs]);
  return <primitive object={object.outer}>{hang && object.tip && <group position={object.tip} scale={1 / object.k}>{hang}</group>}</primitive>;
}

export default function ItemViewer({ spec, picture, name, className, pictureClassName }: {
  /** Its model, or null where it has none. */
  spec: IconSpec | null;
  /** Its picture (the icon), shown large where there's no model. */
  picture: string; name: string; className?: string; pictureClassName?: string;
}) {
  if (!spec) return <div className={className}><PixelImage src={picture} px={72} className={pictureClassName} label={name} /></div>;
  return <TurnStage className={className} label={name}><Suspense fallback={null}><FittedModel spec={spec} /></Suspense></TurnStage>;
}
