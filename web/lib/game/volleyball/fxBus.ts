/**
 * The match's effects and sounds (David's approved plan, 2026-10-30: 15 effects, each contact in four timing grades),
 * fed from the match's events. VolleyMatch emits here; the effects (VolleyFx.tsx, VolleyStamps.tsx) and the sounds
 * (sfx.ts) drain or listen. The camera and time requests an effect makes (a shake, a zoom punch, a hit-stop, a slow-mo
 * beat) sit in `cam`, read and eased by VolleyMatch. Only the player in a match has any of it. Pure, no three.js.
 */
import type { ContactKind, Timing } from "./match";
import type { Team } from "./rules";

/** Positions are in the court's frame (court.ts); `who` is a player index (0 is you). */
export type VbFx =
  | { kind: "contact"; who: number; team: Team; how: ContactKind; timing: Timing; quality: number; x: number; y: number; z: number; speed: number }
  | { kind: "land"; x: number; z: number; in: boolean; speed: number; heat: number }
  | { kind: "net"; x: number; y: number } | { kind: "tape"; x: number; y: number }
  | { kind: "takeoff"; who: number; x: number; y: number; z: number } | { kind: "touchdown"; who: number; x: number; y: number; z: number }
  | { kind: "dive"; who: number; strong: boolean; x: number; z: number; dx: number; dz: number }
  | { kind: "toss"; who: number; power: number; max: boolean }
  | { kind: "whiff"; who: number }
  | { kind: "point"; team: Team; why: string; x: number; z: number; heat: number }
  | { kind: "win"; team: Team }
  | { kind: "call"; who: number };

export const fxBus = {
  queue: [] as VbFx[],
  /** Camera and time requests (VolleyMatch eases them back): shake 0..1, zoom punch (FOV degrees), hit-stop and slow-mo (s). */
  cam: { shake: 0, punch: 0, stop: 0, slow: 0, slowScale: 0.35 },
  listeners: new Set<(e: VbFx) => void>(),
};

export function emitFx(e: VbFx) {
  fxBus.queue.push(e);
  if (fxBus.queue.length > 64) fxBus.queue.splice(0, fxBus.queue.length - 64);
  fxBus.listeners.forEach(l => l(e));
}

/** Take everything emitted since the last drain (one consumer: the 3D effects). */
export function drainFx(): VbFx[] {
  const q = fxBus.queue;
  fxBus.queue = [];
  return q;
}

/** Listen (the sounds, the HUD stamps); returns the unsubscribe. */
export function onFx(l: (e: VbFx) => void) {
  fxBus.listeners.add(l);
  return () => { fxBus.listeners.delete(l); };
}

/** Ask for a camera or time beat: the strongest request wins until it eases out. */
export function camBeat(b: Partial<Omit<typeof fxBus.cam, "slowScale">> & { slowScale?: number }) {
  const c = fxBus.cam;
  if (b.shake) c.shake = Math.max(c.shake, b.shake);
  if (b.punch) c.punch = Math.max(c.punch, b.punch);
  if (b.stop) c.stop = Math.max(c.stop, b.stop);
  if (b.slow) { c.slow = Math.max(c.slow, b.slow); c.slowScale = b.slowScale ?? c.slowScale; }
}
