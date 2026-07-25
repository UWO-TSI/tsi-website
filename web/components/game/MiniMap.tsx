"use client";

/**
 * MiniMap (game-feel wave G3, item 15) — a small corner map, toggled with M.
 * Static SVG geometry mirroring the world layout (paths, river, landmarks)
 * with a live player dot polled from playerPosRef at 5Hz. No data deps —
 * pure wayfinding for the radius-52 island.
 */

import { useEffect, useState } from "react";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { coastWobble, beachWidthShift, COAST_SCALE } from "@/lib/game/coast";

// Organic coast outline: sample the shared harmonics into SVG polygons
// (module-level — the coastline is static). Two rings: the sand at the
// waterline (e≈51.4) under the grass at the sand line (e≈48.5 shifted by
// the beach-width map), so the minimap shows the beaches too.
function ringPoints(eFor: (x: number, z: number) => number): string {
  const pts: string[] = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    const r = (eFor(x, z) + coastWobble(x, z)) * COAST_SCALE;
    pts.push(`${(x * r).toFixed(1)},${(-z * r).toFixed(1)}`);
  }
  return pts.join(" ");
}
const SAND_POINTS = ringPoints(() => 51.4);
const GRASS_POINTS = ringPoints((x, z) => 48.5 - beachWidthShift(x, z));

const BUILDINGS: { x: number; z: number; w: number; h: number; c: string }[] = [
  { x: 0, z: -4, w: 6, h: 3, c: "#5B4B9E" },    // HQ
  { x: -24, z: 12, w: 6.5, h: 3.6, c: "#2B4EA0" }, // Shop
  { x: 0, z: 30, w: 6.8, h: 3.4, c: "#2E8B8B" },   // Oracle
  { x: 24, z: 14, w: 5, h: 3.1, c: "#8A7B6B" },    // House
  { x: -30, z: -18, w: 4, h: 5, c: "#7A4A3A" },    // red chalet
  { x: 30, z: -19, w: 4, h: 5, c: "#8A7B6B" },     // yellow chalet
];

// Loop iter 17 (2026-07-24): discovery pings — first visit to a landmark
// pulses a ring on the minimap + a toast + a soft chime. Persisted in
// localStorage so each discovery only fires once per device.
const DISCOVER_ZONES: { key: string; label: string; x: number; z: number; r: number }[] = [
  { key: "cove", label: "Beach Cove", x: 16, z: 53.9, r: 8 },
  { key: "lighthouse", label: "The Lighthouse", x: 38.2, z: -37.1, r: 7 },
  { key: "windmill", label: "The Windmill", x: -32, z: -26, r: 9 },
  { key: "oracle", label: "Oracle Temple", x: 0, z: 30, r: 7 },
];
const DISCOVER_KEY = "tsi.discovered.v1";

export default function MiniMap({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const [dot, setDot] = useState<[number, number]>([0, -15]);
  const [ping, setPing] = useState<{ id: number; x: number; z: number } | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const p = playerPosRef.current;
      setDot((prev) => (Math.abs(prev[0] - p.x) > 0.2 || Math.abs(prev[1] - p.z) > 0.2 ? [p.x, p.z] : prev));
      // Discovery check (cheap: 4 zones at 5Hz)
      try {
        const seen = new Set<string>(JSON.parse(localStorage.getItem(DISCOVER_KEY) ?? "[]") as string[]);
        for (const zn of DISCOVER_ZONES) {
          if (seen.has(zn.key)) continue;
          if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r) {
            seen.add(zn.key);
            localStorage.setItem(DISCOVER_KEY, JSON.stringify([...seen]));
            setPing({ id: Date.now(), x: zn.x, z: zn.z });
            window.setTimeout(() => setPing(null), 1800);
            window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `Discovered: ${zn.label}!` } }));
            AudioManager.playSFX("enter");
            break;
          }
        }
      } catch { /* private browsing */ }
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
      <svg viewBox="-72 -72 144 144" style={{ width: "100%", height: "100%", display: "block", background: "#6FB55B" }}>
        {/* island — organic coastline: sand ring under the grass line */}
        <polygon points={SAND_POINTS} fill="#E4CD96" stroke="#CBB27C" strokeWidth="1" strokeLinejoin="round" />
        <polygon points={GRASS_POINTS} fill="#7EC167" stroke="#5E9E4E" strokeWidth="1" strokeLinejoin="round" />
        {/* paths (spine split at the river banks, matching the world) */}
        <line x1="0" y1="24" x2="0" y2="1.1" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="-5.9" x2="0" y2="-27" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="-34" y1="-10" x2="41" y2="-10" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="-34" y1="13" x2="41" y2="13" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="39.25" y1="13" x2="39.25" y2="-10" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        <line x1="-31.75" y1="13" x2="-31.75" y2="26.5" stroke="#D9B380" strokeWidth="3" strokeLinecap="round" />
        {/* Beach Cove sand spur (world z drawn as -y) */}
        <line x1="1" y1="-23.75" x2="18.25" y2="-23.75" stroke="#E7D3A0" strokeWidth="3" strokeLinecap="round" />
        <line x1="18.25" y1="-23.75" x2="18.25" y2="-49.5" stroke="#E7D3A0" strokeWidth="3" strokeLinecap="round" />
        {/* Ground pads (loop wake 33: map matches the ground) — the brick
            plaza + the beach wood deck. World rects from RoadTiles. */}
        <rect x={-5.4} y={9.4} width={10.8} height={7.2} rx="1.2" fill="#C98F73" stroke="#A9714F" strokeWidth="0.5" />
        <rect x={15.6} y={-51.8} width={5.4} height={4.9} rx="1" fill="#B98C60" stroke="#96693F" strokeWidth="0.5" />
        {/* river (world z≈1-5 band, drawn at -z) */}
        <path d="M -61 -2 C -35 -5, -12 -5, -3 -1 S 16 -2, 30 -4 S 50 -3, 61 -3" fill="none" stroke="#69A8D0" strokeWidth="3.4" strokeLinecap="round" />
        {/* buildings */}
        {BUILDINGS.map((b, i) => (
          <rect key={i} x={sx(b.x) - b.w / 2} y={sy(b.z) - b.h / 2} width={b.w} height={b.h} rx="1" fill={b.c} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        ))}
        {/* landmarks: cove camp + lighthouse (coast v2 spots) */}
        <circle cx={sx(16)} cy={sy(53.9)} r="1.6" fill="#E8705A" stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        <circle cx={sx(38.2)} cy={sy(-37.1)} r="1.6" fill="#C0392B" stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        {/* discovery ping */}
        {ping && (
          <g key={ping.id}>
            <circle cx={sx(ping.x)} cy={sy(ping.z)} r="3" fill="none" stroke="#FFD166" strokeWidth="1.2" style={{ animation: "tsi-ping 0.9s ease-out 2" }} />
          </g>
        )}
        {/* player */}
        <circle cx={sx(dot[0])} cy={sy(dot[1])} r="2.2" fill="#FFDD57" stroke="#7A5A00" strokeWidth="0.7" />
      </svg>
      <style>{`
        @keyframes tsi-map-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes tsi-ping {
          0% { opacity: 1; transform: scale(0.5); transform-box: fill-box; transform-origin: center; }
          100% { opacity: 0; transform: scale(2.6); transform-box: fill-box; transform-origin: center; }
        }
      `}</style>
    </div>
  );
}
