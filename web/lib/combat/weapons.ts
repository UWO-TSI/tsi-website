/**
 * Weapons, damage and durability (rows 12, 31, 140, 229). Any family can use
 * any weapon; the weapon's scaling stat decides how well (row 31).
 * Mirrored as seed rows in 035_combat.sql (weapons).
 */
import type { Stat, StatBlock } from "./progression";

export type WeaponType = "sword" | "shield" | "bow" | "revolver" | "staff" | "tome" | "fists" | "totem";
export interface WeaponDef {
  key: string;
  name: string;
  type: WeaponType;
  tier: 1 | 2 | 3 | 4 | 5;
  scaling: Stat[]; // primary first
  max_durability: number;
  repair_per_point: number; // coins per durability point
}

export const TIER_BASE: Record<number, number> = { 1: 10, 2: 14, 3: 19, 4: 25, 5: 32 };
const W = (key: string, name: string, type: WeaponType, tier: WeaponDef["tier"], scaling: Stat[]): WeaponDef => ({
  key, name, type, tier, scaling, max_durability: 60 + tier * 30, repair_per_point: tier,
});

export const WEAPONS: WeaponDef[] = [
  W("sword-driftwood", "Driftwood sword", "sword", 1, ["might"]),
  W("sword-iron", "Iron sword", "sword", 2, ["might"]),
  W("shield-buckler", "Buckler and blade", "shield", 1, ["might", "vitality"]),
  W("bow-willow", "Willow bow", "bow", 1, ["finesse"]),
  W("bow-yew", "Yew longbow", "bow", 2, ["finesse"]),
  W("revolver-brass", "Brass revolver", "revolver", 2, ["finesse"]),
  W("staff-oak", "Oak staff", "staff", 1, ["arcana"]),
  W("staff-rune", "Rune staff", "staff", 3, ["arcana"]),
  W("tome-spirits", "Tome of small spirits", "tome", 1, ["spirit"]),
  W("totem-cedar", "Cedar totem", "totem", 1, ["spirit"]),
  W("wraps-cloth", "Cloth hand wraps", "fists", 1, ["might", "finesse"]),
];

/** Durability ≤ 0: the weapon still works at half damage until repaired (defeat never deletes gear). */
export const BROKEN_DAMAGE_MULT = 0.5;
export const WEAR_PER_HIT = 1;
export const DEFEAT_WEAR_FRACTION = 0.1; // row 229: defeat costs durability only, no coins
export const ENHANCED_MULT = 1.5;

export interface HitInput {
  weapon: WeaponDef;
  durability: number;
  stats: StatBlock;
  level: number;
  enemyDefense: number; // 0..0.8 damage reduction
  crit?: boolean;
  critMult?: number;
  potency?: number; // abilities / incantations: 0.5..1.5
}

/**
 * damage = tier base × (1 + 2.5%·primary + 1%·secondary) × (1 + 1%·level)
 *          × potency × crit × (1 − defense) × (broken ? 0.5 : 1), at least 1.
 */
export function damage(h: HitInput): number {
  const [p, s] = h.weapon.scaling;
  const statMult = 1 + 0.025 * h.stats[p] + (s ? 0.01 * h.stats[s] : 0);
  const raw = TIER_BASE[h.weapon.tier] * statMult * (1 + 0.01 * h.level) * (h.potency ?? 1) * (h.crit ? (h.critMult ?? 1.75) : 1);
  const afterDef = raw * (1 - Math.min(0.8, Math.max(0, h.enemyDefense)));
  return Math.max(1, Math.round(afterDef * (h.durability <= 0 ? BROKEN_DAMAGE_MULT : 1)));
}

/** Wear from an encounter: 1 per landed hit, plus 10% of max on defeat. Never below 0. */
export function wear(weapon: WeaponDef, durability: number, hits: number, defeated: boolean): number {
  const loss = Math.max(0, Math.floor(hits)) * WEAR_PER_HIT + (defeated ? Math.ceil(weapon.max_durability * DEFEAT_WEAR_FRACTION) : 0);
  return Math.max(0, durability - loss);
}

export function repairCost(weapon: WeaponDef, durability: number): number {
  return Math.max(0, weapon.max_durability - durability) * weapon.repair_per_point;
}
