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
import type { WaterParams } from "./waterShader";

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
  /** See `lib/game/waterShader.ts` — every field is documented on WaterParams. */
  water: WaterParams;
  sky: {
    /** How many times the cloud sheet repeats across the sky. Higher = smaller clouds. */
    cloudScale: number;
    /** Discrete puffy clouds with gaps. The fair-weather layer. */
    puffy: number;
    /** Bigger, denser, still broken up. */
    chunky: number;
    /** Continuous soft ceiling. */
    overcast: number;
    /** Heavy dark ceiling. */
    storm: number;
    /** How far down the storm ceiling reaches. 1 = to the skyline. */
    stormReach: number;
    /** Height the cloud bank centres on, as a fraction of the VISIBLE sky. */
    bandHeight: number;
    /** 0 = coverage is flat at every height, 1 = clouds gather at bandHeight. */
    bandEffect: number;
    /** Drift speed. */
    wind: number;
    /** Lit face of a cloud, hex. */
    cloudLit: number;
    /** Shadowed underside, hex. */
    cloudDark: number;
    /** Straight up, hex. In the game this comes from the time-of-day table. */
    zenith: number;
    /** At the skyline, hex. In the game this is the time-of-day fog colour. */
    horizon: number;
    /** Star brightness. 0 by day; the bench drives it directly. */
    night: number;
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
  // Colours sampled off David's references 2026-07-29 (images 12 and 13):
  //   #3098B3 deep · #5BC5CB mid · #CADCBC shallow · #EAE1C3 bed · #FAFCEB foam
  // The ramp ENDS IN THE SAND. Shallow water there is the seabed under a thin
  // blue film, not a paler blue, which is why the driver is depth.
  //
  // glare / glareWidth / sunGlint / sunSharp / sparkle / sparkleSpeed and the
  // three wave values are DAVID'S, off the bench 2026-07-28. They are carried
  // over unchanged, but the material underneath them changed from lit to unlit,
  // so they need one confirming pass before they can be called his again.
  water: {
    deepColor: 0x3098b3,
    midColor: 0x5bc5cb,
    shallowColor: 0xcadcbc,
    bedColor: 0xeae1c3,
    foamColor: 0xfafceb,
    ringColor: 0xd8f4ef,
    depthFalloff: 0.9,
    bedDepth: 1.6,
    bedSlope: 3.5,
    foamWidth: 0.85,
    foamStrength: 0.9,
    foamSoft: 0.06,
    foamWave: 0.12,
    foamWaveSpeed: 1.4,
    blobScale: 3.2,
    blobDarken: 0.88,
    blobSpeed: 0.35,
    ringWidth: 0.06,
    ringStrength: 0.35,
    shoreAlpha: 0.35,
    opacity: 0.94,
    fresnel: 0.18,
    glare: 1.5,
    glareWidth: 26,
    sunGlint: 6.5,
    sunSharp: 230,
    sparkle: 0.7,
    sparkleSpeed: 1.4,
    waveHeight: 0.035,
    waveScale: 7,
    waveSpeed: 0.7,
  },
  // Sky defaults after the CPU-preview pass 2026-07-29. Coverage numbers are
  // whatever the WEATHER ENGINE pushes at runtime; these are only what the
  // bench opens on.
  sky: {
    cloudScale: 0.5,
    puffy: 0.6,
    chunky: 0.25,
    overcast: 0,
    storm: 0,
    stormReach: 1,
    bandHeight: 0.52,
    bandEffect: 1,
    wind: 0.84,
    cloudLit: 0xffffff,
    cloudDark: 0xb9cbdc,
    zenith: 0x4fb6f5,
    horizon: 0xa9dcf2,
    night: 0,
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
  return { gull: { ...t.gull }, water: { ...t.water }, sky: { ...t.sky }, grass: { ...t.grass } };
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
    group("sky", current.sky as unknown as Record<string, number>) +
    "\n" +
    group("grass", current.grass as unknown as Record<string, number>) +
    "\n};"
  );
}
