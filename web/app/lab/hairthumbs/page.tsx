"use client";

/**
 * /lab/hairthumbs: bakes the creator's hair tiles (head-v10, row 311; David: "it lags whenever changing hair color").
 * The creator's own thumbnail baker (CreatorStage ThumbBaker: the creator's lights, front view, the real Character) draws
 * every whole hairstyle once on the default head in its own colours (round 2, David: hair as Roblox draws it); scripts/bake-hair-thumbs.mjs
 * reads them from window.__hairThumbs and writes public/assets/characters/v6/hair/thumbs/<id>.webp, which the creator
 * shows as plain pictures (CreatorControls PartArt). Dev-only via the lab layout.
 */
import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ThumbBaker, thumbJob, useThumb } from "@/components/game/character/CreatorStage";
import { DEFAULT_LOOK, NATURAL_HAIR, PARTS, type CharacterLook } from "@/lib/game/character/look";

/** Each tile in the hairstyle's own colours (NATURAL_HAIR, the default look's): what the shop sells. */
const OWN: CharacterLook = { ...DEFAULT_LOOK, hair: NATURAL_HAIR };
const IDS = PARTS.filter(p => p.slot === "back" && p.full).map(p => p.id);
const done: Record<string, string> = {};

function Thumb({ id }: { id: string }) {
  const src = useThumb(thumbJob(id, OWN));
  useEffect(() => {
    if (!src) return;
    done[id] = src;
    if (IDS.every(k => done[k])) (window as unknown as { __hairThumbs?: Record<string, string> }).__hairThumbs = { ...done };
  }, [id, src]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={id} title={id} width={80} height={80} style={{ background: "#f6efe0", borderRadius: 16 }} /> : null;
}

export default function HairThumbs() {
  return <main style={{ padding: "56px 16px 16px" }}>
    <div style={{ width: 320, height: 320 }}>
      <Canvas gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} dpr={1} camera={{ fov: 25, near: 0.05, far: 30 }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <ThumbBaker />
      </Canvas>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{IDS.map(id => <Thumb key={id} id={id} />)}</div>
  </main>;
}
