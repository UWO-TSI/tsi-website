"use client";

/**
 * What the shop shows (lib/game/shopDisplay.ts) on its fixtures (SHOP_SLOTS in lib/game/shopLayout.ts): each item as
 * its own model (its icon's, in its icon's tints), fitted into its slot, standing on it and turned to face the room;
 * long things (rods, nets) laid down along the table; wallpapers and floorings as framed samples in their own texture.
 */
import { Suspense, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { prepareModel } from "@/lib/game/modelMaterials";
import { SHOP_FLOOR_HEIGHT, SHOP_SLOTS, type DisplaySlot } from "@/lib/game/shopLayout";
import type { ShopDisplayItem } from "@/lib/game/shopDisplay";

const SLOT = new Map(SHOP_SLOTS.map(s => [s.id, s]));
/** Character parts face +z; the furniture and our item models face −z. */
const facesPlusZ = (url: string) => url.startsWith("/assets/characters/");
/** Which way a slot's item faces: away from the wall it stands against (the side walls), else toward the door (−z). */
function facing(s: DisplaySlot): number {
  if (s.at[0] > 5) return Math.PI / 2;     // the +x wall: face −x
  if (s.at[0] < -5) return -Math.PI / 2;   // the −x wall: face +x
  return 0;
}

/** The model's materials cloned and tinted as its icon is (a "none" tint hides that part: hair under a hat). */
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
/** Fit a model into a slot: uniform scale to its box (a thin slot fits by its two big sides), on its floor, centred. */
function fitted(model: THREE.Object3D, s: DisplaySlot, url: string, rotX?: number): THREE.Group {
  const inner = new THREE.Group();
  inner.add(model);
  if (rotX) model.rotation.x = rotX;
  inner.rotation.y = facing(s) + (facesPlusZ(url) ? Math.PI : 0);
  inner.updateMatrixWorld(true);
  box.setFromObject(inner, true).getSize(size);
  // Long things lie down along the slot's long side (a rod or a net on the tools table).
  const lie = s.kind === "tools" && size.y > Math.max(size.x, size.z) * 1.6;
  if (lie) { inner.rotation.z = Math.PI / 2; inner.updateMatrixWorld(true); box.setFromObject(inner, true).getSize(size); }
  // Fit: a laid-down tool by its length; a thin slot (a garment face-out) by its two big sides; else all three.
  const dims = s.size, got = [size.x, size.y, size.z];
  const axes = lie ? [0] : dims.filter(v => v >= 0.15).length >= 2 ? [0, 1, 2].filter(i => dims[i] >= 0.15) : [0, 1, 2];
  const k = Math.min(...axes.map(i => dims[i] / Math.max(got[i], 1e-4)));
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(k);
  outer.updateMatrixWorld(true);
  box.setFromObject(outer, true).getCenter(mid);
  const minY = box.min.y;
  outer.position.set(s.at[0] - mid.x, s.at[1] - minY, s.at[2] - mid.z);
  return outer;
}

function ModelItem({ item, s }: { item: ShopDisplayItem; s: DisplaySlot }) {
  const { scene } = useGLTF(item.spec.url);
  const object = useMemo(() => {
    const model = item.spec.skinned ? cloneSkinned(scene) : prepareModel(scene, item.spec.url);
    tint(model, item.spec.tints);
    model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    return fitted(model, s, item.spec.url, item.spec.rotX);
  }, [scene, item, s]);
  return <primitive object={object} />;
}

const FRAME = new THREE.MeshStandardMaterial({ color: "#3b4046", roughness: 0.4, metalness: 0.75 });
/** A wallpaper on a framed panel on the wall, or a flooring tile on the dais, in its own texture. */
function FinishItem({ item, s }: { item: ShopDisplayItem; s: DisplaySlot }) {
  const texture = useTexture(item.spec.url);
  const material = useMemo(() => {
    const map = texture.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    const wall = item.spec.view === "roll";
    map.repeat.set(wall ? s.size[0] / 0.7 : s.size[0] / 0.7, wall ? s.size[1] / 0.7 : s.size[2] / 0.7);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
  }, [texture, item, s]);
  const [x, y, z] = s.at, [sx, sy, sz] = s.size;
  if (item.spec.view === "roll") return <group position={[x, y + sy / 2, z]}>
    <mesh material={FRAME} position={[0, 0, 0.012]} castShadow receiveShadow><boxGeometry args={[sx + 0.06, sy + 0.06, 0.02]} /></mesh>
    <mesh material={material} position={[0, 0, -0.002]} rotation={[0, Math.PI, 0]} receiveShadow><planeGeometry args={[sx, sy]} /></mesh>
  </group>;
  return <mesh material={material} position={[x, y + 0.006, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[sx, sz]} /></mesh>;
}

/** The items on one floor (upstairs, y is the floor's height up). */
export default function ShopDisplays({ items, level }: { items: ShopDisplayItem[]; level: 0 | 1 }) {
  return <group position={[0, level * SHOP_FLOOR_HEIGHT, 0]}>
    {items.map(item => {
      const s = SLOT.get(item.slot);
      if (!s || s.level !== level) return null;
      return <Suspense key={item.slot} fallback={null}>
        {item.spec.view === "roll" || item.spec.view === "tile" ? <FinishItem item={item} s={s} /> : <ModelItem item={item} s={s} />}
      </Suspense>;
    })}
  </group>;
}
