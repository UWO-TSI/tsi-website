"use client";

/**
 * DebugOverlay (sprint F1.4 — Minecraft F3 tradition).
 * Press F3 in-world to toggle. Shows FPS, player coords, basic render
 * info. Lightweight: refreshes 4x/sec, not per-frame, so it doesn't
 * itself drop FPS.
 *
 * Lives outside the R3F Canvas — reads via refs that GameWorld updates.
 */

import { useEffect, useState } from "react";

interface DebugSnapshot {
  fps: number;
  x: number;
  z: number;
  y: number;
  phase: string;
  ghosts: number;
  npcs: number;
  drawCalls?: number;
  triangles?: number;
  frameMs?: number;
  geometries?: number;
  textures?: number;
}

interface DebugOverlayProps {
  visible: boolean;
  /**
   * Caller is expected to update this ref on every frame. We read it on
   * a setInterval so we don't trigger per-frame re-renders here.
   */
  snapshotRef: React.RefObject<DebugSnapshot | null>;
}

export default function DebugOverlay({ visible, snapshotRef }: DebugOverlayProps) {
  const [snap, setSnap] = useState<DebugSnapshot | null>(null);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      if (snapshotRef.current) setSnap({ ...snapshotRef.current });
    }, 250);
    return () => clearInterval(id);
  }, [visible, snapshotRef]);

  if (!visible || !snap) return null;

  const fpsColor =
    snap.fps >= 50 ? "#7CB342" :
    snap.fps >= 30 ? "#FFD166" :
    "#E87B5A";

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        zIndex: 70,
        background: "rgba(0, 0, 0, 0.7)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        color: "#f1ffff",
        lineHeight: 1.5,
        pointerEvents: "none",
        minWidth: "180px",
      }}
    >
      <div style={{ color: "#8a939a", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
        DEBUG · F3 to close
      </div>
      <Row label="FPS" value={`${snap.fps}`} color={fpsColor} />
      {snap.frameMs !== undefined && <Row label="Frame" value={`${snap.frameMs}ms`} />}
      <Row label="X" value={snap.x.toFixed(2)} />
      <Row label="Y" value={snap.y.toFixed(2)} />
      <Row label="Z" value={snap.z.toFixed(2)} />
      <Row label="Phase" value={snap.phase} />
      <Row label="Ghosts" value={`${snap.ghosts}`} />
      <Row label="NPCs" value={`${snap.npcs}`} />
      {snap.drawCalls !== undefined && (
        <Row label="Draws" value={`${snap.drawCalls}`} />
      )}
      {snap.triangles !== undefined && (
        <Row label="Tris" value={`${(snap.triangles / 1000).toFixed(1)}k`} />
      )}
      {snap.geometries !== undefined && (
        <Row label="Geoms" value={`${snap.geometries}`} />
      )}
      {snap.textures !== undefined && (
        <Row label="Texs" value={`${snap.textures}`} />
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
      <span style={{ color: "#8a939a" }}>{label}</span>
      <span style={{ color: color ?? "#f1ffff" }}>{value}</span>
    </div>
  );
}

export type { DebugSnapshot };
