"use client";

/**
 * MiniMap (game-feel wave G3, item 15) — a small corner map, toggled with M.
 * Static SVG geometry mirroring the world layout (paths, river, landmarks)
 * with a live player dot polled from playerPosRef at 5Hz. No data deps —
 * pure wayfinding for the radius-52 island.
 */

import { useEffect, useState } from "react";
import * as THREE from "three";

const BUILDINGS: { x: number; z: number; w: number; h: number; c: string }[] = [
  { x: 0, z: -4, w: 6, h: 3, c: "#5B4B9E" },    // HQ
  { x: -24, z: 12, w: 6.5, h: 3.6, c: "#2B4EA0" }, // Shop
  { x: 0, z: 30, w: 6.8, h: 3.4, c: "#2E8B8B" },   // Oracle
  { x: 24, z: 14, w: 5, h: 3.1, c: "#8A7B6B" },    // House
  { x: -30, z: -18, w: 4, h: 5, c: "#7A4A3A" },    // red chalet
  { x: 30, z: -19, w: 4, h: 5, c: "#8A7B6B" },     // yellow chalet
];

export default function MiniMap({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const [dot, setDot] = useState<[number, number]>([0, -15]);

  useEffect(() => {
    const t = setInterval(() => {
      const p = playerPosRef.current;
      setDot((prev) => (Math.abs(prev[0] - p.x) > 0.2 || Math.abs(prev[1] - p.z) > 0.2 ? [p.x, p.z] : prev));
    }, 200);
    return () => clearInterval(t);
  }, [playerPosRef]);

  // world → svg: x right, z up-screen (north = up)
  const sx = (x: number) => x;
  const sy = (z: number) => -z;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 16,
        zIndex: 50,
        width: 170,
        height: 170,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.2)",
        boxShadow: "0 3px 14px rgba(0,0,0,0.3)",
        animation: "tsi-map-in 0.22s ease-out",
        pointerEvents: "none",
      }}
    >
      <svg viewBox="-55 -55 110 110" style={{ width: "100%", height: "100%", display: "block", background: "#6FB55B" }}>
        {/* island edge */}
        <circle cx="0" cy="0" r="52" fill="#7EC167" stroke="#5E9E4E" strokeWidth="1.5" />
        {/* paths (spine split at the river banks, matching the world) */}
        <line x1="0" y1="24" x2="0" y2="1.1" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="-5.9" x2="0" y2="-27" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="-26" y1="-10" x2="26" y2="-10" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="-17" y1="13" x2="17" y2="13" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        {/* river (world z≈1-5 band, drawn at -z) */}
        <path d="M -52 -2 C -30 -5, -12 -5, -3 -1 S 16 -2, 30 -4 S 45 -3, 52 -3" fill="none" stroke="#69A8D0" strokeWidth="3.4" strokeLinecap="round" />
        {/* buildings */}
        {BUILDINGS.map((b, i) => (
          <rect key={i} x={sx(b.x) - b.w / 2} y={sy(b.z) - b.h / 2} width={b.w} height={b.h} rx="1" fill={b.c} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        ))}
        {/* player */}
        <circle cx={sx(dot[0])} cy={sy(dot[1])} r="2.2" fill="#FFDD57" stroke="#7A5A00" strokeWidth="0.7" />
      </svg>
      <style>{`@keyframes tsi-map-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
