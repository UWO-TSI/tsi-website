"use client";

/**
 * LoadGate (2026-07-12, David: "make sure game loads and will run smoothly
 * before putting user into the game").
 *
 * Two halves:
 *
 * - WarmupProbe (inside the Canvas): watches drei's useProgress store until
 *   every tracked asset resolves, then lets WARMUP_FRAMES real frames render
 *   behind the overlay before firing onReady. Those frames are where three
 *   compiles shaders and uploads textures — the classic first-second jank.
 *   The player never sees it. A hard TIMEOUT_MS fallback guarantees a stuck
 *   or 404ing loader can never trap the player outside the world.
 *
 * - LoadGateOverlay (DOM, above the Canvas): same ASCII-brand look as the
 *   chunk-download screen in dashboard/page.tsx, but with a REAL progress
 *   bar (useProgress is a plain store — it works outside the Canvas too).
 *   When `ready` flips it fades out over 450ms, then onGone unmounts it.
 */

import { useEffect, useRef, useState } from "react";
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

export function LoadGateOverlay({ ready, onGone }: { ready: boolean; onGone: () => void }) {
  // Poll the progress store (100ms) instead of subscribing — see the note
  // in WarmupProbe. setState inside an interval callback is safe timing.
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      const { progress } = useProgress.getState();
      setPct((prev) => {
        const next = Math.min(100, Math.round(progress));
        return next > prev ? next : prev;
      });
    }, 100);
    return () => window.clearInterval(t);
  }, []);

  // `ready` itself drives the fade (no mirrored state): opacity transitions
  // to 0 the render it flips, and the timeout only handles the unmount.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(onGone, 500);
    return () => window.clearTimeout(t);
  }, [ready, onGone]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg-main)",
        opacity: ready ? 0 : 1,
        transition: "opacity 0.45s ease",
        pointerEvents: ready ? "none" : "auto",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <pre
          className="font-mono text-xs mb-4 select-none"
          style={{ color: "var(--color-text-subtle)", opacity: 0.6 }}
        >
{`  ████████████████████
  █ LOADING WORLD... █
  ████████████████████`}
        </pre>
        <div
          className="font-mono text-sm mb-4 select-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          {pct < 100 ? `Loading the village — ${pct}%` : "Warming up the engine"}
          <span className="tsi-gate-cursor">_</span>
        </div>
        <div
          className="w-48 h-1.5 rounded-full mx-auto overflow-hidden"
          style={{ background: "var(--gray-800)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "var(--color-brand-blue)",
              transition: "width 0.25s ease",
            }}
          />
        </div>
      </div>
      <style>{`
        .tsi-gate-cursor {
          display: inline-block;
          margin-left: 2px;
          animation: tsi-gate-blink 1s steps(2, start) infinite;
        }
        @keyframes tsi-gate-blink { to { visibility: hidden; } }
      `}</style>
    </div>
  );
}
