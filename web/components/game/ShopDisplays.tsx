"use client";

/**
 * What the shop shows (lib/game/shopDisplay.ts) on its fixtures (SHOP_SLOTS in lib/game/shopLayout.ts): each item as
 * its own model (its icon's, in its icon's tints), fitted into its slot, standing on it and turned to face the room;
 * long things (rods, nets) laid down along the table; wallpapers and floorings as framed samples in their own texture.
 * The static models on a floor are merged into one mesh per look (MergedItems): a few draws for the whole display.
 */
import { Suspense, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
/** Bounds as it will draw: a character part's skeleton posed first (its bone matrices are empty until it renders). */
function measure(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  o.traverse(c => { const m = c as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.update(); });
  return box.setFromObject(o, true);
}
/** Fit a model into a slot: uniform scale to its box (a thin slot fits by its two big sides), on its floor, centred. */
function fitted(model: THREE.Object3D, s: DisplaySlot, url: string, rotX?: number): THREE.Group {
  const inner = new THREE.Group();
  inner.add(model);
  if (rotX) model.rotation.x = rotX;
  inner.rotation.y = facing(s) + (facesPlusZ(url) ? Math.PI : 0);
  measure(inner).getSize(size);
  // Long things lie down along the slot's long side (a rod or a net on the tools table).
  const lie = s.kind === "tools" && size.y > Math.max(size.x, size.z) * 1.6;
  if (lie) { inner.rotation.z = Math.PI / 2; measure(inner).getSize(size); }
  // Fit: a laid-down tool by its length; a thin slot (a garment face-out) by its two big sides; else all three.
  const dims = s.size, got = [size.x, size.y, size.z];
  const axes = lie ? [0] : dims.filter(v => v >= 0.15).length >= 2 ? [0, 1, 2].filter(i => dims[i] >= 0.15) : [0, 1, 2];
  const k = Math.min(...axes.map(i => dims[i] / Math.max(got[i], 1e-4)));
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(k);
  measure(outer).getCenter(mid);
  // On the rail a garment hangs from its hanger (its top at the slot's top); everything else stands on its slot.
  const y = s.fixture === "rail" ? s.at[1] + s.size[1] - box.max.y : s.at[1] - box.min.y;
  outer.position.set(s.at[0] - mid.x, y, s.at[2] - mid.z);
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

/** A material's look, for merging: two materials that draw alike share a merged mesh. */
const lookKey = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial;
  return [m.name, s.color?.getHexString(), s.map?.uuid, s.emissiveMap?.uuid, s.vertexColors, m.transparent, m.opacity, s.roughness, s.metalness, m.side, m.userData.lookClass].join("|");
};
/** The geometry's attribute layout (mergeGeometries needs it the same). */
const layoutKey = (g: THREE.BufferGeometry) => Object.entries(g.attributes).map(([n, a]) => `${n}:${a.itemSize}:${(a as THREE.BufferAttribute).array.constructor.name}:${a.normalized}`).sort().join(",") + `|${g.index ? "i" : "n"}`;

/**
 * The static models on a floor, merged (the perf: each item is several meshes, each a draw, twice with shadows): every
 * item fitted to its slot as one at a time would be, then its meshes baked into place and joined into one mesh per
 * look. Character parts (skinned) and finishes draw on their own.
 */
function MergedItems({ items }: { items: { item: ShopDisplayItem; s: DisplaySlot }[] }) {
  const urls = useMemo(() => [...new Set(items.map(x => x.item.spec.url))], [items]);
  const gltfs = useGLTF(urls) as unknown as { scene: THREE.Object3D }[];
  const meshes = useMemo(() => {
    const groups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; shadows: boolean }>();
    const loose: THREE.Object3D[] = [];
    for (const { item, s } of items) {
      const model = prepareModel(gltfs[urls.indexOf(item.spec.url)].scene, item.spec.url);
      tint(model, item.spec.tints);
      const outer = fitted(model, s, item.spec.url, item.spec.rotX);
      outer.updateMatrixWorld(true);
      outer.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible || mesh.userData.casterOnly) return;
        if (Array.isArray(mesh.material) || mesh.geometry.morphAttributes.position) { const c = mesh.clone(); c.applyMatrix4(mesh.matrixWorld); loose.push(c); return; }
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
        const key = `${lookKey(mesh.material)}#${layoutKey(g)}`;
        const group = groups.get(key) ?? { material: mesh.material, geometries: [], shadows: mesh.castShadow };
        group.geometries.push(g);
        groups.set(key, group);
      });
    }
    const out = [...groups.values()].map(({ material, geometries }) => {
      const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
      const mesh = new THREE.Mesh(merged ?? geometries[0], material);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      return mesh;
    });
    return [...out, ...loose];
  }, [gltfs, urls, items]);
  return <>{meshes.map((m, i) => <primitive key={i} object={m} />)}</>;
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

/** The items on one floor (upstairs, y is the floor's height up): the static models merged, the rest one by one. */
export default function ShopDisplays({ items, level, except = [] }: { items: ShopDisplayItem[]; level: 0 | 1; except?: readonly string[] }) {
  const placed = useMemo(() => items.flatMap(item => {
    const s = SLOT.get(item.slot);
    return s && s.level === level && !except.includes(s.id) ? [{ item, s }] : [];
  }), [items, level, except]);
  const finish = (x: { item: ShopDisplayItem }) => x.item.spec.view === "roll" || x.item.spec.view === "tile";
  const merged = useMemo(() => placed.filter(x => !finish(x) && !x.item.spec.skinned), [placed]);
  return <group position={[0, level * SHOP_FLOOR_HEIGHT, 0]}>
    <Suspense fallback={null}><MergedItems items={merged} /></Suspense>
    {placed.filter(x => finish(x) || x.item.spec.skinned).map(({ item, s }) => <Suspense key={item.slot} fallback={null}>
      {finish({ item }) ? <FinishItem item={item} s={s} /> : <ModelItem item={item} s={s} />}
    </Suspense>)}
  </group>;
}
