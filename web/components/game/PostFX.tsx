"use client";

/**
 * PostFX (sprint G4; v2 lighting-research application 2026-07-14).
 *
 * Mounts INSIDE the R3F Canvas, after all scene children. EffectComposer
 * intercepts the final frame and applies the effects. pmndrs merges all
 * effects into ONE fullscreen pass, so Vignette + Vibrance together cost
 * a single blit.
 *
 * v2 changes (specs/lighting-research.md L5+L6):
 *  - Bloom modernized: mipmapBlur (hierarchical blur — wider, softer,
 *    cheaper than the old kernel chain) with luminanceThreshold=1, so
 *    ONLY materials lifted above 1.0 (toneMapped=false + emissive
 *    intensity >1) glow — free selective bloom, the lamp-halo trick.
 *    Still opt-in pending an F3 re-measure on David's machine (the old
 *    kernel bloom cost ~12 FPS; mipmap should be far less).
 *  - Vibrance: BSL's ColorSaturation formula — boosts only dull
 *    midtones, leaves saturated/bright pixels alone. The "rich but
 *    never garish" law.
 */

import { useMemo } from "react";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

// BSL-lineage vibrance (see lighting-research.md law 10): pixels that are
// dull (low chroma) and mid-bright get pushed toward color; already-vivid
// or bright pixels are untouched.
const VIBRANCE_FRAG = /* glsl */ `
uniform float uStrength;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (1.0 - clamp(mx - mn, 0.0, 1.0)) * clamp(1.0 - mx, 0.0, 1.0) * uStrength * 5.0;
  vec3 lum = vec3(dot(c, vec3(0.299, 0.587, 0.114)));
  outputColor = vec4(mix(lum, c, 1.0 + sat), inputColor.a);
}
`;

class VibranceEffect extends Effect {
  constructor(strength = 0.3) {
    super("Vibrance", VIBRANCE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([["uStrength", new Uniform(strength)]]),
    });
  }
}

interface PostFXProps {
  /** Toggle the whole pipeline (lite mode disables it). */
  enabled?: boolean;
  /** Vignette darkening intensity 0-1. Higher during transitions. */
  vignetteDarkness?: number;
  /** Include bloom — opt-in (settings toggle) until re-measured. */
  bloom?: boolean;
  /** G2: bloom strength by time of day — dusk glows, midday stays flat. */
  bloomIntensity?: number;
}

export default function PostFX({ enabled = true, vignetteDarkness = 0.4, bloom = false, bloomIntensity = 0.55 }: PostFXProps) {
  const vibrance = useMemo(() => new VibranceEffect(0.3), []);
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
      <primitive object={vibrance} />
      {bloom ? (
        <Bloom
          mipmapBlur
          intensity={bloomIntensity}
          luminanceThreshold={1}
          luminanceSmoothing={0.025}
        />
      ) : <></>}
    </EffectComposer>
  );
}
