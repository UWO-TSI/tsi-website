"use client";

/**
 * Real club merch in the shop (specs/interiors/shop.md): the item's 3D model in the middle, turning slowly, with the
 * game's pixel finish (drawn small and scaled up without smoothing, as the world's pixel mode is). The model is the
 * item's icon model (lib/icons/manifest.ts): placeholders until David sends the merch photos.
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { iconKey, iconSpecs } from "@/lib/icons/manifest";
import { prepareModel } from "@/lib/game/modelMaterials";
import { CATALOGUE } from "@/lib/wallet/catalogue";
import s from "./economy.module.css";

/** How fine the pixels are: the canvas draws at this share of its size (the world's pixel mode draws at 0.5). */
export const MERCH_PIXEL = 0.3;
const MERCH_ROWS = CATALOGUE.filter(c => c.category === "merch");
let urls: Map<string, string> | null = null;
/** The model a merch item is shown as (its icon's), or null. */
export function merchModel(slug: string): string | null {
  urls ??= new Map(iconSpecs(MERCH_ROWS).filter(sp => sp.key.startsWith("merch-")).map(sp => [sp.key, sp.url]));
  const row = MERCH_ROWS.find(c => c.slug === slug);
  return (row && urls.get(iconKey(row))) ?? null;
}

const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3();
function Turning({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const model = prepareModel(scene, url);
    box.setFromObject(model, true).getSize(size);
    box.getCenter(mid);
    const k = 1.5 / Math.max(size.x, size.y, size.z, 1e-3);
    const g = new THREE.Group();
    model.position.set(-mid.x, -mid.y, -mid.z);
    g.add(model);
    g.scale.setScalar(k);
    return g;
  }, [scene, url]);
  const turn = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (turn.current) turn.current.rotation.y += Math.min(dt, 0.1) * 0.7; });
  return <group ref={turn} rotation={[0.12, 0.6, 0]}><primitive object={object} /></group>;
}

export default function MerchViewer({ slug, name }: { slug: string; name: string }) {
  const url = merchModel(slug);
  if (!url) return null;
  return <figure className={s.merchViewer} data-testid="merch-viewer">
    <Canvas className={s.merchCanvas} dpr={MERCH_PIXEL} camera={{ position: [0, 0.25, 3.1], fov: 34 }} gl={{ antialias: false, alpha: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#fff6e8", "#b9c4c8", 0.6]} />
      <directionalLight position={[2.5, 3, 2]} intensity={2.2} />
      <directionalLight position={[-2, 1, -1.5]} intensity={0.5} />
      <Suspense fallback={null}><Turning url={url} /></Suspense>
    </Canvas>
    <figcaption>{name}</figcaption>
  </figure>;
}
