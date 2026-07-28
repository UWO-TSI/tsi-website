"use client";

/**
 * tuning — live-tunable constants, and the bench that drives them.
 *
 * David, 2026-07-28: "I want you to take out individual assets and animations,
 * put it on the bench for me to tweak manually with a slider and i will give you
 * screenshots of the correct values."
 *
 * So: every value here has a SHIPPED DEFAULT that is what production uses, and
 * `/lab/tune` writes over it at runtime. Nothing here is read from storage or a
 * URL in the product — a page load always starts at the defaults, and a value
 * only becomes real when it is written back into this file.
 *
 * Read with `tune()` inside `useFrame` and similar hot paths: it is a plain
 * object read, no hook, no subscription, no re-render. Components that need to
 * REBUILD when a value changes (a material, a geometry) use `useTuning()`,
 * which re-renders on any change.
 */

import { useEffect, useState } from "react";

export interface Tuning {
  gull: {
    /** AnimationMixer timeScale — how fast the wings flap. Ship: 0.85. */
    flap: number;
    /** Random spread added to flap per bird, so they are not in lockstep. */
    flapSpread: number;
    /** Radians/sec around the anchor. Ship: 0.09 + up to 0.05. */
    orbitSpeed: number;
    /** Orbit radius, world units. */
    orbitRadius: number;
    /** Height above the water. */
    altitude: number;
    /** Amplitude of the slow altitude bob. */
    bob: number;
    /** Model scale. Source wingspan is ~9.3u; a gull wants ~0.7u. */
    scale: number;
    /** Ceiling on the roll, radians. A gull leans; it does not barrel-roll. */
    bank: number;
    /** Turn rate (rad/sec) to roll. Higher = leans harder into the same turn. */
    bankGain: number;
    /** Radius variation as a fraction of radius. 0 is a dead circle. */
    wobble: number;
    /** How far the orbit centre wanders, world units. */
    drift: number;
  };
  water: {
    /** Open-water colour, hex. Sampled #62DAE6 off David's stylised reference. */
    deepColor: number;
    /** Colour at the bank, hex. Sampled #C9EEF4 — paler, not darker. */
    shallowColor: number;
    /** Foam colour, hex. Sampled #F8F8F7. */
    foamColor: number;
    /** Cells from the bank over which shallow blends to open water. */
    depthFalloff: number;
    /** Width of the white foam collar, in cells. */
    foamWidth: number;
    /** How opaque the foam gets at its strongest. */
    foamStrength: number;
    /** How fast the flow normal scrolls, UV/sec. */
    flowSpeed: number;
    /** World units one repeat of the flow normal covers. */
    flowScale: number;
    /** Strength of the flow normal — the ripple depth. */
    ripple: number;
    /** Surface opacity. */
    opacity: number;
    /** How glossy the surface reads. Lower is shinier. */
    roughness: number;
    /** Sky sheen at grazing angles — stands in for a real reflection. */
    fresnel: number;
    /** Brightness of the mirrored sun. */
    sunGlint: number;
    /** Tightness of the sun's reflection. Higher is a smaller, harder spot. */
    sunSharp: number;
    /** Vertical wave amplitude, world units. Keep it small. */
    waveHeight: number;
    /** Wavelength of the swell, world units. */
    waveScale: number;
    /** Swell speed. */
    waveSpeed: number;
  };
  grass: {
    /** 0 = procedural crossed cards, 1 = the low-poly blade pack. */
    model: number;
    /** Strength of the ACNH normal map on the ground. 0 = the flat green. */
    normalStrength: number;
    /** World units one repeat of the detail normal covers. */
    normalScale: number;
    /** Tufts per 100 cells of grass. 0 disables the whole system. */
    tuftDensity: number;
    /** Tuft card height, world units. */
    tuftHeight: number;
    /** How far the tip of a tuft leans in the wind, world units. */
    swayAmount: number;
    /** Wind oscillations per second. */
    swaySpeed: number;
    /** Wavelength of the gust travelling across the field, world units. */
    gustLength: number;
  };
}

/**
 * SHIPPED VALUES. Changing a number here changes the game; changing it on the
 * bench changes only that tab.
 */
export const TUNING_DEFAULTS: Tuning = {
  // Gull values are DAVID'S, off the bench 2026-07-28. Do not "tidy" them.
  gull: {
    flap: 5.15,
    flapSpread: 0.75,
    orbitSpeed: 0.6,
    orbitRadius: 6.5,
    altitude: 8,
    bob: 1.4,
    scale: 0.075,
    bank: 0.54,
    bankGain: 0.9,
    wobble: 0.26,
    drift: 3.5,
  },
  // Sampled off David's stylised reference 2026-07-28. Note the ramp runs PALE
  // at the bank to SATURATED in open water — the opposite of the ACNH rain
  // capture, which was dark mid-channel. Different look, and this is the one
  // he picked.
  water: {
    deepColor: 0x62dae6,
    shallowColor: 0xc9eef4,
    foamColor: 0xf8f8f7,
    depthFalloff: 2.2,
    foamWidth: 0.85,
    foamStrength: 0.9,
    flowSpeed: 0.04,
    flowScale: 11,
    ripple: 0.18,
    opacity: 0.88,
    roughness: 0.12,
    fresnel: 0.25,
    sunGlint: 0.85,
    sunSharp: 48,
    waveHeight: 0.035,
    waveScale: 7,
    waveSpeed: 0.7,
  },
  grass: {
    model: 1,
    normalStrength: 0.6,
    normalScale: 2,
    tuftDensity: 6,
    tuftHeight: 0.34,
    swayAmount: 0.09,
    swaySpeed: 1.1,
    gustLength: 9,
  },
};

function clone(t: Tuning): Tuning {
  return { gull: { ...t.gull }, water: { ...t.water }, grass: { ...t.grass } };
}

let current: Tuning = clone(TUNING_DEFAULTS);
let version = 0;
const listeners = new Set<() => void>();

/** Current values. Safe to call every frame — it is one property read. */
export function tune(): Tuning {
  return current;
}

export function setTuning<K extends keyof Tuning>(group: K, key: keyof Tuning[K], value: number): void {
  (current[group] as Record<string, number>)[key as string] = value;
  version++;
  for (const l of listeners) l();
}

export function resetTuning(): void {
  current = clone(TUNING_DEFAULTS);
  version++;
  for (const l of listeners) l();
}

/** Re-renders the caller whenever any value changes. For materials and geometry. */
export function useTuning(): Tuning {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}

/**
 * The current values as a paste-ready `TUNING_DEFAULTS` literal, so a tuning
 * session ends in a diff rather than in a list of numbers to retype.
 */
export function tuningSource(): string {
  const group = (name: string, obj: Record<string, number>) =>
    `  ${name}: {\n` +
    Object.entries(obj)
      // Colours read as hex or the pasted block is a wall of decimals.
      .map(([k, v]) =>
        /Color$/.test(k)
          ? `    ${k}: 0x${Math.round(v).toString(16).padStart(6, "0")},`
          : `    ${k}: ${Number(v.toFixed(4))},`
      )
      .join("\n") +
    "\n  },";
  return (
    "export const TUNING_DEFAULTS: Tuning = {\n" +
    group("gull", current.gull as unknown as Record<string, number>) +
    "\n" +
    group("water", current.water as unknown as Record<string, number>) +
    "\n" +
    group("grass", current.grass as unknown as Record<string, number>) +
    "\n};"
  );
}
