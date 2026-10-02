/**
 * Classes v2 (specs/classes/design-sheet.md: the LOCKED class sections and the build overrides win over §1): the
 * kit every subclass runs on behind the classes_v2 flag. Keys 1–5 are all equipped (the Elementalist uses 1–4
 * plus pair combos), an ult on F charged by the meter (ult.ts), a passive, a movement passive (ruins only), one
 * stat direction mastery raises, each class's own unlock and rank track (mastery.ts), and one signature weapon
 * type, required for the keys and the ult. Abilities are today's effect primitives (kits.ts Effect, plus momentum
 * and launch); the input layer (lib/game/combat/input.ts) reads `input`, the FX registry `vfx`, the mixer `clip`.
 *
 * Family waves add their kits to CLASS_KITS; today's kits (kits.ts) stay live until wave 5.
 */
import type { Family } from "@/lib/oracle/engine";
import type { Ability, Effect, Passive } from "./kits";
import { DEMO_KIT } from "./demoKit";

export type Role = "tank" | "healer" | "damage" | "support";
/** Future co-op threat per role (§1.12): a tank's hits draw 2.5×. Kit data now so groups need no rewrite. */
export const ROLE_THREAT: Record<Role, number> = { tank: 2.5, healer: 1, damage: 1, support: 1 };

/** The base stat each class is built to stack (David, 2026-10-02: "like Megabonk"), raised by mastery. */
export type StatDirection = "max_mana" | "summon_count" | "cooldown" | "duration" | "attack_speed" | "crit_damage" | "reload_speed"
  | "armor" | "max_hp" | "summon_power" | "area" | "healing" | "crit_chance";
export const STAT_DIRECTION_LABEL: Record<StatDirection, string> = {
  max_mana: "Max mana", summon_count: "Summon count", cooldown: "Cooldown", duration: "Duration", attack_speed: "Attack speed",
  crit_damage: "Crit damage", reload_speed: "Reload speed", armor: "Armor", max_hp: "Max HP", summon_power: "Summon power",
  area: "Area size", healing: "Healing power", crit_chance: "Crit chance",
};

/**
 * How a key fires (the input layer): a tap; a hold (effects on the press, the ability's buffs end on release, then
 * `release`); a toggle (press: effects, press again: `release`, and its units are dismissed); a charge (hold, then
 * release fires with power scaled 0.5–1.5 by how long it was held between min_s and max_s); a recast (press: effects,
 * again within window_s: `release`); a drawn shape (the shape's accuracy scales it 0.6–1.5; under 50% fizzles).
 */
export type InputSpec =
  | { kind: "tap" }
  | { kind: "hold"; max_s: number }
  | { kind: "toggle" }
  | { kind: "charge"; min_s: number; max_s: number }
  | { kind: "recast"; window_s: number }
  | { kind: "drawn"; shape: string };

/** Movement riders (§1.1): the cast needs this state of the movement sim. */
export type MoveCondition = "sliding" | "airborne" | "afterDash" | "fast";

/** A rank or mastery upgrade (§1.4 menu): multipliers on power (heal, shield, buff value), cooldown, energy, radius, durations, or added effects. */
export interface AbilityUpgrade { label: string; power?: number; cooldown?: number; energy?: number; radius?: number; duration?: number; add?: Effect[] }

export interface ClassAbility extends Ability {
  input?: InputSpec;
  /** Hold release, toggle off, the recast's second press. */
  release?: Effect[];
  /** Mastery level it unlocks at (1: from the start). */
  unlock?: number;
  /** Impact tier "heavy" (§1.6); at most 2 a kit. */
  heavy?: boolean;
  /** The verb it plays on the held weapon's grip (lib/game/character/clips.ts VERBS) at its own timing scale, or a unique clip. */
  clip?: { verb: string; scale?: number } | { unique: string };
  /** Keys into the FX registry (lib/game/fx/combat.ts) per phase. */
  vfx?: { cast?: string; travel?: string; impact?: string; zone?: string };
  when?: MoveCondition;
  /** Power grows with carried speed: +0 at a walk (7.4 u/s) up to +max at 16 u/s. */
  scale?: { by: "speed"; max: number };
  /** Support radius for heals, shields and buffs: solo only the caster; allies inside it in a future group. */
  allies?: number;
}

