"use client";

/**
 * /lab/icons: the item icon renderer (row 281, specs/game-ui.md §4). Dev-only (the lab 404s in production).
 * One three.js stage for every icon in lib/icons/manifest.ts: matte materials (roughness 1, no metal, textures and
 * vertex colours kept), one warm light rig, an orthographic camera at the kind's fixed angle, framed tight to the
 * subject, on a transparent 256 px canvas. scripts/render-icons.mjs drives it (window.__icons) and writes
 * public/assets/icons/<key>.webp. The page shows the sheet it rendered last.
 */
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { iconSpecs, type IconSpec } from "@/lib/icons/manifest";
import { CATALOGUE, EVENT_ITEMS, OWNERSHIP_ITEMS } from "@/lib/wallet/catalogue";
import { CRAFTED_ITEMS, RECIPE_CARDS } from "@/lib/crafting/recipes";
import { buildFishStage } from "@/components/lab/FishPreview";
import { prepareModel } from "@/lib/game/modelMaterials";

const SIZE = 256, PAD = 0.08;
const SPECS = iconSpecs([...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS, ...CRAFTED_ITEMS, ...RECIPE_CARDS]);
const deg = THREE.MathUtils.degToRad;
/** From the subject toward the camera, per view (three.js: the models' fronts face +Z). */
const VIEW: Record<IconSpec["view"], { az: number; el: number }> = {
  "three-quarter": { az: 30, el: 24 }, profile: { az: 0, el: 4 }, above: { az: 20, el: 55 }, side: { az: 68, el: 26 }, diagonal: { az: 14, el: 16 },
  front: { az: 18, el: 8 }, roll: { az: 30, el: 26 }, tile: { az: 30, el: 32 },
};

function stage() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff8ec", "#b9ad94", 1.7));
  const key = new THREE.DirectionalLight("#fff3df", 2.3);
  key.position.set(-2.5, 4, 3.5);
  const fill = new THREE.DirectionalLight("#e4ecff", 0.55);
  fill.position.set(3, 1.2, 2);
  const rim = new THREE.DirectionalLight("#ffffff", 0.45);
  rim.position.set(0.5, 2, -4);
  scene.add(key, fill, rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  return { renderer, scene, camera };
}

/** Matte: the same colour, texture and vertex colours, no shine, no metal, no shader hacks. */
function matte(model: THREE.Object3D, tints?: Record<string, string>) {
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.casterOnly || !mesh.visible) { mesh.visible = false; return; }
    const swap = (m: THREE.Material) => {
      const src = m as THREE.MeshStandardMaterial;
      if (/Decal/i.test(src.name)) { mesh.visible = false; return src; }
      const tint = tints && Object.entries(tints).find(([name]) => src.name === name || src.name.endsWith(`_${name}`))?.[1];
      if (tint === "none") { mesh.visible = false; return src; }
      return new THREE.MeshStandardMaterial({
        name: src.name, map: src.map ?? null, color: tint ? new THREE.Color(tint) : src.color?.clone() ?? new THREE.Color("#ffffff"),
        // Our models carry their light gradient in vertex colours; the old dump's textured ones carry masks there (black fish).
        vertexColors: src.vertexColors && !src.map, roughness: 1, metalness: 0, side: THREE.DoubleSide,
        transparent: src.transparent && src.opacity < 1, opacity: src.opacity, alphaTest: src.alphaTest || (src.transparent ? 0.4 : 0),
        emissive: src.emissive?.clone() ?? new THREE.Color(0), emissiveMap: src.emissiveMap ?? null, emissiveIntensity: src.emissiveMap ? 0.6 : 0,
      });
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    mesh.frustumCulled = false;
  });
  return model;
}

