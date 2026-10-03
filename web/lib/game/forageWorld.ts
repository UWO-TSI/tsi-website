/**
 * What a member's foraging leaves lying in the world (specs/polish/forage-craft-museum.md): fruit and branches shaken
 * down and not yet picked up, and which of a tree's hanging fruit fell this hour. Resources are personal (row 83):
 * each player shakes, digs and picks their own instance of a node, so this is this player's, kept for the session
 * (a scene change or walking off and back finds it where it fell) and, for the fallen fruit, the hour.
 */
export interface XYZ { x: number; y: number; z: number }
/** Something lying on the ground waiting to be picked up: where it fell from, when (world second), and where it rests. */
export interface Drop {
  nodeId: string; key: string; kind: "fruit" | "branch"; hour: string;
  /** The hang point it fell from (fruit), or -1 (a branch). */
  k: number;
  from: XYZ; rest: { x: number; z: number }; groundY: number; t0: number;
  /** The way a branch lies once it has rolled to rest (radians about +y). */
  yaw: number;
}
const drops = new Map<string, Drop>();
const listeners = new Set<() => void>();
let version = 0;
const publish = () => { version++; listeners.forEach(l => l()); };

/** This hour's drops (older ones were never picked up and are gone with their hour). */
export function dropsFor(hour: string): Drop[] {
  for (const [id, d] of drops) if (d.hour !== hour) drops.delete(id);
  return [...drops.values()];
}
export const dropOf = (nodeId: string, hour: string): Drop | null => { const d = drops.get(nodeId); return d && d.hour === hour ? d : null; };
export function addDrop(d: Drop) { drops.set(d.nodeId, d); publish(); }
export function removeDrop(nodeId: string) { if (drops.delete(nodeId)) publish(); }
/** For useSyncExternalStore: changes when a drop lands or is taken. */
export const dropsVersion = () => version;
export function subscribeDrops(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

// ── Which hang point fell, for the hour ─────────────────────────────────────
const FALLEN_KEY = "tsi.forage.fallen.v1";
function readFallen(): Record<string, [string, number]> {
  try { return JSON.parse(localStorage.getItem(FALLEN_KEY) ?? "{}") as Record<string, [string, number]>; } catch { return {}; }
}
/** The hang point that fell from this tree's fruit node this hour (-1: none known). */
export function fallenOf(nodeId: string, hour: string): number {
  const d = drops.get(nodeId);
  if (d && d.hour === hour && d.k >= 0) return d.k;
  const saved = readFallen()[nodeId];
  return saved && saved[0] === hour ? saved[1] : -1;
}
export function setFallen(nodeId: string, hour: string, k: number) {
  const all = Object.fromEntries(Object.entries(readFallen()).filter(([, v]) => v[0] === hour));
  all[nodeId] = [hour, k];
  try { localStorage.setItem(FALLEN_KEY, JSON.stringify(all)); } catch { /* this session only */ }
}

/** Test seam: forget everything. */
export function resetForageWorld() { drops.clear(); holes.length = 0; publish(); }

// ── Dug holes, filling back in ──────────────────────────────────────────────
/** A hole dug at a find: where, and the world second the spade went in. It fills back in over HOLE_FILL seconds. */
export interface Hole { id: string; x: number; y: number; z: number; t0: number }
/** Seconds a dug hole takes to fill back in (its decal steps through the pack's 8 frames: fresh, then filling). */
export const HOLE_FILL = 90;
/** Its last share fades out, so the patch never pops away. */
const HOLE_FADE = 0.18;
const holes: Hole[] = [];
/** At most this many at once (the oldest fills first). */
export const MAX_HOLES = 12;

/** The hole decal's frame `age` seconds after digging: 0 fresh, rising to 7 as it fills; -1 once it's gone. */
export function holeFrame(age: number): number {
  if (age < 0 || age >= HOLE_FILL) return -1;
  return Math.min(7, Math.floor((age / HOLE_FILL) * 8));
}
/** Its opacity: full, then easing out over the last HOLE_FADE of the fill. */
export function holeOpacity(age: number): number {
  if (age < 0 || age >= HOLE_FILL) return 0;
  const u = (age / HOLE_FILL - (1 - HOLE_FADE)) / HOLE_FADE;
  return u <= 0 ? 1 : 1 - u * u * (3 - 2 * u);
}
/** Dig a hole (the spade's contact). */
export function addHole(h: Hole) {
  const i = holes.findIndex(o => o.id === h.id);
  if (i >= 0) holes.splice(i, 1);
  holes.push(h);
  if (holes.length > MAX_HOLES) holes.shift();
  publish();
}
/** The holes dug and not yet forgotten (a filled one draws nothing: holeFrame -1). */
export const holesNow = (): readonly Hole[] => holes;
/** Forget the holes filled by world second `t` (from a timer, never the frame loop: it tells the store's readers). */
export function pruneHoles(t: number) {
  let gone = false;
  for (let i = holes.length - 1; i >= 0; i--) if (holeFrame(t - holes[i].t0) < 0) { holes.splice(i, 1); gone = true; }
  if (gone) publish();
}
