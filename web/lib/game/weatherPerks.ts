/**
 * Weather perks (David ask 2026-07-24): each weather state carries real
 * gameplay modifiers, surfaced in the HUD weather-circle tooltip. Every
 * perk listed here is WIRED — fishing.ts and FishingOverlay consume the
 * mods — so the tooltip never advertises an effect that doesn't exist.
 * No XP/TC modifiers ever (principle #3: XP is IRL-only, TC is work-only).
 */
import type { Weather } from "./weather";

export interface WeatherMods {
  /** Extra luck added into rollFish (same scale as cast-power luck). */
  rareLuckBonus: number;
  /** Multiplier on the cast→bite wait time. */
  biteWaitMul: number;
  /** Multiplier on every species' reel dart chance. */
  dartChanceMul: number;
  /** Roll-weight multiplier for sea-zone species (deck + cove spots). */
  seaWeightMul: number;
  /** Multiplier on the cast-meter period (higher = slower = easier MAX). */
  castCycleMul: number;
}

const NEUTRAL: WeatherMods = {
  rareLuckBonus: 0,
  biteWaitMul: 1,
  dartChanceMul: 1,
  seaWeightMul: 1,
  castCycleMul: 1,
};

export const WEATHER_PERKS: Record<
  Weather,
  { title: string; perks: string[]; mods: WeatherMods }
> = {
  sunny: {
    title: "Sunny",
    perks: [
      "Calm casting: 12% more time to line up your cast",
      "Butterflies are out in force today",
    ],
    mods: { ...NEUTRAL, castCycleMul: 1.12 },
  },
  cloudy: {
    title: "Cloudy",
    perks: [
      "Fish make 20% fewer panic darts while reeling",
    ],
    mods: { ...NEUTRAL, dartChanceMul: 0.8, seaWeightMul: 1.15 },
  },
  rain: {
    title: "Rainy",
    perks: [
      "Bites come 25% sooner",
      "A luck bonus for rare catches",
      "Stringfish, Gar and Catfish can bite outside their usual hours",
      "Better chances of finding a Golden Koi",
      "Butterflies are hiding from the rain",
    ],
    mods: { ...NEUTRAL, rareLuckBonus: 0.1, biteWaitMul: 0.75 },
  },
};

/** Mods for the given weather; unknown strings fall back to neutral. */
export function weatherMods(w: string): WeatherMods {
  return WEATHER_PERKS[w as Weather]?.mods ?? NEUTRAL;
}
