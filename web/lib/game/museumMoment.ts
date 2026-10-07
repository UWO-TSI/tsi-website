/**
 * A donation reaching its case (specs/polish/forage-craft-museum.md 8): the curator takes it at her desk, and the
 * specimen fades into its case or tank across the room, growing into place with a little settle, while the camera
 * looks over and a sparkle marks it. Which species was just donated (and when) is kept here for its case to find.
 */
import type { Material, Mesh, Object3D } from "three";

/** How long the specimen takes to fade in (ms). */
export const DONATE_FADE_MS = 1500;
/** How long the camera looks toward it (ms). */
export const DONATE_LOOK_MS = 2800;
/** How long a just-donated specimen waits for its model to load before it simply shows (ms): later, as it is. */
export const SETTLE_WAIT_MS = 4000;

const donated = new Map<string, number>();
/** A species was just donated, at `at` (performance.now()). */
export function markDonated(key: string, at: number) { donated.set(key, at); }
/** When it was donated this session, or null. */
export const donatedAt = (key: string | null): number | null => (key ? donated.get(key) ?? null : null);

/**
 * The specimen `t` ms into its fade: opacity 0 to 1, a scale that grows past full and settles, and a small rise into
 * place. Past the fade (or never donated here): solid and still.
 */
export function fadeInto(t: number, out = { opacity: 1, scale: 1, rise: 0 }): { opacity: number; scale: number; rise: number } {
  if (!(t < DONATE_FADE_MS)) { out.opacity = 1; out.scale = 1; out.rise = 0; return out; }
  const u = Math.max(0, t / DONATE_FADE_MS);
  const grow = 1 - (1 - u) ** 3;
  out.opacity = Math.min(1, u * 1.6);
  out.scale = 0.6 + 0.4 * grow + 0.08 * Math.sin(u * Math.PI) * (1 - u);
  out.rise = -0.12 * (1 - grow);
  return out;
}

/** One case's settle: the donation it is for, when its fade started (-1 not yet), whether it's over, its own materials. */
export interface Settle { at: number; start: number; done: boolean; mats: Material[] | null }
export const newSettle = (): Settle => ({ at: -1, start: -1, done: false, mats: null });

const _fade = { opacity: 1, scale: 1, rise: 0 };
const _probe = { meshes: 0, mats: null as Material[] | null };
function countMesh(o: Object3D) { if ((o as Mesh).isMesh) _probe.meshes++; }
/** Its own materials (clones: the model's are shared with every other copy of it), so it can fade alone. */
function ownMaterials(o: Object3D) {
  const m = o as Mesh;
  if (!m.isMesh) return;
  m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
  if (Array.isArray(m.material)) for (let i = 0; i < m.material.length; i++) _probe.mats!.push(m.material[i]);
  else _probe.mats!.push(m.material);
}
/**
 * One frame of a specimen settling into its case (`g`, its group in the room; `at`, its donation, donatedAt): hidden
 * until its model has loaded, then faded in on its own materials, growing into place, with `start` (the camera's look,
 * the sparkle, the chime) once as it begins. One donated before this visit (or whose model never came) just shows. No
 * allocation after the start.
 */
export function settleStep(g: Object3D, at: number | null, state: Settle, now: number, start: () => void): void {
  if (at === null) return;
  if (at !== state.at) { state.at = at; state.start = -1; state.done = false; state.mats = null; }
  if (state.done) return;
  if (state.start < 0) {
    if (now - at > SETTLE_WAIT_MS) { g.scale.setScalar(1); g.position.y = 0; state.done = true; return; }
    _probe.meshes = 0;
    g.traverse(countMesh);
    if (!_probe.meshes) { g.scale.setScalar(0.001); return; }
    state.start = now;
    state.mats = _probe.mats = [];
    g.traverse(ownMaterials);
    _probe.mats = null;
    start();
  }
  const t = now - state.start, f = fadeInto(t, _fade), mats = state.mats!;
  if (t >= DONATE_FADE_MS) state.done = true;
  for (let i = 0; i < mats.length; i++) { const m = mats[i]; m.transparent = f.opacity < 1; m.opacity = f.opacity; m.depthWrite = f.opacity >= 1; }
  g.scale.setScalar(f.scale);
  g.position.y = f.rise;
}
