"use client";

/**
 * MiniMap (game-feel wave G3, item 15) — a small corner map, toggled with the
 * account's map key (`toggleKey`, M by default; row 220 remaps).
 * Draws the island plot it is given, with a live player dot polled from
 * playerPosRef at 5Hz, and (v1 friends) a small coral marker for each friend
 * in view (the remotes' driver writes where they stand: net/active.ts). It turns with the orbit camera (specs/camera-orbit.md)
 * about its centre, so up on the map is the way the camera looks; the N rides
 * round the rim and stays upright.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./MiniMap.module.css";
import * as THREE from "three";
import { keyName } from "@/lib/game/movement/keys";
import { orbit } from "@/lib/game/orbitCamera";
import { friendsStore } from "@/lib/net/friends";
import { liveRemotes } from "./net/active";

/** Your friends in view, where they stand (rounded to 0.2 u, so the map re-renders only when one moves). */
function friendSpots(): [number, number][] {
  const f = friendsStore(), out: [number, number][] = [];
  for (let i = 0; i < liveRemotes.n; i++) if (f.isFriend(liveRemotes.uid[i])) out.push([Math.round(liveRemotes.x[i] * 5) / 5, Math.round(liveRemotes.z[i] * 5) / 5]);
  return out;
}
const sameSpots = (a: [number, number][], b: [number, number][]) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

/**
 * The map's turn (SVG degrees, clockwise) for a camera heading `yaw`: the camera's forward points up. Plots draw
 * world z negated (y down the page); a mirrored plot (+x on the left, the default view's screen) turns by the yaw,
 * an unmirrored one by its negative.
 */
export const minimapTurn = (yaw: number, mirrorX = false) => ((mirrorX ? 1 : -1) * yaw * 180) / Math.PI;

/**
 * Island geometry for the map (e.g. the default island). Drawn in world units
 * with z negated (the camera's forward up). `north` places the N.
 */
export interface MiniMapPlot {
  viewBox: string; content: ReactNode; north: [number, number]; label?: string;
  /** Draw world +x to the left, matching the follow camera (looks +z, +x on screen left). */
  mirrorX?: boolean;
}

export default function MiniMap({ playerPosRef, onClose, plot, toggleKey = "m" }: {
  playerPosRef: React.RefObject<THREE.Vector3>; onClose: () => void; plot: MiniMapPlot; toggleKey?: string;
}) {
  const [dot, setDot] = useState<[number, number] | null>(null);
  const [friends, setFriends] = useState<[number, number][]>([]);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const tick = () => {
      const { x, z } = playerPosRef.current;
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      setDot((previous) => !previous || Math.abs(previous[0] - x) > 0.2 || Math.abs(previous[1] - z) > 0.2 ? [x, z] : previous);
      const spots = friendSpots();
      setFriends(previous => (sameSpots(previous, spots) ? previous : spots));
    };
    const first = setTimeout(tick);
    const timer = setInterval(tick, 200);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [playerPosRef]);

  // Turn with the camera every frame, straight to the DOM (a re-render per frame would cost the island).
  const turned = useRef<SVGGElement>(null), north = useRef<SVGTextElement>(null);
  const [vx, vy, vw, vh] = plot.viewBox.split(/\s+/).map(Number), cx = vx + vw / 2, cy = vy + vh / 2;
  useEffect(() => {
    let raf = 0, last = NaN;
    const tick = () => {
      const deg = minimapTurn(orbit.view.yaw, plot.mirrorX);
      if (!(Math.abs(deg - last) < 0.05)) {
        last = deg;
        turned.current?.setAttribute("transform", `rotate(${deg.toFixed(2)} ${cx} ${cy})`);
        north.current?.setAttribute("transform", `rotate(${(-deg).toFixed(2)} ${plot.north[0]} ${plot.north[1] - 1.4})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [plot.mirrorX, plot.north, cx, cy]);

  const close = () => { onClose(); if (opener.current?.isConnected) opener.current.focus(); };
  const sx = (x: number) => plot.mirrorX ? -x : x;

  return (
    <section className={styles.map} aria-label="Island map">
      <header className={styles.header}>
        <span>Island map</span>
        <button className={styles.close} aria-label="Close map" onClick={close} onKeyDown={(event) => {
          if (event.key === "Escape" || (event.key.toLowerCase() === toggleKey && !event.metaKey && !event.ctrlKey && !event.altKey)) {
            event.preventDefault(); event.stopPropagation(); if (!event.repeat) close();
          }
        }}><X size={17} aria-hidden /></button>
      </header>
      <svg viewBox={plot.viewBox} className={styles.plot} role="img" aria-label={plot.label ?? "Island overview. The yellow marker shows your position; north is up."}>
        <g ref={turned}>
          {plot.content}
          <text ref={north} x={plot.north[0]} y={plot.north[1]} textAnchor="middle" fill="#244855" fontSize={4} fontWeight="700">N</text>
          {/* friends in view (v1) */}
          {friends.map(([fx, fz], i) => <circle key={i} cx={sx(fx)} cy={-fz} r={0.95} fill="#E2826A" stroke="#FFFBE7" strokeWidth="0.55" />)}
          {/* player */}
          {dot ? <circle cx={sx(dot[0])} cy={-dot[1]} r={1.1} fill="#FFDD57" stroke="#7A5A00" strokeWidth="0.7" /> : null}
        </g>
      </svg>
      <footer className={styles.legend}><span className={styles.you}>You</span>{friends.length > 0 && <span className={styles.friends}>Friends</span>}<span>{keyName(toggleKey)} to hide</span></footer>
    </section>
  );
}
