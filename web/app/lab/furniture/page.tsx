"use client";

/**
 * /lab/furniture — furniture recolor bench (collab track, 2026-07-25).
 * Dev-only. Base vs tinted side by side + a material-slot inspector, so
 * David can rule palettes per piece without reading GLBs.
 * Params: ?piece=<basename> (default counter-register)
 *         &palette=<PRESETS key>  — preview a named preset
 *         &tint=slot:RRGGBB,slot:RRGGBB — ad-hoc slots ("*" = all)
 * Rulings land in lib/game/furniturePalettes.ts PIECE_TINTS.
 */

import { Suspense, useMemo, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Piece } from "@/components/game/interiorShared";
import { PRESETS, PIECE_TINTS, type Tint } from "@/lib/game/furniturePalettes";

const PIECES = [
  "acorn-rug", "altar", "antique-clock", "barrel", "bookshelf", "bronze-hha-trophy",
  "bulletinboard", "candle", "cardboard-pile", "color-box-shelf", "counter-register",
  "gold-hha-trophy", "lighthouse", "magic-circle-rug", "plant-monstera", "plant-yucca",
  "remains-pillar", "shopping-cart", "silver-hha-trophy", "study-chair", "study-desk",
  "windmill-retro", "wooden-chest", "yellow-message-mat",
];

function MaterialInspector({ piece }: { piece: string }) {
  const { scene } = useGLTF(`/assets/acnh/furniture/${piece}.glb`);
  const mats = useMemo(() => {
    const seen = new Map<string, string>();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        const std = m as THREE.MeshStandardMaterial;
        seen.set(m.name || "(unnamed)", std.color ? `#${std.color.getHexString()}` : "—");
      }
    });
    return [...seen.entries()];
  }, [scene]);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#8a939a" }}>material slots:</span>
      {mats.map(([name, hex]) => (
        <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: hex, border: "1px solid rgba(255,255,255,0.4)" }} />
          {name} <span style={{ color: "#8a939a" }}>{hex}</span>
        </span>
      ))}
    </div>
  );
}

function Stage({ piece, tint, label }: { piece: string; tint: Tint | null; label: string }) {
  return (
    <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
      <span style={{ position: "absolute", top: 8, left: 10, zIndex: 5, fontSize: 11, color: "#f1ffff", background: "rgba(0,0,0,0.4)", padding: "3px 9px", borderRadius: 6 }}>
        {label}
      </span>
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 60, position: [2.6, 2.2, 3.4] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={["#232B31"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[3.4, 40]} />
          <meshStandardMaterial color="#2E383F" roughness={0.95} />
        </mesh>
        <Suspense fallback={null}>
          <Piece name={piece} position={[0, 0, 0]} scale={0.16} tint={tint} />
        </Suspense>
        <OrbitControls target={[0, 0.8, 0]} minDistance={1.5} maxDistance={12} />
      </Canvas>
    </div>
  );
}

export default function FurnitureBench() {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!ready) return null;
  const params = new URLSearchParams(window.location.search);
  const piece = params.get("piece") ?? "counter-register";
  const presetKey = params.get("palette");
  const tintParam = params.get("tint");
  let tint: Tint | undefined;
  if (tintParam) {
    tint = {};
    for (const part of tintParam.split(",")) {
      const [slot, hex] = part.split(":");
      if (slot && /^[0-9a-fA-F]{6}$/.test(hex ?? "")) tint[slot] = `#${hex}`;
    }
  } else if (presetKey && PRESETS[presetKey]) {
    tint = PRESETS[presetKey];
  } else if (PIECE_TINTS[piece]) {
    tint = PIECE_TINTS[piece];
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#f1ffff" }}>
      <div style={{ padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {PIECES.map((p) => (
          <a key={p} href={`/lab/furniture?piece=${p}`} style={{ padding: "3px 8px", borderRadius: 6, color: "#f1ffff", textDecoration: "none", background: p === piece ? "rgba(255,209,102,0.25)" : "rgba(255,255,255,0.08)", border: `1px solid ${p === piece ? "rgba(255,209,102,0.5)" : "rgba(255,255,255,0.16)"}` }}>
            {p}
          </a>
        ))}
      </div>
      <div style={{ padding: "0 12px 8px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#8a939a" }}>presets:</span>
        {Object.keys(PRESETS).map((k) => (
          <a key={k} href={`/lab/furniture?piece=${piece}&palette=${k}`} style={{ padding: "3px 8px", borderRadius: 6, color: "#f1ffff", textDecoration: "none", background: presetKey === k ? "rgba(255,209,102,0.25)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: PRESETS[k]["*"], marginRight: 5 }} />
            {k}
          </a>
        ))}
        <span style={{ color: "#8a939a", marginLeft: 8 }}>or ?tint=slot:RRGGBB,…</span>
      </div>
      <div style={{ padding: "0 12px 8px" }}>
        <Suspense fallback={<span style={{ color: "#8a939a" }}>reading materials…</span>}>
          <MaterialInspector piece={piece} />
        </Suspense>
      </div>
      <div style={{ flex: 1, display: "flex", gap: 2, minHeight: 0 }}>
        <Stage piece={piece} tint={null} label="base" />
        <Stage piece={piece} tint={tint ?? PRESETS.oak} label={tintParam ? "custom tint" : presetKey ? `preset: ${presetKey}` : PIECE_TINTS[piece] ? "ruled tint (PIECE_TINTS)" : "preset: oak (default)"} />
      </div>
    </div>
  );
}
