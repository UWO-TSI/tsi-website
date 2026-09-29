import { LONDON_ON } from "./islandWeather";
import { torontoInstant, type IslandPhase } from "./islandTime";
import { DAWN_HOURS, EVENING_HALF_HOURS, sunFor, torontoDate, type SunDay } from "./sunTimes";

/**
 * The real sun over London, Ontario (ledger row 239, specs/look-development.md
 * §8), by NOAA's solar calculator equations (Meeus, "Astronomical
 * Algorithms"): about 0.01° against NOAA, no refraction (the key light never
 * goes below its minimum elevation anyway). The shorter Fourier-series form
 * drifts about 0.4° in declination near the equinoxes, so it is not used.
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 */
export interface SunAngles {
  /** Degrees above the horizon (negative at night). */
  elevation: number;
  /** Compass degrees from north, clockwise (90 = east, 180 = south, 270 = west). */
  azimuth: number;
}

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD), cos = (deg: number) => Math.cos(deg * RAD);

export function solarPosition(date: Date, { latitude, longitude } = LONDON_ON): SunAngles {
  const t = (date.getTime() / 86_400_000 - 10_957.5) / 36_525; // Julian centuries from J2000.0
  const meanLong = 280.46646 + t * (36000.76983 + t * 0.0003032);
  const anomaly = 357.52911 + t * (35999.05029 - t * 0.0001537);
  const ecc = 0.016708634 - t * (0.000042037 + t * 0.0000001267);
  const center = sin(anomaly) * (1.914602 - t * (0.004817 + t * 0.000014)) + sin(2 * anomaly) * (0.019993 - t * 0.000101) + sin(3 * anomaly) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLong = meanLong + center - 0.00569 - 0.00478 * sin(omega);
  const obliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * cos(omega);
  const decl = Math.asin(sin(obliquity) * sin(apparentLong)) / RAD;
  const y = Math.tan(obliquity / 2 * RAD) ** 2;
  const eqTime = 4 / RAD * (y * sin(2 * meanLong) - 2 * ecc * sin(anomaly) + 4 * ecc * y * sin(anomaly) * cos(2 * meanLong)
    - 0.5 * y * y * sin(4 * meanLong) - 1.25 * ecc * ecc * sin(2 * anomaly)); // minutes
  const utcMinutes = (((date.getTime() / 60_000) % 1440) + 1440) % 1440;
  const hourAngle = (utcMinutes + eqTime + 4 * longitude) / 4 - 180;
  const elevation = Math.asin(sin(latitude) * sin(decl) + cos(latitude) * cos(decl) * cos(hourAngle)) / RAD;
  const azimuth = Math.atan2(sin(hourAngle), cos(hourAngle) * sin(latitude) - Math.tan(decl * RAD) * cos(latitude)) / RAD + 180;
  return { elevation, azimuth: ((azimuth % 360) + 360) % 360 };
}

/** How often the light follows the sun: two minutes is about half a degree of its travel across the sky. */
export const SUN_STEP_MS = 120_000;

/**
 * A phase's preview time on a date's Toronto day (`?time=<phase>`, the
 * options menu, the static profiles): mid-dawn, 11:45 (the picked look),
 * half an hour before sunset, late night (the moon does not move).
 */
export function phaseInstant(phase: IslandPhase, date: Date, days?: readonly SunDay[] | null): Date {
  const { sunrise, sunset } = sunFor(date, days);
  const hour = { dawn: sunrise - DAWN_HOURS / 2, day: 11.75, evening: sunset - EVENING_HALF_HOURS / 2, night: 23 }[phase];
  return torontoInstant(torontoDate(date).key, hour);
}
