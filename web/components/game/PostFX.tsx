"use client";

/**
 * PostFX (sprint G4) — postprocessing pipeline.
 *
 * Mounts INSIDE the R3F Canvas, after all scene children. EffectComposer
 * intercepts the final frame and applies the effects.
 *
 * FPS budget findings (Playwright on M1, ANGLE Metal, 1440x900):
 *   - Vignette alone: ~0.5 FPS cost (single full-screen pass)
 *   - Bloom adds ~12 FPS cost (multi-pass blur chain)
 * Bloom is opt-in to keep the default render above 60 FPS. Members can
 * toggle via settings (tsi.bloom.v1 localStorage) — same pattern as
 * lite mode + ghost replay.
 *
 * Outline deferred (existing onBeforeCompile patches on Path/River risk
 * conflict with the postprocessing selection system).
 */

import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";

interface PostFXProps {
  /** Toggle the whole pipeline (lite mode disables it). */
  enabled?: boolean;
  /** Vignette darkening intensity 0-1. Higher during transitions. */
  vignetteDarkness?: number;
  /**
   * Include bloom. OFF by default — costs ~12 FPS on M1 / ANGLE Metal at
   * 1440x900. Visual gain (soft glow on emissive lanterns / braziers /
   * fireflies) is nice but not worth dropping below 60 FPS by default.
   */
  bloom?: boolean;
}

export default function PostFX({ enabled = true, vignetteDarkness = 0.4, bloom = false }: PostFXProps) {
  if (typeof window !== "undefined" && window.location.search.includes("nofx")) return null;
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={0}>
      <Vignette
        offset={0.32}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
      {bloom ? (
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.88}
          luminanceSmoothing={0.2}
          kernelSize={KernelSize.SMALL}
        />
      ) : <></>}
    </EffectComposer>
  );
}
