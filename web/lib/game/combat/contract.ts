/**
 * Island-side combat contract (specs/combat-foundation.md). The systems agent
 * owns the rules and data (web/lib/combat/, /api/combat/*) and maps them onto
 * this shape in lib/combat/islandAdapter.ts; `data.ts` adds the presentation
 * (models, attack shapes, timings).
 */
export type WeaponKind = "melee" | "bow" | "staff" | "summon";
export interface Weapon {
  id: string; name: string; kind: WeaponKind; tier: number;
  /** Base damage per hit before stats. */
  damage: number;
  /** Seconds between attacks. */
  cooldown: number;
  /** Melee reach / projectile range, world units. */
  range: number;
  /** Melee arc (radians); projectiles use it as nothing. */
  arc: number;
  /** Projectile speed, world units/s (bow, staff). */
  speed?: number;
  durability: number; maxDurability: number;
  model: string; modelScale: number;
  /** Socket-space Euler overrides for a model that doesn't follow its kind's grip (the revolver's barrel is +Z). */
  grip?: WeaponGrip;
}
export interface WeaponGrip { hand: [number, number, number]; back: [number, number, number]; rest?: [number, number, number] }

export type EnemyKind = "wildlife" | "construct" | "boss";
/** smash: a slam on a ring marker where you stood; beam: a sweep over `arc` during `active`; summon: calls rune wisps. */
export type AttackShape = "lunge" | "slam" | "spit" | "sweep" | "smash" | "beam" | "summon";
export interface EnemyAttack {
  shape: AttackShape; windup: number; recover: number; damage: number; range: number; arc: number; knockback: number;
  /** Distance at which the windup starts (default 0.8 × range). */
  reach?: number;
  /** Seconds the attack stays live after the windup (the beam's sweep). */
  active?: number;
  /** The recover is a stagger window: hits land for more. */
  stagger?: boolean;
}
export interface EnemyType {
  id: string; name: string; kind: EnemyKind; level: number;
  hp: number; speed: number; radius: number;
  /** Damage reduction 0..0.8, flat armor after it, and kill XP (systems data). */
  defense: number; armor: number; xp: number; elite: boolean;
  aggroRadius: number; leashRadius: number;
  /** One for ordinary enemies; the boss rotates through several (sim.ts BOSS_PLAN). */
  attacks: EnemyAttack[];
  model: string; modelScale: number; modelYaw: number; hover: number;
}

export type MissionTemplate = "hunt" | "fetch" | "survive" | "escort";
export interface MissionDef {
  id: string; template: MissionTemplate; title: string; blurb: string; zone: "outer" | "inner" | "boss"; difficulty: number;
  params: { enemy?: string; count?: number; item?: string; waves?: number; escortee?: string };
  reward: { coins: number; xp: number; materials: Record<string, number> };
}

export type IncantationOutcome = "fail" | "normal" | "enhanced";
export interface IncantationScore {
  accuracy: number; coverage: number; deviation: number; order: number; scribble: boolean; outcome: IncantationOutcome;
  /** Effect multiplier the spell applies (0 on fail). */
  power: number;
}

export interface CombatProgression { level: number; family: string | null; subclass: string | null; gateOpen: boolean; reason: string | null }
