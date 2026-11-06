/**
 * Development only: the sky-ambient lane's switches (specs/sky-ambient.md). Nothing here ships: in
 * production `SKY_LAB` is off whatever the URL says, and every consumer keeps today's path.
 *
 * - `?amb=motes`: golden hour's motes at any hour (AmbienceFX GoldenMotes; the world bench prices them).
 * - `?skytilt=<deg>` tilts the view up for sky shots; `?skyface=sun|moon` turns the orbit toward it.
 *
 * At run time `window.__sky` swaps these, moves the clock and the view, so a shoot keeps one page load per weather.
 */
import { useSyncExternalStore } from "react";

export const SKY_LAB = process.env.NODE_ENV !== "production";

export type AmbientKey = "motes";

export interface SkyLabState {
  amb: ReadonlySet<AmbientKey>;
  /** Degrees the view tilts up, after the follow camera. */
  tilt: number;
  face: "sun" | "moon" | null;
}

const AMB: readonly string[] = ["motes"];

export function parseSkyLab(search: string): SkyLabState {
  const q = new URLSearchParams(search), face = q.get("skyface");
  return {
    amb: new Set((q.get("amb") ?? "").split(",").filter(k => AMB.includes(k)) as AmbientKey[]),
    tilt: Number(q.get("skytilt")) || 0,
    face: face === "sun" || face === "moon" ? face : null,
  };
}

const OFF: SkyLabState = { amb: new Set(), tilt: 0, face: null };
let state: SkyLabState = SKY_LAB && typeof window !== "undefined" ? parseSkyLab(window.location.search) : OFF;
const listeners = new Set<() => void>();
export const skyLab = () => state;
export function setSkyLab(next: Partial<SkyLabState>): void {
  if (!SKY_LAB) return;
  state = { ...state, ...next };
  for (const l of listeners) l();
}
export const skyLabOn = () => SKY_LAB && (state.amb.size > 0 || state.tilt !== 0 || state.face !== null);
export const useSkyLab = (): SkyLabState =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, skyLab, skyLab);
