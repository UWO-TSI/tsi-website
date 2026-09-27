"use client";

/**
 * LoadGate (2026-07-12, David: "make sure game loads and will run smoothly
 * before putting user into the game").
 *
 * WarmupProbe (inside the Canvas): watches drei's useProgress store until
 *   every tracked asset resolves, then lets WARMUP_FRAMES real frames render
 *   behind the overlay before firing onReady. Those frames are where three
 *   compiles shaders and uploads textures — the classic first-second jank.
 *   The player never sees it. A hard TIMEOUT_MS fallback guarantees a stuck
 *   or 404ing loader can never trap the player outside the world.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";

const WARMUP_FRAMES = 14;
const TIMEOUT_MS = 15000;

export function WarmupProbe({ onReady }: { onReady: () => void }) {
  const framesRef = useRef(0);
  const firedRef = useRef(false);
  const startRef = useRef<number | null>(null);

  useFrame(() => {
    if (firedRef.current) return;
    if (startRef.current === null) startRef.current = performance.now();
    const timedOut = performance.now() - startRef.current > TIMEOUT_MS;
    // Imperative store read: subscribing via the useProgress() hook made
    // React update this component while a suspended GLB was mid-render
    // (the loading manager fires inside that resolution) — the classic
    // "cannot update while rendering" warning. getState() has no such tie.
    const { active, progress } = useProgress.getState();
    const loaded = !active && progress >= 100;
    if (loaded || timedOut) framesRef.current += 1;
    else framesRef.current = 0; // a late loader kicked in — keep holding
    if (framesRef.current >= WARMUP_FRAMES) {
      firedRef.current = true;
      // Defer out of the R3F frame loop: firing setState synchronously here
      // can land mid-render of a just-resolved suspended GLB component
      // ("Cannot update a component while rendering a different component").
      window.setTimeout(onReady, 0);
    }
  });
  return null;
}
