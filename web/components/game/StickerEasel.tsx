"use client";

/**
 * The GENESIS sticker on the merch counter (lib/game/shopLayout.ts SHOP_STICKER): a small wooden easel under the totes
 * holding both variants side by side, leaning back, so their holographic foil (GenesisSticker) shifts as you walk past.
 * The easel is one merged mesh (one draw). Lite graphics shows the two variants' sprites, their sheen baked in.
 */
import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SHOP_STICKER } from "@/lib/game/shopLayout";
import GenesisSticker, { STICKER_SIZE, STICKER_VARIANTS } from "./GenesisSticker";

const W = 0.72, LEDGE = 0.035;

function easelGeometry(lean: number, h: number): THREE.BufferGeometry {
  const box = (w: number, hh: number, d: number, x: number, y: number, z: number, rx = 0) => {
    const g = new THREE.BoxGeometry(w, hh, d);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    return g;
  };
  const back = box(W, h, 0.014, 0, h / 2 * Math.cos(lean) + 0.012, -(h / 2) * Math.sin(lean) - 0.025, -lean);
  return mergeGeometries([
    box(W + 0.04, 0.02, 0.09, 0, 0.01, 0),                                   // the foot
    box(W, LEDGE, 0.014, 0, 0.02 + LEDGE / 2, 0.035),                         // the lip the cards stand on
    back,
    box(0.03, h * 0.9, 0.03, 0, h * 0.45, -0.07 - h * 0.25, lean * 1.6),      // the strut behind
  ])!;
}

export default function StickerEasel({ lite }: { lite: boolean }) {
  const { at, scale, lean } = SHOP_STICKER;
  const [cw, ch] = [STICKER_SIZE[0] * scale, STICKER_SIZE[1] * scale];
  const geo = useMemo(() => easelGeometry(lean, ch + 0.05), [lean, ch]);
  const sprites = useMemo(() => lite ? STICKER_VARIANTS.map(v => {
    const t = new THREE.TextureLoader().load(v.sprite);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    return t;
  }) : [], [lite]);
  const y = 0.02 + LEDGE + 0.004 + ch / 2 * Math.cos(lean), z = 0.012 - (ch / 2) * Math.sin(lean);   // standing on the lip
  return <group position={at} rotation={[0, Math.PI, 0]}>
    <mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial color="#b98d5c" roughness={0.85} /></mesh>
    {STICKER_VARIANTS.map((v, i) => {
      const x = (i === 0 ? -1 : 1) * (cw / 2 + 0.015);
      return lite
        ? <mesh key={v.id} position={[x, y, z + 0.004]} rotation={[-lean, 0, 0]}>
            <planeGeometry args={[cw, ch]} /><meshBasicMaterial map={sprites[i]} transparent alphaTest={0.3} />
          </mesh>
        : <Suspense key={v.id} fallback={null}><GenesisSticker variant={v.id} scale={scale} position={[x, y, z]} rotation={[-lean, 0, 0]} /></Suspense>;
    })}
  </group>;
}
