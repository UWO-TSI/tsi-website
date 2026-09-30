"use client";

/**
 * MiniMap (game-feel wave G3, item 15) — a small corner map, toggled with M.
 * Draws the island plot it is given, with a live player dot polled from
 * playerPosRef at 5Hz.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./MiniMap.module.css";
import * as THREE from "three";

/**
 * Island geometry for the map (e.g. the default island). Drawn in world units
 * with z negated (the camera's forward up). `north` places the N.
 */
export interface MiniMapPlot {
  viewBox: string; content: ReactNode; north: [number, number]; label?: string;
  /** Draw world +x to the left, matching the follow camera (looks +z, +x on screen left). */
  mirrorX?: boolean;
}

export default function MiniMap({ playerPosRef, onClose, plot }: {
  playerPosRef: React.RefObject<THREE.Vector3>; onClose: () => void; plot: MiniMapPlot;
}) {
  const [dot, setDot] = useState<[number, number] | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const tick = () => {
      const { x, z } = playerPosRef.current;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      setDot((previous) => !previous || Math.abs(previous[0] - x) > 0.2 || Math.abs(previous[1] - z) > 0.2 ? [x, z] : previous);
    };
    const first = setTimeout(tick);
    const timer = setInterval(tick, 200);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [playerPosRef]);

  const close = () => { onClose(); if (opener.current?.isConnected) opener.current.focus(); };
  const sx = (x: number) => plot.mirrorX ? -x : x;

  return (
    <section className={styles.map} aria-label="Island map">
      <header className={styles.header}>
        <span>Island map</span>
        <button className={styles.close} aria-label="Close map" onClick={close} onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key.toLowerCase() === "m" && !event.metaKey && !event.ctrlKey && !event.altKey)) {
            event.preventDefault(); event.stopPropagation(); if (!event.repeat) close();
          }
        }}><X size={17} aria-hidden /></button>
      </header>
      <svg viewBox={plot.viewBox} className={styles.plot} role="img" aria-label={plot.label ?? "Island overview. The yellow marker shows your position; north is up."}>
        {plot.content}
        <text x={plot.north[0]} y={plot.north[1]} textAnchor="middle" fill="#244855" fontSize={4} fontWeight="700">N</text>
        {/* player */}
        {dot ? <circle cx={sx(dot[0])} cy={-dot[1]} r={1.1} fill="#FFDD57" stroke="#7A5A00" strokeWidth="0.7" /> : null}
      </svg>
      <footer className={styles.legend}><span className={styles.you}>You</span><span>M to hide</span></footer>
    </section>
  );
}
