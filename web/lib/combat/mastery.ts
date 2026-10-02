/**
 * Mastery 1–20 per subclass (specs/classes/design-sheet.md §1.4, the build overrides): the curve, which keys,
 * ranks and the stat direction a level gives (each class's own unlock track), and the cosmetics derived from
 * the level. The curve is implemented again in 20261002181044_classes_v2.sql (combat_mastery_for_xp); a test
 * keeps them identical.
 */
export const MAX_MASTERY = 20;

/** Mastery XP from M to M+1 = 800 + 300·(M − 1). */
export const masteryToNext = (m: number) => 800 + 300 * (m - 1);

/** Total mastery XP to reach `m` from 1. */
export function xpForMastery(m: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(m, MAX_MASTERY); l++) total += masteryToNext(l);
  return total;
}

export function masteryForXp(xp: number): number {
  let m = 1;
  while (m < MAX_MASTERY && xp >= xpForMastery(m + 1)) m++;
  return m;
}

/** Where a row stands: its level, XP into it, XP the next level needs (0 at 20). */
export function masteryProgress(xp: number) {
  const mastery = masteryForXp(xp), floor = xpForMastery(mastery);
  return { mastery, xp, into: xp - floor, needed: mastery >= MAX_MASTERY ? 0 : masteryToNext(mastery) };
}

// ── Derived cosmetics (§1.4 template, identity column): never sold, never rows ──
export type Frame = "bronze" | "silver" | "gold";
export const MASTERY_COSMETICS = { bronze: 5, trim: 13, silver: 15, colour: 17, glow: 19, gold: 20 } as const;
/** The equip values combat_equip_cosmetic accepts for mastery cosmetics, and the level each needs. */
export const MASTERY_EQUIP: Record<string, { kind: "frame" | "weapon_skin" | "aura"; at: number }> = {
  "mastery:bronze": { kind: "frame", at: MASTERY_COSMETICS.bronze },
  "mastery:trim": { kind: "weapon_skin", at: MASTERY_COSMETICS.trim },
  "mastery:silver": { kind: "frame", at: MASTERY_COSMETICS.silver },
  "mastery:colour": { kind: "aura", at: MASTERY_COSMETICS.colour },
  "mastery:gold": { kind: "frame", at: MASTERY_COSMETICS.gold },
};

export function masteryCosmetics(mastery: number) {
  return {
    /** The best mastery frame reached (the nameplate shows the equipped one). */
    frame: (mastery >= 20 ? "gold" : mastery >= 15 ? "silver" : mastery >= 5 ? "bronze" : null) as Frame | null,
    /** Aura tier: 1 motes, 2 adds a soft ground ring (10), 3 a second mote type (20). */
    aura: mastery >= 20 ? 3 : mastery >= 10 ? 2 : 1,
    trim: mastery >= MASTERY_COSMETICS.trim, trimGlow: mastery >= MASTERY_COSMETICS.glow, colour: mastery >= MASTERY_COSMETICS.colour,
    mastered: mastery >= MAX_MASTERY,
  };
}

/** "Elementalist", "Adept Elementalist" at 10, "Master Elementalist" at 20. */
export const masteryTitle = (name: string, mastery: number) => (mastery >= 20 ? `Master ${name}` : mastery >= 10 ? `Adept ${name}` : name);