export interface ClassUlt extends ClassAbility {
  /** Fill multiplier 0.8–1.25, tuned by the harness so every subclass fills in 60–90 s. */
  charge: number;
  /** Press to impact (250–600 ms): the anticipation the freeze lands on. */
  anticipation_ms: number;
  impacts: "first" | "first-last";
}

/** A ruins-only movement passive that extends the movement combo (row 292): Air Step, Bone Surf, Vault. */
export interface MovementPassive { name: string; description: string; on: "airJump" | "slide" | "dash" | "land"; energy: number; effects: Effect[]; cooldown_s?: number }

export interface ClassKit {
  key: string; name: string; family: Family; role: Role;
  /** Basic-attack or skill based (David, 2026-10-02). */
  style: "basic" | "skill";
  /** One weapon type per subclass, required for keys and the ult (§1.5): `name` fills "Hold your …". */
  signature: { type: string; name: string };
  /** The stat direction's value at mastery 1 and 20 (linear between): a pool size, a multiplier or a flat add per kind (classMods). */
  stat: { kind: StatDirection; at1: number; at20: number };
  /** Keys 1–5, all equipped (row 291). */
  keys: ClassAbility[];
  /** Two presses within COMBO_WINDOW (either order; the same index twice is a double tap) cast `ability` instead of the solos. */
  combos?: { keys: [number, number]; ability: ClassAbility }[];
  passive: Passive;
  movement?: MovementPassive;
  ult: ClassUlt;
  /** The class's own mastery track (build overrides): at a level, an ability key, "ult" or "passive" gets `change`. */
  ranks?: { at: number; target: string; change: AbilityUpgrade }[];
  look: { ramp: [core: string, mid: string, edge: string]; mote: string; drift: "orbit" | "rise" | "fall"; icon: string };
  mods?: { max_hp?: number; speed?: number; capacity?: number };
  /** Dev-only (the `?combat=demo` kit): never offered to members. */
  dev?: true;
}

export const COMBO_WINDOW = 0.4;
export const MAX_KEYS = 5;

/** Every v2 kit. Family waves append theirs. */
export const CLASS_KITS: ClassKit[] = [DEMO_KIT];
export const classKit = (key: string | null | undefined) => CLASS_KITS.find(k => k.key === key) ?? null;
/** Kits members may choose: the dev kit only outside production. */
export const memberKit = (key: string | null | undefined) => { const k = classKit(key); return k && (!k.dev || process.env.NODE_ENV !== "production") ? k : null; };

// ── The signature gate (§1.5) ───────────────────────────────────
export const holdsSignature = (kit: ClassKit, weaponType: string | undefined) => weaponType === kit.signature.type;
export const signatureHint = (kit: ClassKit) => `Hold your ${kit.signature.name}`;

// ── Upgrades and the per-class track ────────────────────────────
function scaleEffect(e: Effect, c: AbilityUpgrade): Effect {
  const p = c.power ?? 1, r = c.radius ?? 1, d = c.duration ?? 1;
  switch (e.kind) {
    case "projectile": return { ...e, power: e.power * p, ...(e.splash ? { splash: e.splash * r } : {}) };
    case "area": return { ...e, power: e.power * p, radius: e.radius * r };
    case "dash": return e.power ? { ...e, power: e.power * p } : e;
    case "shield": return { ...e, amount: e.amount * p, duration: e.duration * d };
    case "heal": return { ...e, amount: e.amount * p };
    case "buff": return { ...e, value: e.value * p, duration: e.duration * d };
    case "transform": return { ...e, duration: e.duration * d };
    default: return e;
  }
}
/** An ability with one upgrade applied. */
export function upgraded<A extends ClassAbility>(a: A, c: AbilityUpgrade): A {
  return { ...a, cooldown_s: a.cooldown_s * (c.cooldown ?? 1), energy: Math.round(a.energy * (c.energy ?? 1)),
    effects: [...a.effects.map(e => scaleEffect(e, c)), ...(c.add ?? [])], ...(a.release ? { release: a.release.map(e => scaleEffect(e, c)) } : {}) };
}
const reached = (kit: ClassKit, target: string, mastery: number) => (kit.ranks ?? []).filter(r => r.target === target && r.at <= mastery);
/** An ability (a key, a combo or the ult) as it stands at this mastery: every rank it has reached applied in order. */
export function abilityAt<A extends ClassAbility>(kit: ClassKit, a: A, mastery: number, target = a.key): A {
  return reached(kit, target, mastery).reduce((x, r) => upgraded(x, r.change), a);
}
export const passiveAt = (kit: ClassKit, mastery: number): Passive =>
  reached(kit, "passive", mastery).reduce((p, r) => ({ ...p, value: p.value * (r.change.power ?? 1) }), kit.passive);
