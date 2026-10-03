/**
 * Indoor light from the outdoor one (specs/polish/interiors.md deliverable 3). Every room follows the time of day
 * through its windows: the island's blended light (islandLightAt, so dawn and nightfall come on gradually) gives the
 * daylight the windows let in, the sun or moon that falls through them (the real sun's direction and colour; the
 * moon's blue at night, never a sun-coloured key in the dark), the sky the panes show, and how far up the lamps are.
 * Each room scales these by its own numbers (HQInterior, the Oracle, the museum, homes).
 */
import { Color } from "three";
import { windowLit, type IslandLight } from "./islandLighting";
import { CURRENT, PHASE_LOOK } from "./lookPreset";

export interface InteriorLight {
  /** The windows' daylight: 1 by day, 0 at night, between at dawn and dusk. */
  day: number;
  /** Through the windows: the sun by day, the moon at night (`color`), relative strength (1 a clear noon). */
  key: { color: string; intensity: number; position: readonly [number, number, number] };
  /** The room's fill: cool daylight from the windows by day, the lamps' warmth at night. */
  ambient: { color: string; intensity: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  /** Lamps (pendants, floor and desk lamps, candles' pools): a share of their night strength. */
  lamps: number;
}

/** A clear noon's sun strength (the look's sun times the day phase): the reference the indoor key is measured against. */
const NOON_SUN = CURRENT.light.sunIntensity * PHASE_LOOK.day.sunIntensity;
/** The moon through a window is a cool sliver of light, not a key: its share of a clear noon's. */
const MOON_SHARE = 0.18;
const DAY_FILL = "#eef3fb", NIGHT_FILL = "#ffdcb4", DAY_SKY = "#dde8ff", NIGHT_SKY = "#6f6a86", GROUND = "#b79c80";

const a = new Color(), b = new Color();
const mix = (x: string, y: string, t: number) => `#${a.set(x).lerp(b.set(y), Math.min(1, Math.max(0, t))).getHexString()}`;

export function interiorLight(light: IslandLight): InteriorLight {
  const day = 1 - windowLit(light);
  // Rain, fog and the phase dim the sun outdoors; the same share comes in. At night it is the moon's, and faint.
  const sun = Math.min(1.25, light.sunIntensity / NOON_SUN);
  const key = sun * (day + (1 - day) * MOON_SHARE);
  return {
    day,
    key: { color: light.sun, intensity: key, position: light.sunPosition },
    ambient: { color: mix(NIGHT_FILL, DAY_FILL, day), intensity: 0.8 + 0.2 * day },
    hemisphere: { sky: mix(NIGHT_SKY, DAY_SKY, day), ground: GROUND, intensity: 0.55 + 0.45 * day },
    lamps: 0.55 + 0.45 * (1 - day),
  };
}
