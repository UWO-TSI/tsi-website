/**
 * XP, levels and stat points (rows 11, 23, 38, 207, 230). Placeholder numbers;
 * the same curve is implemented in 20260926150800_combat.sql (combat_level_for_xp) and a
 * test keeps them identical.
 *
 * XP to go from level L to L+1 = 100·L + 25·L². Level 10 (subclass choice,
 * ruins gate) needs 11,625 XP ≈ 29 ordinary sessions of ~400 XP, or fewer
 * with club events (2,000 XP each ≈ five sessions, row 23). Cap 50.
 */
export const MAX_LEVEL = 50;
export const SUBCLASS_LEVEL = 10;
export const POINTS_PER_LEVEL = 3;
export const SESSION_XP = 400; // an ordinary play session, for balancing only
export const EVENT_XP = 2000; // an in-person club event (QR check-in)
export const STAT_RESET_FEE = 200; // coins, at the Oracle (row 38)
export const SUBCLASS_RESPEC_FEE = 250;

export const xpToNext = (level: number) => 100 * level + 25 * level * level;

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) total += xpToNext(l);
  return total;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = level >= MAX_LEVEL ? null : xpForLevel(level + 1);
  return { level, xp, into: xp - floor, needed: next === null ? 0 : next - floor, next_level_at: next };
}

// ── Stats ───────────────────────────────────────────────────────────────────
export const STATS = ["might", "finesse", "arcana", "spirit", "vitality"] as const;
export type Stat = (typeof STATS)[number];
export type StatBlock = Record<Stat, number>;
export const ZERO_STATS: StatBlock = { might: 0, finesse: 0, arcana: 0, spirit: 0, vitality: 0 };
export const STAT_LABEL: Record<Stat, string> = { might: "Might", finesse: "Finesse", arcana: "Arcana", spirit: "Spirit", vitality: "Vitality" };

export const pointsEarned = (level: number) => (Math.min(level, MAX_LEVEL) - 1) * POINTS_PER_LEVEL;
export const pointsSpent = (s: StatBlock) => STATS.reduce((n, k) => n + s[k], 0);

/** Recommended presets per family (row 38); only a suggestion, any build is allowed (row 31). */
export const FAMILY_PRESETS: Record<string, Record<Stat, number>> = {
  Arcane: { might: 0, finesse: 1, arcana: 5, spirit: 2, vitality: 2 },
  Ranger: { might: 1, finesse: 5, arcana: 0, spirit: 1, vitality: 3 },
  Vanguard: { might: 5, finesse: 2, arcana: 0, spirit: 0, vitality: 3 },
  Warden: { might: 0, finesse: 1, arcana: 2, spirit: 5, vitality: 2 },
};

export type AllocationCheck = { ok: true; stats: StatBlock } | { ok: false; error: string };

/** Add points on top of the current allocation. Removing points needs a (paid) reset. */
export function allocate(current: StatBlock, add: Partial<Record<string, unknown>>, level: number): AllocationCheck {
  const next = { ...current };
  for (const [k, v] of Object.entries(add)) {
    if (!STATS.includes(k as Stat)) return { ok: false, error: `Unknown stat ${k}.` };
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return { ok: false, error: "Points are whole numbers, 0 or more." };
    next[k as Stat] += v;
  }
  if (pointsSpent(next) > pointsEarned(level)) return { ok: false, error: `You have ${pointsEarned(level) - pointsSpent(current)} points to spend.` };
  return { ok: true, stats: next };
}

/** Preset allocation: spread the member's available points by the family weights. */
export function presetAllocation(family: string, level: number): StatBlock {
  const w = FAMILY_PRESETS[family] ?? FAMILY_PRESETS.Vanguard;
  const total = pointsEarned(level);
  const sum = STATS.reduce((n, k) => n + w[k], 0);
  const out = { ...ZERO_STATS };
  let given = 0;
  for (const k of STATS) {
    out[k] = Math.floor((total * w[k]) / sum);
    given += out[k];
  }
  // Remainders go to the family's main stat first.
  const order = [...STATS].sort((a, b) => w[b] - w[a]);
  for (let i = 0; given < total; i++, given++) out[order[i % order.length]] += 1;
  return out;
}

/** Derived character numbers (placeholders); `mods` are the subclass kit's (kits.ts: the Assassin's speed and frailty, extra summon capacity). */
export function derived(stats: StatBlock, level: number, mods: { max_hp?: number; speed?: number; capacity?: number } = {}) {
  return {
    max_hp: Math.round((100 + level * 12 + stats.vitality * 15) * (1 + (mods.max_hp ?? 0))),
    energy: 100 + stats.arcana * 3 + stats.spirit * 3,
    crit_chance: Math.min(0.5, 0.05 + stats.finesse * 0.006),
    summon_capacity: 2 + Math.floor(stats.spirit / 5) + (mods.capacity ?? 0), // row 43
    move_speed: (1 + Math.min(0.25, stats.finesse * 0.004)) * (1 + (mods.speed ?? 0)),
  };
}