export const rankOf = (kit: ClassKit, target: string, mastery: number) => 1 + reached(kit, target, mastery).length;
export const unlocked = (a: ClassAbility, mastery: number) => (a.unlock ?? 1) <= mastery;

/** The keys (null where still locked), combos and ult at a mastery level, ranks applied. */
export function kitAt(kit: ClassKit, mastery: number) {
  return {
    keys: kit.keys.map(a => (unlocked(a, mastery) ? abilityAt(kit, a, mastery) : null)),
    combos: (kit.combos ?? []).filter(c => unlocked(c.ability, mastery)).map(c => ({ keys: c.keys, ability: abilityAt(kit, c.ability, mastery) })),
    ult: abilityAt(kit, kit.ult, mastery, "ult"),
    passive: passiveAt(kit, mastery),
  };
}

/** What a level brings, in track order: new abilities (keys, combos) and ranks. For the level-up banner and the Path sheet. */
export function unlocksAt(kit: ClassKit, mastery: number): string[] {
  const out: string[] = [];
  for (const a of [...kit.keys, ...(kit.combos ?? []).map(c => c.ability)]) if ((a.unlock ?? 1) === mastery && mastery > 1) out.push(`New ability: ${a.name}`);
  for (const r of kit.ranks ?? []) if (r.at === mastery) {
    const name = r.target === "ult" ? kit.ult.name : r.target === "passive" ? kit.passive.name : [...kit.keys, ...(kit.combos ?? []).map(c => c.ability)].find(a => a.key === r.target)?.name ?? r.target;
    out.push(`${name} rank ${rankOf(kit, r.target, mastery) === 2 ? "II" : "III"}: ${r.change.label}`);
  }
  return out;
}
/** The next level that brings something, for "Mastery 3: Trick Card". */
export function nextUnlock(kit: ClassKit, mastery: number): { at: number; what: string[] } | null {
  for (let m = mastery + 1; m <= 20; m++) { const what = unlocksAt(kit, m); if (what.length) return { at: m, what }; }
  return null;
}

// ── The stat direction (mastery raises it) ──────────────────────
export const statAt = (kit: ClassKit, mastery: number) => kit.stat.at1 + ((kit.stat.at20 - kit.stat.at1) * (Math.min(20, Math.max(1, mastery)) - 1)) / 19;

/** The runtime's class modifiers: neutral values, with the class's stat direction set from its level. */
export interface ClassMods {
  energyMax: number; energyRegen: number; capacity: number; cooldown: number; duration: number; attackSpeed: number;
  critMult: number; critChance: number; guard: number; maxHp: number; summonPower: number; area: number; healing: number; reload: number;
}
export const NEUTRAL_MODS: ClassMods = { energyMax: 100, energyRegen: 12, capacity: 0, cooldown: 1, duration: 1, attackSpeed: 1, critMult: 1.75, critChance: 0,
  guard: 0, maxHp: 1, summonPower: 1, area: 1, healing: 1, reload: 1 };
export function classMods(kit: ClassKit, mastery: number): ClassMods {
  const v = statAt(kit, mastery), m = { ...NEUTRAL_MODS };
  switch (kit.stat.kind) {
    case "max_mana": m.energyMax = v; m.energyRegen = NEUTRAL_MODS.energyRegen * (v / NEUTRAL_MODS.energyMax); break;
    case "summon_count": m.capacity = v; break;
    case "cooldown": m.cooldown = v; break;
    case "duration": m.duration = v; break;
    case "attack_speed": m.attackSpeed = v; break;
    case "crit_damage": m.critMult = v; break;
    case "reload_speed": m.reload = v; break;
    case "armor": m.guard = v; break;
    case "max_hp": m.maxHp = v; break;
    case "summon_power": m.summonPower = v; break;
    case "area": m.area = v; break;
    case "healing": m.healing = v; break;
    case "crit_chance": m.critChance = v; break;
  }
  return m;
}
