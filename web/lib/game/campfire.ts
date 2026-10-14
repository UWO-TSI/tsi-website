/**
 * The beach campfire (specs/v1-drop.md §3): lit every real night on the shared world clock. Sitting near it seats you
 * in a ring facing the fire with your hands to the warmth; dancing near it turns into our own joyful stomp dance
 * circling the fire, for up to eight. Each dancer adds a drum layer (six unique CC0 loops, public/audio/CREDITS.md),
 * six play the full song, and every dancer makes the fire bigger and brighter. Pure: the scene (components/game/
 * campfire/Campfire.tsx), the emote wheel and the bots share it.
 *
 * Where it is: the map's `campfire` object when the map has one; until the island's painter places it, the open sand
 * nearest the `beach` landmark with room for the ring (campfireSite).
 */
import type { IslandPhase } from "./islandTime";

export const FIRE = {
  /** The sit ring (world units) and its seats. */
  sitRadius: 2.1, sitSlots: 8,
  /** The dance ring and its places, turning once every ringPeriodS on the world clock. */
  danceRadius: 2.9, danceSlots: 8, ringPeriodS: 36,
  /** Up to this many dancers. */
  maxDancers: 8,
  /** Within this of the fire, sitting and dancing join its rings. */
  joinRadius: 6,
  /** A slot this close to someone is taken. */
  takenRadius: 0.75,
  /** The drum song is heard out to this far, full within `drumNear`. */
  drumFar: 26, drumNear: 7,
} as const;

/**
 * The drum song's six layers, in the order dancers add them: each a CC0 loop at 120 BPM, 4 or 8 s (whole bars), cut
 * and levelled from its source (public/audio/CREDITS.md has each one's source and licence). `gain` is its place in
 * the mix.
 */
export const DRUM_LAYERS = [
  { src: "/audio/drums/taiko.ogg", gain: 0.9 },
  { src: "/audio/drums/djembe.ogg", gain: 0.75 },
  { src: "/audio/drums/bongos.ogg", gain: 0.62 },
  { src: "/audio/drums/doumbek.ogg", gain: 0.7 },
  { src: "/audio/drums/shaker.ogg", gain: 0.45 },
  { src: "/audio/drums/tambourine.ogg", gain: 0.42 },
] as const;

/** Lit every real night. */
export const fireLit = (phase: IslandPhase) => phase === "night";

/** Drum layers playing for `dancers` round the fire: one each, six at most (six play the full song). */
export const drumLayers = (dancers: number) => Math.max(0, Math.min(DRUM_LAYERS.length, Math.floor(dancers)));
/** Each layer's gain for `dancers`: the first `drumLayers` at their mix level, the rest silent. */
export function drumGains(dancers: number): number[] {
  const n = drumLayers(dancers);
  return DRUM_LAYERS.map((l, i) => (i < n ? l.gain : 0));
}

/**
 * The fire for `dancers`: its flames' size (1 alone, nearly double with eight) and its light's strength (×1 to ×2.4),
 * each dancer adding more, held from the eighth.
 */
export function fireScale(dancers: number): { size: number; light: number } {
  const n = Math.max(0, Math.min(FIRE.maxDancers, Math.floor(dancers)));
  return { size: 1 + 0.115 * n, light: 1 + 0.175 * n };
}

export interface Spot { x: number; z: number }
export interface RingPoint extends Spot { yaw: number }

/** Sit slot `k`: on the sit ring, facing the fire. */
export function sitPoint(fire: Spot, k: number): RingPoint {
  const a = (k / FIRE.sitSlots) * Math.PI * 2;
  const x = fire.x + Math.sin(a) * FIRE.sitRadius, z = fire.z + Math.cos(a) * FIRE.sitRadius;
  return { x, z, yaw: Math.atan2(fire.x - x, fire.z - z) };
}

/** Dance place `k` at world clock `clock` (s): on the dance ring, turning with the clock, facing along it. */
export function ringPoint(fire: Spot, k: number, clock: number): RingPoint {
  const a = (k / FIRE.danceSlots) * Math.PI * 2 + ((clock % FIRE.ringPeriodS) / FIRE.ringPeriodS) * Math.PI * 2;
  const x = fire.x + Math.sin(a) * FIRE.danceRadius, z = fire.z + Math.cos(a) * FIRE.danceRadius;
  // The ring turns counter-clockwise seen from above (+angle): the way ahead is the tangent (cos a, -sin a).
  return { x, z, yaw: Math.atan2(Math.cos(a), -Math.sin(a)) };
}

/** The free slot (none of `others` within takenRadius of it) nearest (x, z), or -1 when every slot is taken. */
export function freeSlot(slots: number, at: (k: number) => Spot, x: number, z: number, others: readonly Spot[]): number {
  let best = -1, bestD = Infinity;
  for (let k = 0; k < slots; k++) {
    const p = at(k);
    if (others.some(o => Math.hypot(o.x - p.x, o.z - p.z) < FIRE.takenRadius)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

/** How loud the drum song is at `d` from the fire: full within drumNear, fading to nothing at drumFar. */
export function drumDistanceGain(d: number): number {
  if (d <= FIRE.drumNear) return 1;
  if (d >= FIRE.drumFar) return 0;
  const t = (d - FIRE.drumNear) / (FIRE.drumFar - FIRE.drumNear);
  return (1 - t) * (1 - t);
}
