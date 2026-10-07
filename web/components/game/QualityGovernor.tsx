"use client";

/**
 * Adaptive quality in the world's Canvas (lib/game/perf/governor.ts): every settled frame's time goes to the governor,
 * and a level change applies the one knob that isn't read straight from `quality.knobs` each frame, the canvas's
 * pixel ratio (a share of what the settings give it, `dpr`). Frames while loading or with the tab hidden don't count.
 * Each scene starts from the settings as chosen.
 */
import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { quality } from "@/lib/game/perf/governor";

type Dpr = number | [number, number];
/** The pixel ratio R3F resolves from the Canvas's `dpr` (a range clamps the device's). */
const resolve = (dpr: Dpr) => (Array.isArray(dpr) ? Math.min(Math.max(window.devicePixelRatio || 1, dpr[0]), dpr[1]) : dpr);

export default function QualityGovernor({ dpr, scene }: {
  /** The Canvas's own `dpr` (from the settings): the governor scales it down, never up. */
  dpr: Dpr;
  /** Which scene is shown: a new one starts at level 0. */
  scene: string;
}) {
  const setDpr = useThree(s => s.setDpr);
  const base = Array.isArray(dpr) ? `${dpr[0]}-${dpr[1]}` : String(dpr);
  useEffect(() => {
    quality.reset();
    setDpr(resolve(dpr));
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __governor: quality });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the dpr's value (`base`): a new array each render is the same setting
  }, [scene, base, setDpr]);
  useFrame((_, delta) => {
    if (useProgress.getState().active || document.hidden) return;
    if (quality.frame(delta * 1000)) setDpr(resolve(dpr) * quality.knobs.renderScale);
  });
  return null;
}