/** A wallpaper roll or a flooring tile, wearing the finish's texture. */
function finish(texture: THREE.Texture, view: "roll" | "tile") {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const g = new THREE.Group();
  const edge = new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 1 });
  if (view === "roll") {
    const map = texture.clone(); map.repeat.set(2, 1.4); map.needsUpdate = true;
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 28, 1, false), [new THREE.MeshStandardMaterial({ map, roughness: 1 }), edge, edge]);
    roll.rotation.z = Math.PI / 2;
    const flapMap = texture.clone(); flapMap.repeat.set(1.2, 0.8); flapMap.needsUpdate = true;
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: flapMap, roughness: 1, side: THREE.DoubleSide }));
    flap.rotation.x = -Math.PI / 2 + 0.08;
    flap.position.set(0, -0.3, 0.4);
    g.add(roll, flap);
  } else {
    const map = texture.clone(); map.repeat.set(1, 1); map.needsUpdate = true;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), [edge, edge, new THREE.MeshStandardMaterial({ map, roughness: 1 }), edge, edge, edge]);
    g.add(tile);
  }
  return g;
}

/** Point the camera along the view and frame the subject's projected vertices, square, with a little room. */
function frame(camera: THREE.OrthographicCamera, subject: THREE.Object3D, view: IconSpec["view"]) {
  const { az, el } = VIEW[view];
  const dir = new THREE.Vector3(Math.sin(deg(az)) * Math.cos(deg(el)), Math.sin(deg(el)), Math.cos(deg(az)) * Math.cos(deg(el)));
  subject.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(subject, true), centre = box.getCenter(new THREE.Vector3());
  camera.position.copy(centre).addScaledVector(dir, 20);
  camera.up.set(0, 1, 0);
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse, v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  subject.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  });
  const half = Math.max(x1 - x0, y1 - y0) / 2 / (1 - 2 * PAD), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  Object.assign(camera, { left: cx - half, right: cx + half, top: cy + half, bottom: cy - half, near: 0.01, far: 60 });
  camera.updateProjectionMatrix();
}

const loader = new GLTFLoader();
const textures = new THREE.TextureLoader();
async function subjectFor(spec: IconSpec): Promise<THREE.Object3D> {
  if (spec.view === "roll" || spec.view === "tile") return finish(await textures.loadAsync(spec.url), spec.view);
  const { scene } = await loader.loadAsync(spec.url);
  if (spec.view === "profile") {
    // The fish stage (FishPreview): calibrated, normalised, side-on; the old dump's fish come out nose-down.
    const g = new THREE.Group();
    g.add(buildFishStage(scene, !!spec.raw, 1.6));
    g.rotation.z = spec.raw ? Math.PI : 0;
    return matte(g);
  }
  const model = spec.skinned ? cloneSkinned(scene) : prepareModel(scene, spec.url);
  const g = new THREE.Group();
  g.add(matte(model, spec.tints));
  // Long things lie on the diagonal, the grip at the bottom left (ACNH's tool icons); a model authored lying down stands up.
  if (spec.view === "diagonal") g.rotation.z = -Math.PI / 4;
  if (spec.rotX) model.rotation.x = spec.rotX;
  return g;
}

declare global { interface Window { __icons?: { keys: string[]; render: (key: string) => Promise<string> } } }

export default function IconsLab() {
  const [shown, setShown] = useState<{ key: string; src: string }[]>([]);
  useEffect(() => {
    const { renderer, scene, camera } = stage();
    const render = async (key: string) => {
      const spec = SPECS.find(s => s.key === key);
      if (!spec) throw new Error(`no icon spec for ${key}`);
      const subject = await subjectFor(spec);
      scene.add(subject);
      frame(camera, subject, spec.view);
      renderer.render(scene, camera);
      // WebP with alpha: the same look at an eighth of a PNG's size.
      const src = renderer.domElement.toDataURL("image/webp", 0.9);
      scene.remove(subject);
      setShown(list => [...list.filter(i => i.key !== key), { key, src }]);
      return src;
    };
    window.__icons = { keys: SPECS.map(s => s.key), render };
    return () => { delete window.__icons; renderer.dispose(); };
  }, []);
  return <main style={{ padding: "56px 16px 16px" }}>
    <p>{SPECS.length} icons · {shown.length} rendered this visit · run <code>node scripts/render-icons.mjs</code></p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 96px)", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {shown.map(i => <figure key={i.key} style={{ margin: 0, background: "#f3efe0", borderRadius: 8 }}><img src={i.src} alt={i.key} width={96} height={96} /><figcaption style={{ fontSize: 9, color: "#333", textAlign: "center" }}>{i.key}</figcaption></figure>)}
    </div>
  </main>;
}
