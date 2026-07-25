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
    perks: ["Calm casting: the cast meter swings 12% slower, so MAX CAST is easier to hit"],
    mods: { ...NEUTRAL, castCycleMul: 1.12 },
  },
  cloudy: {
    title: "Cloudy",
    perks: [
      "Fish fight 20% calmer in the reel (fewer panic darts)",
      "Sea fish bite 15% more often at the deck and cove",
    ],
    mods: { ...NEUTRAL, dartChanceMul: 0.8, seaWeightMul: 1.15 },
  },
  rain: {
    title: "Rainy",
    perks: [
      "Bites come 25% sooner",
      "+10% luck for rare-and-up fish",
      "Rain-only fish are biting (Stringfish, Gar, Catfish…)",
      "The Golden Koi appears twice as often",
      "Butterflies are hiding from the rain",
    ],
    mods: { ...NEUTRAL, rareLuckBonus: 0.1, biteWaitMul: 0.75 },
  },
};

/** Mods for the given weather; unknown strings fall back to neutral. */
export function weatherMods(w: string): WeatherMods {
  return WEATHER_PERKS[w as Weather]?.mods ?? NEUTRAL;
}
