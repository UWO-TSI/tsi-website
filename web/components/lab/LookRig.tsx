"use client";

/**
 * Look lab rig (/lab/look, specs/look-development.md §2). Mounted inside the
 * real village Canvas; reports FPS, draw calls and triangles once a second.
 * The preset itself reaches the scene through the game's own path
 * (DefaultIslandWorld → lookToLight, lookFx, LookMaterials).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export type LookMetrics = { fps: number; frameMs: number; calls: number; triangles: number };

export default function LookRig({ onMetrics }: { onMetrics: (m: LookMetrics) => void }) {
  const clock = useRef({ seconds: 1, frames: 0 });
  useFrame(({ gl }, delta) => {
    const c = clock.current;
    c.seconds += delta; c.frames++;
    if (c.seconds < 1) return;
    onMetrics({ fps: Math.round(c.frames / c.seconds), frameMs: c.seconds * 1000 / c.frames, calls: gl.info.render.calls, triangles: gl.info.render.triangles });
    c.seconds = 0; c.frames = 0;
  }, -101); // before the world's Performance probe resets gl.info
  return null;
}
