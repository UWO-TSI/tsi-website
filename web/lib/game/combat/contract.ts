/**
 * Island-side combat contract (specs/combat-foundation.md). The systems agent
 * owns the rules and data (web/lib/combat/, /api/combat/*) and maps them onto
 * this shape in lib/combat/islandAdapter.ts; `data.ts` adds the presentation
 * (models, attack shapes, timings).
 */
export type WeaponKind = "melee" | "bow" | "staff" | "summon";
export interface Weapon {
  id: string; name: string; kind: WeaponKind;
  /** Seconds between attacks. */
  cooldown: number;
  /** Melee reach / projectile range, world units. */
  range: number;
  /** Melee arc (radians); projectiles use it as nothing. */
  arc: number;
  /** Projectile speed, world units/s (bow, staff). */
  speed?: number;
  maxDurability: number;
  model: string; modelScale: number;
  /** Classes v2: a tier-5 signature weapon's glow parts breathe (the trim kit's animated runes, design sheet §1.5). */
  pulse?: boolean;
  /** Socket-space Euler overrides for a model that doesn't follow its kind's grip (the revolver's barrel is +Z). */
  grip?: WeaponGrip;
  /** A shot weapon's projectile look over its kind's (classes v2: thrown cards, bone shards). */
  shot?: "arrow" | "bolt" | "card" | "bone";
}
/** In-hand, on-the-back and at-rest rotations in socket space; `off`: the off-hand part's in the other hand (classes v2 weapons with an OffHand node). */
export interface WeaponGrip { hand: [number, number, number]; back: [number, number, number]; rest?: [number, number, number]; off?: [number, number, number] }

export type EnemyKind = "wildlife" | "construct" | "boss";
/**
 * smash: a slam on a ring marker where you stood; beam: a sweep over `arc` during `active`; summon: calls rune wisps.
 * Zone 1 (specs/classes/design-sheet.md "Mobs, zone 1"): pounce, dart and charge travel `leap` u through `active` and hit
 * what they touch; lob arcs over everything and bursts where it lands; blink is no attack, a short hop away to keep range.
 */
export type AttackShape = "lunge" | "slam" | "spit" | "sweep" | "smash" | "beam" | "summon" | "pounce" | "dart" | "charge" | "lob" | "blink";
export interface EnemyAttack {
  shape: AttackShape; windup: number; recover: number; damage: number; range: number; arc: number; knockback: number;
  /** Distance at which the windup starts (default 0.8 × range). */
  reach?: number;
  /** Seconds the attack stays live after the windup (the beam's sweep). */
  active?: number;
  /** The recover is a stagger window: hits land for more. */
  stagger?: boolean;
  /** pounce, dart, charge: how far it travels during `active`; blink: how far it hops. */
  leap?: number;
  /** lob: the burst's radius where it lands; a slam with one: its shockwave runs out to this radius. */
  splash?: number;
}
/** What a mob leaves on the ground: a poison puddle, a pollen puff that slows, a slam's shockwave. Damage per tick (`every` s). */
export interface HazardDef { kind: "poison" | "pollen" | "wave"; radius: number; life: number; damage: number; every: number; slow?: number }
export interface EnemyType {
  id: string; name: string; kind: EnemyKind; level: number;
  hp: number; speed: number; radius: number;
  /** Damage reduction 0..0.8, flat armor after it, and kill XP (systems data). */
  defense: number; armor: number; xp: number; elite: boolean;
  aggroRadius: number; leashRadius: number;
  /** One for ordinary enemies; the boss and the elder crab rotate through several (sim.ts PLANS); the wisp's blink is extra. */
  attacks: EnemyAttack[];
  model: string; modelScale: number; modelYaw: number; hover: number;
  /** Turn rate in rad/s (a crab turns to face you slowly and scuttles sideways); unset turns at once. */
  turn?: number;
  /** A front shell: hits from within `arc`/2 of its facing deal `front` × damage, `cracked` × once it cracks (phase 2+). */
  shell?: { arc: number; front: number; cracked?: number };
  /** flank: a pack circles to slots around you and pounces in turn; swarm: a cloud orbits you and darts in one by one. */
  pack?: "flank" | "swarm";
  /** Keeps its range: closer than `keep` it blinks away (its `blink` attack), at most every `every` s. */
  kite?: { keep: number; every: number };
  /** What its lobs (or, for a swarm, its burst) leave on the ground. */
  hazard?: HazardDef;
  /** A mini-boss: its own health bar and name banner, and a reward roll on defeat (lib/combat/content.ts DROPS). */
  miniboss?: { title: string };
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
