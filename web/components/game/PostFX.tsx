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

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useLabState } from "@/lib/game/devLab";
import { DEFAULT_GRADE, type Grade } from "@/lib/game/grading";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector3 } from "three";

// Pastel master grade (AC-reference calibration, 2026-07-14 — David's
// snapshots in specs/references/acnh measure mean outdoor saturation
// 0.24-0.39 with a warm cast everywhere; the earlier vibrance pass pushed
// the OPPOSITE way and read "very saturated"). Three moves, in order:
//   1. global desaturation toward luma (the milky pastel wash)
//   2. warm cream cast (whites become cream, blues soften)
//   3. lifted warm blacks (shadows never crush, they glow faintly brown)
const PASTEL_FRAG = /* glsl */ `
uniform float uDesat;
uniform vec3 uWarmCast;
uniform vec3 uBlackLift;
uniform float uContrast;
uniform float uVibrance;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // Vibrance (BSL-style): saturation boost weighted toward the LEAST
  // saturated pixels, so skin/pastel tones don't blow out. 0 = identity.
  float lumV = dot(c, vec3(0.299, 0.587, 0.114));
  float satV = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(lumV), c, 1.0 + uVibrance * (1.0 - satV));
  vec3 lum = vec3(dot(c, vec3(0.299, 0.587, 0.114)));
  c = mix(c, lum, uDesat);
  c *= uWarmCast;
  c = c + uBlackLift * (1.0 - c);
  // Contrast around mid-grey. 1 = identity.
  c = (c - 0.5) * uContrast + 0.5;
  outputColor = vec4(c, inputColor.a);
}
`;

// Module-scope escape hatch (react-compiler immutability rule): the
// renderer reached through useThree is frozen inside component code.
function setExposure(gl: { toneMappingExposure: number }, v: number) {
  gl.toneMappingExposure = v;
}

class PastelEffect extends Effect {
  constructor() {
    super("PastelGrade", PASTEL_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uDesat", new Uniform(0.14)],
        ["uWarmCast", new Uniform(new Vector3(1.03, 1.0, 0.94))],
        ["uBlackLift", new Uniform(new Vector3(0.05, 0.042, 0.032))],
        ["uContrast", new Uniform(1)],
        ["uVibrance", new Uniform(0)],
      ]),
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
  /** Per-weather color grade (WEATHER_GRADES). Lab override wins. */
  grade?: Grade;
}

export default function PostFX({ enabled = true, vignetteDarkness = 0.4, bloom = false, bloomIntensity = 0.55, grade }: PostFXProps) {
  const pastel = useMemo(() => new PastelEffect(), []);
  const gl = useThree((s) => s.gl);
  // Grade resolution: lab sliders (dev-only, always null in prod) beat the
  // game's per-weather grade, which beats the shipped default. Every field
  // of DEFAULT_GRADE reproduces the 2026-07-14 look exactly.
  const lab = useLabState();
  const g: Grade = lab.grade ?? grade ?? DEFAULT_GRADE;
  useEffect(() => {
    (pastel.uniforms.get("uDesat")!).value = g.desat;
    (pastel.uniforms.get("uWarmCast")!.value as Vector3).set(1 + 0.03 * g.warmth, 1.0, 1 - 0.06 * g.warmth);
    (pastel.uniforms.get("uBlackLift")!.value as Vector3).set(0.05 * g.lift, 0.042 * g.lift, 0.032 * g.lift);
    (pastel.uniforms.get("uContrast")!).value = g.contrast;
    (pastel.uniforms.get("uVibrance")!).value = g.vibrance;
    setExposure(gl, g.exposure);
  }, [g, pastel, gl]);
  if (typeof window !== "undefined" && window.location.search.includes("nofx")) return null;
  if (!enabled) return null;
  return (
    <EffectComposer multisampling={0}>
      <Vignette
        offset={0.32}
        darkness={g.vignette ?? vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
      <primitive object={pastel} />
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
