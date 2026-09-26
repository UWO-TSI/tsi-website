"use client";

/**
 * MiniMap (game-feel wave G3, item 15) — a small corner map, toggled with M.
 * Static SVG geometry mirroring the world layout (paths, river, landmarks)
 * with a live player dot polled from playerPosRef at 5Hz. No data deps —
 * pure wayfinding for the radius-52 island.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { createLandmarkDiscovery } from "@/lib/game/landmarkDiscovery";
import styles from "./MiniMap.module.css";
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
  { x: 44.5, z: -3.2, w: 3.6, h: 2.6, c: "#8A6A4A" }, // Wharf Shack (S4)
];

type MapPing = { id: number; x: number; z: number } | null;

/**
 * Custom island geometry for another map (e.g. the default island). Drawn in
 * world units with z negated (north up); replaces the legacy island drawing
 * and skips legacy landmark discovery.
 */
export interface MiniMapPlot {
  viewBox: string; content: ReactNode; north: [number, number]; label?: string;
  /** Draw world +x to the left, matching a camera that looks north with +x on screen left. */
  mirrorX?: boolean;
}

export default function MiniMap({ playerPosRef, onClose, plot }: {
  playerPosRef: React.RefObject<THREE.Vector3>; onClose: () => void; plot?: MiniMapPlot;
}) {
  const [dot, setDot] = useState<[number, number]>(() => [playerPosRef.current.x, playerPosRef.current.z]);
  const [ping, setPing] = useState<MapPing>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Discoveries still work for this visit. */ }
    const discover = createLandmarkDiscovery(storage);
    let pingTimer: ReturnType<typeof setTimeout> | undefined;
    let pingId = 0;
    const timer = setInterval(() => {
      const { x, z } = playerPosRef.current;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      setDot((previous) => Math.abs(previous[0] - x) > 0.2 || Math.abs(previous[1] - z) > 0.2 ? [x, z] : previous);
      if (plot) return;
      const landmark = discover(x, z);
      if (!landmark) return;
      clearTimeout(pingTimer);
      setPing({ id: ++pingId, x: landmark.x, z: landmark.z });
      pingTimer = setTimeout(() => setPing(null), 1800);
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: `Discovered: ${landmark.label}!` } }));
      AudioManager.playSFX("enter");
    }, 200);
    return () => { clearInterval(timer); clearTimeout(pingTimer); };
  }, [playerPosRef, plot]);

  return <MiniMapView plot={plot} dot={dot} ping={ping} onClose={() => { onClose(); if (opener.current?.isConnected) opener.current.focus(); }} />;
}

export function MiniMapView({ dot, ping = null, onClose, plot }: { dot: [number, number]; ping?: MapPing; onClose: () => void; plot?: MiniMapPlot }) {
  // world → svg: x right, z up-screen (north = up)
  const sx = (x: number) => plot?.mirrorX ? -x : x;
  const sy = (z: number) => -z;

  return (
    <section className={styles.map} aria-label="Island map">
      <header className={styles.header}>
        <span>Island map</span>
        <button className={styles.close} aria-label="Close map" onClick={onClose} onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key.toLowerCase() === "m" && !event.metaKey && !event.ctrlKey && !event.altKey)) {
            event.preventDefault(); event.stopPropagation(); if (!event.repeat) onClose();
          }
        }}><X size={17} aria-hidden /></button>
      </header>
      <svg viewBox={plot?.viewBox ?? "-80 -80 160 160"} className={styles.plot} role="img" aria-label={plot?.label ?? "Island overview. The yellow marker shows your position; north is up."}>
        {plot ? plot.content : <>
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
        <rect x={41} y={-0.4} width={6} height={5.4} rx="1" fill="#B98C60" stroke="#96693F" strokeWidth="0.5" />
        <rect x={15.6} y={-51.8} width={5.4} height={4.9} rx="1" fill="#B98C60" stroke="#96693F" strokeWidth="0.5" />
        {/* river (world z≈1-5 band, drawn at -z); ellipse = the v3 bend pool */}
        <ellipse cx="22" cy="-2.9" rx="5.4" ry="3.2" fill="#69A8D0" />
        <path d="M -61 -2 C -35 -5, -12 -5, -3 -1 S 16 -2, 30 -4 S 50 -3, 61 -3" fill="none" stroke="#69A8D0" strokeWidth="3.4" strokeLinecap="round" />
        {/* S7: Reedmarsh ponds + Flats tide pools */}
        <circle cx={-43} cy={-9} r={1.9} fill="#7FB5C9" />
        <circle cx={-38.3} cy={-11.2} r={1.4} fill="#7FB5C9" />
        <circle cx={37.5} cy={-50.5} r={1.6} fill="#8FC4D4" />
        <circle cx={42.5} cy={-46.5} r={1.2} fill="#8FC4D4" />
        {/* S6: Temple Rise plateau under the Oracle */}
        <ellipse cx={0} cy={-31.8} rx={8.2} ry={7.8} fill="#74B25E" stroke="#5E9E4E" strokeWidth="0.9" />
        <rect x={-1.3} y={-28.9} width={2.6} height={2.8} rx={0.4} fill="#C6BCA4" stroke="#A79E8E" strokeWidth="0.4" />
        {/* buildings */}
        {BUILDINGS.map((b, i) => (
          <rect key={i} x={sx(b.x) - b.w / 2} y={sy(b.z) - b.h / 2} width={b.w} height={b.h} rx="1" fill={b.c} stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        ))}
        {/* S5: Isla Chica (boat islet, SSW — map north is -y) */}
        <ellipse cx={-24} cy={-72} rx={6.5} ry={6} fill="#E4CD96" stroke="#CBB27C" strokeWidth="0.8" />
        <ellipse cx={-24.3} cy={-71.6} rx={4.1} ry={3.7} fill="#7EC167" stroke="#5E9E4E" strokeWidth="0.8" />
        {/* landmarks: cove camp + lighthouse (coast v2 spots) */}
        <circle cx={sx(16)} cy={sy(53.9)} r="1.6" fill="#E8705A" stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        <circle cx={sx(38.2)} cy={sy(-37.1)} r="1.6" fill="#C0392B" stroke="rgba(0,0,0,0.25)" strokeWidth="0.4" />
        {/* discovery ping */}
        {ping && (
          <g key={ping.id}>
            <circle cx={sx(ping.x)} cy={sy(ping.z)} r="3" fill="none" stroke="#FFD166" strokeWidth="1.2" className={styles.ping} />
          </g>
        )}
        </>}
        <text x={plot?.north[0] ?? 68} y={plot?.north[1] ?? -66} textAnchor="middle" fill="#244855" fontSize={plot ? 4 : 9} fontWeight="700">N</text>
        {/* player */}
        <circle cx={sx(dot[0])} cy={sy(dot[1])} r={plot ? 1.1 : 2.2} fill="#FFDD57" stroke="#7A5A00" strokeWidth="0.7" />
      </svg>
      <footer className={styles.legend}><span className={styles.you}>You</span><span>M to hide</span></footer>
    </section>
  );
}
