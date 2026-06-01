"use client";

/**
 * PostFX (sprint G4) — postprocessing pipeline.
 *
 * Q7=A per David: bloom + vignette. Outline deferred (existing
 * onBeforeCompile patches on Path/River risk conflict with the
 * postprocessing selection system; needs a careful test pass).
 *
 * Mounts INSIDE the R3F Canvas, after all scene children. EffectComposer
 * intercepts the final frame and applies the effects.
 *
 * Perf budget: ≤5% FPS hit on M1 8GB. If exceeded, the first thing to
 * drop is Bloom's resolutionScale or kernel size.
 */

import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";

interface PostFXProps {
  /** Toggle the whole pipeline (e.g. lite mode disables it). */
  enabled?: boolean;
  /** Vignette darkening intensity 0-1. Higher during transitions. */
  vignetteDarkness?: number;
}

export default function PostFX({ enabled = true, vignetteDarkness = 0.4 }: PostFXProps) {
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={0}>
      {/* Bloom: only emissive materials past the threshold contribute.
          Lanterns, braziers, firefly cores all glow softly. */}
      <Bloom
        intensity={0.6}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        kernelSize={KernelSize.MEDIUM}
        mipmapBlur
      />
      {/* Subtle vignette — darkens screen edges. AC games use this to
          focus the eye on the player. */}
      <Vignette
        offset={0.32}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
