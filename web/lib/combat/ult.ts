/**
 * The ult meter (design sheet §1.2): 0–100, filled from your own dealt, taken, healed and shielded, scaled by the
 * kit's `charge` (0.8–1.25, set from the harness so every subclass fills in 60–90 s of fighting). Player state built
 * from that player's own events, so a server can rebuild it from the event stream once combat is authoritative.
 */
export const ULT = {
  max: 100,
  /** Points per hit landed: 0.7 × raw ÷ your base hit, at most 6 a hit (raw is before enemy defense and armour, so the armoured boss never starves it). */
  dealt: 0.7, dealtCap: 6,
  /** Per 100% of your max HP aimed at you, counted before guard, block and shield (blocking never costs charge). */
  taken: 40,
  /** Per 100% of the target's max HP actually restored or absorbed by a shield (overheal and unused shield charge nothing). */
  healed: 50,
  /** F is buffered like the slots. */
  buffer: 0.15,
  /** The caster's i-frames run from the press to this long after the freeze ends (§1.2 Protection; §1.6 freeze 120 ms). */
  iframesAfterFreeze: 0.2,
} as const;

/** A hit you or your units land; ult hits charge nothing (the caller passes none). */
export const dealtCharge = (raw: number, baseHit: number, charge = 1) => (baseHit > 0 ? Math.min(ULT.dealtCap, (ULT.dealt * raw) / baseHit) * charge : 0);
export const takenCharge = (amount: number, maxHp: number, charge = 1) => (maxHp > 0 ? ((ULT.taken * amount) / maxHp) * charge : 0);
export const healedCharge = (restored: number, maxHp: number, charge = 1) => (maxHp > 0 ? ((ULT.healed * restored) / maxHp) * charge : 0);
/** Add points; full is full (further charge is lost). */
export const addCharge = (meter: number, points: number) => Math.min(ULT.max, Math.max(0, meter + points));
export const ultReady = (meter: number) => meter >= ULT.max;

/** Why F does nothing right now, or null when the ult may start. */
export function ultBlock(s: { meter: number; alive: boolean; safe: boolean; drawing: boolean; signature: boolean; active: boolean }): "charging" | "down" | "safe" | "drawing" | "weapon" | "active" | null {
  if (!s.alive) return "down";
  if (s.active) return "active";
  if (s.meter < ULT.max) return "charging";
  if (s.safe) return "safe";
  if (s.drawing) return "drawing";
  if (!s.signature) return "weapon";
  return null;
}
