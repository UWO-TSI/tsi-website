/**
 * Render tiers for the players in view (specs/multiplayer.md §5.5). Pure: the driver calls `assignLod` every
 * `LOD.every` seconds and applies what changed.
 *
 * | Tier    | High        | Light       | What it gets |
 * |---------|-------------|-------------|--------------|
 * | Full    | nearest 12  | nearest 8   | within 20 u and in the frustum: the mixer every frame, effects, aura, sun shadow |
 * | Reduced | next 12     | next 8      | within 40 u: the mixer at 15 Hz, no effects, no aura, no sun shadow |
 * | Hidden  | the rest    | the rest    | not drawn, no mixer; still interpolated, so they reappear in the right place |
 *
 * Phone resters are Reduced at most. A real player's nameplate shows within 8 u (close only, David 2026-10-08) whatever the tier (the nearest 12,
 * the pool's size), so players read as people, not residents. Hysteresis: anyone keeps a tier, aura or plate until 2 u
 * past the line that gave it, and ranks 2 u nearer than they are for the slots, so two players at the same distance
 * don't trade places every quarter second.
 */

export const FULL = 0, REDUCED = 1, HIDDEN = 2;
export type Tier = typeof FULL | typeof REDUCED | typeof HIDDEN;

export const LOD = {
  fullRange: 20,
  drawnRange: 40,
  plateRange: 8,
  hysteresis: 2,
  /** Seconds between re-tiers. */
  every: 0.25,
  /** Reduced: mixer updates a second. */
  reducedHz: 15,
  /** At most this many auras, the nearest Full players' (spec §5.6). */
  auras: 8,
  /** The nameplate pool. */
  plates: 12,
} as const;

export interface LodCaps { readonly full: number; readonly drawn: number }
/** By graphics quality: Full and drawn (Full plus Reduced). */
export const LOD_CAPS: Readonly<Record<"high" | "light", LodCaps>> = { high: { full: 12, drawn: 24 }, light: { full: 8, drawn: 16 } };

export interface LodEntry {
  /** Horizontal distance from you (world units). */
  dist: number;
  /** In the camera's frustum. */
  inView: boolean;
  /** A phone rester (FLAG.mobile). */
  phone: boolean;
  /** Has an aura to show: their "show class" is on and they have a subclass kit or a family. */
  hasAura: boolean;
  /** Written by assignLod; what they had before is its hysteresis. */
  tier: Tier;
  aura: boolean;
  plate: boolean;
}
export const createLodEntry = (): LodEntry => ({ dist: Infinity, inView: false, phone: false, hasAura: false, tier: HIDDEN, aura: false, plate: false });

/** Scratch for assignLod (no allocation at a re-tier). */
export interface LodScratch { order: Int32Array; key: Float64Array; was: Int8Array }
export const createLodScratch = (size: number): LodScratch => ({ order: new Int32Array(size), key: new Float64Array(size), was: new Int8Array(size) });

/** Sort order[0..m) by key, nearest first (insertion sort: a handful of players, a few times a second). */
function sortByKey(order: Int32Array, key: Float64Array, m: number) {
  for (let i = 1; i < m; i++) {
    const o = order[i], k = key[o];
    let j = i - 1;
    while (j >= 0 && key[order[j]] > k) { order[j + 1] = order[j]; j--; }
    order[j + 1] = o;
  }
}

/** Tiers, auras and plates for entries[0..n), in place. */
export function assignLod(entries: readonly LodEntry[], n: number, caps: LodCaps, s: LodScratch): void {
  const h = LOD.hysteresis, { order, key, was } = s;
  for (let i = 0; i < n; i++) { was[i] = entries[i].tier; entries[i].tier = HIDDEN; }
  // Full: in view, not a phone, within range; the nearest.
  let m = 0;
  for (let i = 0; i < n; i++) {
    const e = entries[i], had = was[i] === FULL ? h : 0;
    if (!e.inView || e.phone || e.dist > LOD.fullRange + had) continue;
    key[i] = e.dist - had;
    order[m++] = i;
  }
  sortByKey(order, key, m);
  const full = Math.min(m, caps.full);
  for (let k = 0; k < full; k++) entries[order[k]].tier = FULL;
  // Reduced: the next nearest within the drawn range, up to the drawn cap.
  m = 0;
  for (let i = 0; i < n; i++) {
    const e = entries[i], had = was[i] !== HIDDEN ? h : 0;
    if (e.tier === FULL || e.dist > LOD.drawnRange + had) continue;
    key[i] = e.dist - had;
    order[m++] = i;
  }
  sortByKey(order, key, m);
  const reduced = Math.min(m, Math.max(0, caps.drawn - full));
  for (let k = 0; k < reduced; k++) entries[order[k]].tier = REDUCED;
  // Auras: the nearest Full players who show one.
  m = 0;
  for (let i = 0; i < n; i++) {
    const e = entries[i];
    if (e.tier !== FULL || !e.hasAura) { e.aura = false; continue; }
    key[i] = e.dist - (e.aura ? h : 0);
    order[m++] = i;
  }
  sortByKey(order, key, m);
  for (let k = 0; k < m; k++) entries[order[k]].aura = k < LOD.auras;
  // Plates: every drawn player within range, the nearest the pool holds.
  m = 0;
  for (let i = 0; i < n; i++) {
    const e = entries[i], had = e.plate ? h : 0;
    if (e.tier === HIDDEN || e.dist > LOD.plateRange + had) { e.plate = false; continue; }
    key[i] = e.dist - had;
    order[m++] = i;
  }
  sortByKey(order, key, m);
  for (let k = 0; k < m; k++) entries[order[k]].plate = k < LOD.plates;
}
