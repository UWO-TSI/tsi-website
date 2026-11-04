/**
 * Development only: the sky-ambient lane's round 1 pitch switches (specs/sky-ambient.md). Nothing here ships: in
 * production `SKY_LAB` is off whatever the URL says, and every consumer keeps today's path.
 *
 * - `?sky=A|B|C`: a sky direction on the dome (A painted, finished; B toon; C storybook). Absent: today's dome.
 * - `?wind=calm|breeze|storm`: the shared wind pitch (one direction, strength and slow gusts) driving the grass, the
 *   trees, the clouds and the loose particles together. Absent: today's separate winds.
 * - `?amb=motes,swirls`: the ambient effects built for the pitch (light motes, wind swirls). Shooting stars come with
 *   every sky direction at night.
 * - `?skytilt=<deg>` tilts the view up for sky shots; `?skyface=sun|moon` turns the orbit toward it.
 *
 * At run time `window.__sky` swaps the direction, the wind and the effects, moves the clock and the view, so a shoot
 * keeps one page load per weather.
 */
import { useSyncExternalStore } from "react";

export const SKY_LAB = process.env.NODE_ENV !== "production";

export type SkyDirection = "A" | "B" | "C";
export type WindLevel = "calm" | "breeze" | "storm";
export type AmbientKey = "motes" | "swirls";

export interface SkyLabState {
  sky: SkyDirection | null;
  wind: WindLevel | null;
  amb: ReadonlySet<AmbientKey>;
  /** Degrees the view tilts up, after the follow camera. */
  tilt: number;
  face: "sun" | "moon" | null;
}

const DIRECTIONS: readonly string[] = ["A", "B", "C"], LEVELS: readonly string[] = ["calm", "breeze", "storm"], AMB: readonly string[] = ["motes", "swirls"];

export function parseSkyLab(search: string): SkyLabState {
  const q = new URLSearchParams(search), sky = q.get("sky") ?? "", wind = q.get("wind") ?? "", face = q.get("skyface");
  return {
    sky: DIRECTIONS.includes(sky) ? sky as SkyDirection : null,
    wind: LEVELS.includes(wind) ? wind as WindLevel : null,
    amb: new Set((q.get("amb") ?? "").split(",").filter(k => AMB.includes(k)) as AmbientKey[]),
    tilt: Number(q.get("skytilt")) || 0,
    face: face === "sun" || face === "moon" ? face : null,
  };
}

const OFF: SkyLabState = { sky: null, wind: null, amb: new Set(), tilt: 0, face: null };
let state: SkyLabState = SKY_LAB && typeof window !== "undefined" ? parseSkyLab(window.location.search) : OFF;
const listeners = new Set<() => void>();
export const skyLab = () => state;
export function setSkyLab(next: Partial<SkyLabState>): void {
  if (!SKY_LAB) return;
  state = { ...state, ...next };
  for (const l of listeners) l();
}
export const skyLabOn = () => SKY_LAB && (state.sky !== null || state.wind !== null || state.amb.size > 0 || state.tilt !== 0 || state.face !== null);
export const useSkyLab = (): SkyLabState =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, skyLab, skyLab);

// ─── The shared wind pitch ───────────────────────────────────────────────
/** Base strength per level: 1 is today's clear-day grass sway. */
export const WIND_LEVEL: Record<WindLevel, number> = { calm: 0.35, breeze: 1, storm: 3 };

/**
 * Slow gusts on the world clock, 0..1: three incommensurate swells, so the field breathes rather than pulses, and every
 * client with a correct clock sees the same gust at the same moment.
 */
export function gustAt(t: number): number {
  const g = Math.sin(t * 0.23) + 0.6 * Math.sin(t * 0.57 + 1.3) + 0.3 * Math.sin(t * 1.7 + 0.4);
  return 0.5 + 0.5 * (g / 1.9);
}

export interface SharedWind { dirX: number; dirZ: number; strength: number; gust: number }

/** The wind at world time `t`: today's prevailing direction veering a few degrees, the level's strength times its gusts. */
export function sharedWindAt(level: WindLevel, t: number, out: SharedWind): SharedWind {
  const a = 0.35 + 0.22 * Math.sin(t * 0.031), gust = gustAt(t), gustiness = level === "calm" ? 0.3 : level === "breeze" ? 0.6 : 0.9;
  out.dirX = Math.cos(a);
  out.dirZ = Math.sin(a);
  out.gust = gust;
  out.strength = WIND_LEVEL[level] * (1 - gustiness * 0.5 + gustiness * gust);
  return out;
}

/** What GrassField and the tree sway read while the wind pitch is on (scale 1 and today's direction when off). */
export const WIND_LAB = { on: false, grass: 1, dirX: Math.cos(0.35), dirZ: Math.sin(0.35) };

/** The moon's age as a share of the synodic month (0 new, 0.5 full), from a known new moon (2000-01-06 18:14 UTC). */
export function moonPhase(epochMs: number): number {
  const days = (epochMs - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000, m = days / 29.530588853;
  return m - Math.floor(m);
}
