/**
 * The 16 subclass kits (rows 17, 32, 34–37, 40–45, 50–53, G2, G3), as data
 * the island's one ability system executes (lib/game/combat/abilities.ts).
 * Every ability is a list of shared effect primitives: projectile, area
 * (circle, cone, line), dash, shield, heal, summon (minions, totems, traps,
 * decoys, with caps), buff, status (hold, slow, mark, distract) and
 * transform. Passives are one small modifier each on the same hooks.
 *
 * A kit offers the subclass's signature and two own abilities, its family's
 * two shared abilities and, for the Transmuter, one ability per monster trait
 * it owns. Four are equipped (row 50), chosen at the Oracle outside combat.
 * `incantation` marks the selected powerful spells that are drawn (rows 52,
 * C2): the Elementalist's burst, the Summoner's call and the two family
 * rituals; everything else is instant. Every number is a balance placeholder
 * (specs/evidence/combat-b/balance.md; retuned in combat polish 11).
 */
import type { Family } from "@/lib/oracle/engine";
import type { Stat } from "./progression";
import type { WeaponType } from "./weapons";

export type Element = "fire" | "frost" | "lightning";
/** Enemy statuses: hold (seconds, rooted and not acting), slow [fraction, seconds], mark [+damage taken, seconds], distract (seconds, wanders off). */
export interface Status { hold?: number; slow?: [number, number]; mark?: [number, number]; distract?: number }
/** Classes v2 adds: a parry window (its ability's `on_parry` answers a frontal hit inside it), absorbing (hits are stored,
 * not taken: an area's `stored` releases them), and size (the body grows by the value: Titan). */
export type BuffStat = "damage" | "speed" | "guard" | "block" | "crit" | "parry" | "absorb" | "size";

export type Effect =
  /** Shots from the caster toward the aim; `count` fan out over `spread` radians. */
  | { kind: "projectile"; power: number; count?: number; spread?: number; speed?: number; range?: number; pierce?: boolean; splash?: number; status?: Status;
      /** Classes v2: hops on to the nearest unhit enemy this many times, then flies home (Shield Throw). */
      bounce?: number;
      /** Classes v2: flies to the aim and stays where it lands or in what it hits: the blink anchor (Kunai Blink). */
      stick?: boolean;
      /** Classes v2: the shot's look (a card, a bone shard), its size, and whether it carries the ability's mark (a card to teleport to);
       * `burst`: effects where it ends (it flies to the aim at most, and bursts there or on the first enemy in its way). */
      shot?: "arrow" | "bolt" | "card" | "bone"; size?: number; mark?: boolean; burst?: Effect[] }
  /** A circle at the caster (or where a dash ended) or the aim; `arc` makes a cone toward the aim, `length` a beam of width 2·radius. */
  | { kind: "area"; power: number; radius: number; at: "self" | "aim"; arc?: number; length?: number; knock?: number; status?: Status;
      /** Classes v2: adds what an absorb stored × this to each hit, and empties the store (Unbreakable's release). */
      stored?: number;
      /** Classes v2: its impact effect plays on every enemy it hits, not once at its centre. */
      fxEach?: boolean;
      /** Classes v2: its own FX key over the ability's impact (an ult's stages). */
      fx?: string }
  /** Move toward the aim (or away from it), hitting what's on the path if `power`; i-frames like a dodge if `iframes`. */
  | { kind: "dash"; distance: number; back?: boolean; power?: number; iframes?: boolean }
  /** Fractions of max HP. */
  | { kind: "shield"; amount: number; duration: number }
  | { kind: "heal"; amount: number }
  /** Units from UNITS; "weapon" = the minion the equipped summoning weapon selects (row 43); "corpse" = raised from a fallen enemy.
   * `cap`: at most this many of this unit at once (the oldest goes). A unit costing 0 sits outside the summon capacity (an ult's army). */
  | { kind: "summon"; unit: string; count?: number; cap?: number }
  | { kind: "buff"; stat: BuffStat; value: number; duration: number;
      /** Classes v2: run on every basic attack while the buff lasts (Titan's shockwaves). */
      swing?: Effect[] }
  /** A body-part change (row 34): shown on the character, triggers the Transmuter passive. */
  | { kind: "transform"; duration: number }
  /** Classes v2 movement hooks (design sheet §1.1): carried speed added along the aim (≤ 4 u/s a cast, never past the 18 u/s ceiling), and a small hop. */
  | { kind: "momentum"; speed: number }
  | { kind: "launch"; height: number }
  // ── Classes v2 shared primitives (lib/game/combat/primitives.ts) ──
  /**
   * A lasting area: at the caster (`follow` keeps it on them), the aim, or a capsule `length` long toward the aim. Each
   * `every` s it deals `power` (per second) to enemies inside, heals you `heal` (max HP per second) while you stand in it,
   * slows (`slow`), draws enemies to its centre (`pull` u/s); enemies inside miss you `blind` of the time. `seek`: it
   * wanders to the nearest enemy at that speed. `fx`: the FX key it shows each tick.
   */
  | { kind: "zone"; radius: number; duration: number; at: "self" | "aim"; length?: number; follow?: boolean; seek?: number; every?: number;
      power?: number; heal?: number; slow?: number; pull?: number; blind?: number; fx?: string }
  /** Pull the enemy nearest the aim (within `range` of you) to you. (Pulling yourself to it is a dash with momentum.) */
  | { kind: "pull"; range: number; power?: number; status?: Status }
  /** Move to a place keeping your speed and arc: your unit (of this ability) nearest the aim, swapping with it; or the ability's mark. */
  | { kind: "teleport"; to: "unit" | "mark"; unit?: string; heal?: number }
  /**
   * A counter window (a parry, a Perfect Shift): a hit landing in the next `window` s is cut by `negate`, and `effects`
   * answer toward the attacker. `vs: "shot"` only enemy shots, which it sends back at their shooter for `reflect` power.
   */
  | { kind: "counter"; window: number; negate: number; vs?: "shot" | "any"; reflect?: number; effects?: Effect[] }
  /** Unseen for `duration` s: enemies lose you unless within `reveal` u; attacking or casting ends it; the first hit after deals `bonus` more. */
  | { kind: "stealth"; duration: number; reveal: number; bonus: number }
  /** Your minions charge the enemy nearest the aim; again: they come back to guard you. */
  | { kind: "command" }
  /** Blow up your minion or a corpse nearest the aim (within `range`): an area, and every corpse within `chain` u goes too, up to `links`. */
  | { kind: "detonate"; range: number; radius: number; power: number; chain: number; links: number }
  /** Consume your oldest minion: a heal and a shield (fractions of max HP). */
  | { kind: "consume"; heal: number; shield: number; duration: number }
  /** Hold a slide's speed for `duration` s (no friction loss), knocking aside and hitting (`power`) what you plough through. */
  | { kind: "surf"; duration: number; power: number }
  /** A wedge of stone `width` across the aim, `depth` deep, rising to `height` on the far side: blocks shots and enemies; climb it or jump off it. */
  | { kind: "wall"; width: number; depth: number; height: number; duration: number }
  /** A wall of `width` sweeping from you along the aim at `speed` for `distance`: what it crosses is trapped in it, then `effects` land at the end and it lets them go held `hold` s more. */
  | { kind: "sweep"; width: number; speed: number; distance: number; hold: number; effects: Effect[] }
  /** These effects again after `seconds`, from the same place and aim (an ult's stages). */
  | { kind: "delay"; seconds: number; effects: Effect[] }
  /** Take a form (a v2 kit's FORMS): its click attack and its standing guard, until another form. */
  | { kind: "form"; form: string }
  /** Every corpse within `radius` of the aim rises as `unit` (up to `max`); with none, `fallback` answers. */
  | { kind: "raise"; radius: number; unit: string; max: number; fallback?: string }
  /** Every unit this ability called bursts now: an area of its UnitDef `burst`. */
  | { kind: "burst" }
  /**
   * Classes v2 primitives (the Vanguard kits): one hit on one enemy (the nearest the aim inside `range` and the front
   * `arc`, then locked for the rest of the cast), optionally an execute (under `below` of its health and hit from behind:
   * it falls; a boss or mini-boss takes `boss` × power instead); effects that land `delay` s later where the caster is
   * then (a combo's strikes, a cut's bleed); a blink behind the target under the crosshair or to the thrown anchor
   * (holding the target `status`); a taunt (enemies within `radius` come for you for `duration` s); a slam down out of the air.
   */
  | { kind: "strike"; power: number; range: number; arc?: number; knock?: number; status?: Status; execute?: { below: number; boss: number } }
  | { kind: "after"; delay: number; effects: Effect[]; fx?: string; tier?: "light" | "ability" | "heavy" | "ult" }
  | { kind: "blink"; to: "behind" | "anchor"; range?: number; status?: Status }
  | { kind: "taunt"; radius: number; duration: number }
  | { kind: "drop" };

export interface Ability {
  key: string;
  name: string;
  description: string;
  cooldown_s: number;
  energy: number;
  effects: Effect[];
  /** Drawn: the rune the caster traces; its score scales the effects (row C2). */
  incantation?: "spark" | "binding";
  /** The stat that scales it (default: the family's). */
  stat?: Stat;
  /** Defining equipment (plan edge cases): without a weapon of this type the ability works at `without` power. */
  gear?: { type: WeaponType; without: number };
  /** Guardian: what a successful block (buff "block") does back. */
  on_block?: Effect[];
  /** Classes v2 Guardian: what a parry (a frontal hit inside the buff "parry" window) does back. */
  on_parry?: Effect[];
  /** Elementalist: the element it applies; "cycle" = the one after the last used. */
  element?: Element | "cycle";
}

export type PassiveKind =
  | "element_switch" | "distracted" | "kill_heal" | "transform_shield" | "still" | "same_target" | "distance" | "crit_cdr"
  | "block_shield" | "momentum" | "poise" | "lifesteal" | "pack_bond" | "resonance" | "overheal_shield"
  // Classes v2 (Arcane): alternating elements adds `value` ult points a cast; clones draw `value` of enemy attacks;
  // kills within `cap` u heal `value` max HP and their corpses last twice as long.
  | "attunement" | "decoy_share" | "grave_tithe"
  /**
   * Classes v2 (the Vanguard kits): a parry restores `cap` energy and grants `value` armour for 3 s (Bulwark); no
   * knockback while attacking (Unstoppable); each chain hit adds `value` attack speed up to `cap` stacks, gone after a
   * 1 s gap (Rhythm); hits from behind always crit and deal `value` more (Backstab).
   */
  | "parry" | "unstoppable" | "rhythm" | "backstab";
export interface Passive {
  name: string;
  description: string;
  kind: PassiveKind;
  value: number;
  /** Stacks cap, a distance, or the proc limit (per kind). */
  cap?: number;
  /** Classes v2: its icon (the HUD's class line). */
  icon?: string;
}
export interface Subclass {
  key: string;
  name: string;
  family: Family;
  weapon_affinity: WeaponType[]; // suggested, never required (row 31)
  signature: Ability;
  abilities: Ability[]; // the subclass's two others
  passive: Passive;
  /** Whole-kit modifiers: max HP and move speed fractions, extra summon capacity. */
  mods?: { max_hp?: number; speed?: number; capacity?: number };
  starter_note?: string; // edge cases from the plan (fallbacks without a kill / without gear)
}

export const FAMILY_STAT: Record<Family, Stat> = { Arcane: "arcana", Ranger: "finesse", Vanguard: "might", Warden: "spirit" };

type A = Omit<Ability, "key" | "name" | "description" | "cooldown_s" | "energy" | "effects">;
const a = (key: string, name: string, description: string, cooldown_s: number, energy: number, effects: Effect[], more: A = {}): Ability => ({ key, name, description, cooldown_s, energy, effects, ...more });
const hit = (power: number, radius: number, at: "self" | "aim" = "self", more: Partial<Extract<Effect, { kind: "area" }>> = {}): Effect => ({ kind: "area", power, radius, at, ...more });
const shot = (power: number, more: Partial<Extract<Effect, { kind: "projectile" }>> = {}): Effect => ({ kind: "projectile", power, ...more });
const dash = (distance: number, more: Partial<Extract<Effect, { kind: "dash" }>> = {}): Effect => ({ kind: "dash", distance, ...more });
const buff = (stat: BuffStat, value: number, duration: number): Effect => ({ kind: "buff", stat, value, duration });

/** The two abilities each family shares (row 50: the learnable kit is larger than the four slots). */
export const FAMILY_ABILITIES: Record<Family, Ability[]> = {
  Arcane: [
    a("arcane.blink", "Blink", "Step through space toward your aim, untouchable on the way.", 8, 20, [dash(5, { iframes: true })]),
    a("arcane.starfall", "Starfall", "A drawn ritual: stars fall where you aim and pin what they hit.", 16, 45, [hit(2.8, 3.5, "aim", { status: { hold: 2 } })], { incantation: "binding" }),
  ],
  Ranger: [
    a("ranger.tumble", "Tumble", "Roll clear toward your aim.", 7, 15, [dash(4, { iframes: true })]),
    a("ranger.rain", "Rain of Arrows", "Arrows rain on the aimed spot and slow what's under them.", 12, 30, [hit(1.5, 3, "aim", { status: { slow: [0.3, 2] } })]),
  ],
  Vanguard: [
    a("vanguard.leap", "Leap Strike", "Leap toward your aim and strike where you land.", 10, 25, [dash(5), hit(1.2, 2)]),
    a("vanguard.second-wind", "Second Wind", "Catch your breath mid-fight.", 16, 25, [{ kind: "heal", amount: 0.25 }]),
  ],
  Warden: [
    a("warden.renew", "Renew", "Mend yourself and keep a thin ward.", 12, 25, [{ kind: "heal", amount: 0.2 }, { kind: "shield", amount: 0.06, duration: 6 }]),
    a("warden.covenant", "Verdant Covenant", "A drawn ritual: roots burst around you, holding enemies while you heal and ward.", 18, 45,
      [hit(1.3, 4, "self", { status: { hold: 2 } }), { kind: "heal", amount: 0.25 }, { kind: "shield", amount: 0.15, duration: 6 }], { incantation: "binding" }),
  ],
};

const k = (s: Subclass): Subclass => s;

export const SUBCLASSES: Subclass[] = [
  // ── Arcane / NT ────────────────────────────────────────────────────────────
  k({
    key: "elementalist", name: "Elementalist", family: "Arcane", weapon_affinity: ["staff"],
    signature: a("elementalist.burst", "Elemental Burst", "A drawn burst of the element you didn't use last: fire, frost or lightning.", 10, 35,
      [hit(2.4, 2.4, "aim")], { incantation: "spark", element: "cycle" }),
    abilities: [
      a("elementalist.firebolt", "Firebolt", "A bolt of fire that bursts on impact.", 2.5, 15, [shot(1.6, { speed: 16, range: 10, splash: 1.2 })], { element: "fire" }),
      a("elementalist.frost-nova", "Frost Nova", "Freeze everything around you in place.", 10, 25, [hit(0.9, 3, "self", { status: { hold: 2 } })], { element: "frost" }),
    ],
    passive: { name: "Elemental Rhythm", description: "A different element than the last strengthens that hit.", kind: "element_switch", value: 0.25 },
  }),
  k({
    key: "illusionist", name: "Illusionist", family: "Arcane", weapon_affinity: ["staff", "tome"],
    signature: a("illusionist.decoy-step", "Decoy Step", "Slip back untouchable and leave a phantom that draws enemies to it.", 10, 25, [{ kind: "summon", unit: "decoy" }, dash(2.5, { back: true, iframes: true })]),
    abilities: [
      a("illusionist.mirror-bolts", "Mirror Bolts", "Two bolts, one real enough to hurt, then both.", 3, 15, [shot(1.05, { count: 2, spread: 0.15, speed: 15, range: 10 })]),
      a("illusionist.mass-confusion", "Mass Confusion", "Enemies in the aimed area forget you and wander off.", 14, 30, [hit(0.6, 3, "aim", { status: { distract: 2 } })]),
    ],
    passive: { name: "Misdirection", description: "Hits on a distracted enemy deal more.", kind: "distracted", value: 0.3 },
  }),
  k({
    key: "necromancer", name: "Necromancer", family: "Arcane", weapon_affinity: ["staff", "tome"],
    signature: a("necromancer.raise-shade", "Raise Shade", "Raise a fallen enemy nearby as a shade that fights for a while; with no body near, a bone wisp answers.", 8, 30, [{ kind: "summon", unit: "corpse" }]),
    abilities: [
      a("necromancer.bone-spear", "Bone Spear", "A spear of bone that passes through a line of enemies.", 4, 15, [shot(1.4, { speed: 18, range: 10, pierce: true })]),
      a("necromancer.grave-chill", "Grave Chill", "Cold from the grave slows everything in the aimed area.", 10, 25, [hit(1.0, 2.6, "aim", { status: { slow: [0.4, 3] } })]),
    ],
    passive: { name: "Grave Tithe", description: "Enemy deaths near you restore health.", kind: "kill_heal", value: 0.04, cap: 9 },
    mods: { capacity: 1 },
    starter_note: "Raise Shade calls a Bone Wisp when there's no body to raise, so it works before the first kill.",
  }),
  k({
    key: "transmuter", name: "Transmuter", family: "Arcane", weapon_affinity: ["fists", "staff"],
    signature: a("transmuter.aspect", "Monster Aspect", "Take on your monster traits' body for a while: stronger and quicker.", 14, 30,
      [{ kind: "transform", duration: 8 }, buff("damage", 0.4, 8), buff("speed", 0.15, 8)]),
    abilities: [], // monster traits are its other abilities (TRAITS, row 37)
    passive: { name: "Shed Skin", description: "Transforming grants a small barrier.", kind: "transform_shield", value: 0.08 },
    starter_note: "Starts with the Fox Stride trait before its first kill; each new monster species it defeats teaches a basic trait.",
  }),
  // ── Ranger / SJ ────────────────────────────────────────────────────────────
  k({
    key: "marksman", name: "Marksman", family: "Ranger", weapon_affinity: ["bow", "revolver"],
    signature: a("marksman.focus-shot", "Focus Shot", "A charged shot that pierces everything in its line.", 8, 30, [shot(2.6, { speed: 30, range: 14, pierce: true })]),
    abilities: [
      a("marksman.double-tap", "Double Tap", "Two quick shots at the same mark.", 4, 15, [shot(0.8, { count: 2, spread: 0.05, speed: 24, range: 12 })]),
      a("marksman.steady-aim", "Steady Aim", "Settle your breathing: harder and more critical shots for a while.", 14, 20, [buff("damage", 0.25, 6), buff("crit", 0.15, 6)]),
    ],
    passive: { name: "Steady Stance", description: "Holding still briefly improves your damage.", kind: "still", value: 0.2 },
  }),
  k({
    key: "hunter", name: "Hunter", family: "Ranger", weapon_affinity: ["bow"],
    signature: a("hunter.volley", "Bow Volley", "A tight burst of arrows at one target.", 8, 30, [shot(0.6, { count: 5, spread: 0.1, speed: 22, range: 12 })]),
    abilities: [
      a("hunter.mark", "Hunter's Mark", "Mark the aimed area's prey: they take more from everything.", 12, 15, [hit(0.3, 1.8, "aim", { status: { mark: [0.25, 8] } })]),
      a("hunter.snare", "Snare Shot", "An arrow trailing a snare that holds its target.", 9, 20, [shot(0.9, { speed: 22, range: 12, status: { hold: 2 } })]),
    ],
    passive: { name: "Marked Prey", description: "Each hit on the same target in a row deals a little more.", kind: "same_target", value: 0.04, cap: 5 },
  }),
  k({
    key: "sniper", name: "Sniper", family: "Ranger", weapon_affinity: ["bow", "revolver"],
    signature: a("sniper.tripwire", "Tripwire", "Set a trap at your aim that holds the first enemy through it for a follow-up shot.", 10, 25, [{ kind: "summon", unit: "tripwire" }]),
    abilities: [
      a("sniper.long-shot", "Long Shot", "A slow, heavy shot from far away.", 6, 25, [shot(2.0, { speed: 32, range: 16, pierce: true })]),
      a("sniper.smoke-step", "Smoke Step", "Drop smoke and slip back; what's close loses you.", 10, 15, [hit(0, 2.5, "self", { status: { distract: 0.5 } }), dash(2, { back: true, iframes: true })]),
    ],
    passive: { name: "Long Sight", description: "Ranged damage grows with distance, up to 12 m.", kind: "distance", value: 0.3, cap: 12 },
  }),
  k({
    key: "gunslinger", name: "Gunslinger", family: "Ranger", weapon_affinity: ["revolver"],
    signature: a("gunslinger.fan", "Fan the Hammer", "Empty the cylinder in a rapid fan.", 8, 30, [shot(0.5, { count: 6, spread: 0.3, speed: 30, range: 10 })], { gear: { type: "revolver", without: 0.7 } }),
    abilities: [
      a("gunslinger.trick-shot", "Trick Shot", "A ricochet that passes through a line of enemies.", 6, 20, [shot(1.3, { speed: 30, range: 12, pierce: true })], { gear: { type: "revolver", without: 0.7 } }),
      a("gunslinger.quickstep", "Quickstep", "A quick sidestep that sharpens your eye.", 8, 15, [dash(4, { iframes: true }), buff("crit", 0.25, 4)]),
    ],
    passive: { name: "Hot Streak", description: "Critical hits take a second off Fan the Hammer, three times per use.", kind: "crit_cdr", value: 1, cap: 3 },
    starter_note: "Without a revolver its shots use the equipped weapon at 70%.",
  }),
  // ── Vanguard / SP ──────────────────────────────────────────────────────────
  k({
    key: "guardian", name: "Guardian", family: "Vanguard", weapon_affinity: ["shield", "sword"],
    signature: a("guardian.counter", "Shield Counter", "Raise your guard against frontal hits; the first blocked hit is answered with a bash.", 15, 20,
      [buff("block", 0.4, 1)], { gear: { type: "shield", without: 0.5 }, on_block: [hit(1.8, 2.4, "self", { arc: 1.8, knock: 5 })] }),
    abilities: [
      a("guardian.bash", "Shield Bash", "A bash in front that staggers.", 6, 20, [hit(1.3, 2.2, "self", { arc: 1.6, status: { hold: 0.8 } })]),
      a("guardian.stalwart", "Stalwart", "Plant your feet: take less damage and hold a ward.", 14, 20, [buff("guard", 0.3, 6), { kind: "shield", amount: 0.12, duration: 6 }]),
    ],
    passive: { name: "Bulwark", description: "Each blocked hit builds a small barrier.", kind: "block_shield", value: 0.01 },
    starter_note: "Without a shield the guard blocks half as much.",
  }),
  k({
    key: "monk", name: "Martial Artist", family: "Vanguard", weapon_affinity: ["fists"],
    signature: a("monk.flow", "Flowing Strikes", "Advance through a short martial-arts combo.", 6, 25, [dash(2.5, { power: 0.8 }), hit(1.4, 2.2, "self", { arc: 2 })], { gear: { type: "fists", without: 0.85 } }),
    abilities: [
      a("monk.palm", "Palm Wave", "A wave of force from an open palm.", 4, 15, [shot(1.1, { speed: 16, range: 7, pierce: true })], { gear: { type: "fists", without: 0.85 } }),
      a("monk.iron-body", "Iron Body", "Harden and breathe: less damage taken, a little health back.", 14, 20, [buff("guard", 0.45, 6), { kind: "heal", amount: 0.08 }]),
    ],
    passive: { name: "Momentum", description: "Consecutive hits briefly increase your speed.", kind: "momentum", value: 0.05, cap: 5 },
    starter_note: "Works with any weapon at 85%; wraps or bare hands get the full combo.",
  }),
  k({
    key: "juggernaut", name: "Juggernaut", family: "Vanguard", weapon_affinity: ["sword"],
    signature: a("juggernaut.slam", "Ground Slam", "A heavy slam that staggers everything around you.", 10, 35, [hit(2.1, 3.2, "self", { knock: 4, status: { hold: 1 } })]),
    abilities: [
      a("juggernaut.charge", "Charge", "Barrel through a line of enemies toward your aim.", 9, 25, [dash(6, { power: 1.2 })]),
      a("juggernaut.war-cry", "War Cry", "Roar: more damage dealt, less taken.", 16, 20, [buff("damage", 0.25, 6), buff("guard", 0.45, 8)]),
    ],
    passive: { name: "Unstoppable", description: "Hits never knock you back.", kind: "poise", value: 1 },
    mods: { max_hp: 0.1 },
  }),
  k({
    key: "assassin", name: "Assassin", family: "Vanguard", weapon_affinity: ["sword", "fists"],
    signature: a("assassin.lunge", "Blood Lunge", "Dash through a target with a quick strike, then slip its answer for a moment.", 6, 20, [dash(5, { power: 1.7, iframes: true }), buff("guard", 0.3, 2.5)]),
    abilities: [
      a("assassin.shadow-step", "Shadow Step", "Vanish toward your aim; your next strikes find weak spots.", 9, 15, [dash(6, { iframes: true }), buff("crit", 0.3, 3)]),
      a("assassin.knives", "Fan of Knives", "Knives in every direction around you.", 7, 20, [hit(1.2, 2.6)]),
    ],
    passive: { name: "Lifesteal", description: "Your hits return a share of their damage as health.", kind: "lifesteal", value: 0.08 },
    mods: { max_hp: -0.15, speed: 0.15 }, // row 35: fast, fragile
  }),
  // ── Warden / NF ────────────────────────────────────────────────────────────
  k({
    key: "summoner", name: "Summoner", family: "Warden", weapon_affinity: ["tome"],
    signature: a("summoner.call", "Call Companions", "A drawn call: two of the minions your summoning weapon knows answer and stay.", 10, 35, [{ kind: "summon", unit: "weapon", count: 2 }], { incantation: "spark" }),
    abilities: [
      a("summoner.fox-pack", "Fox Pack", "Two spirit foxes that harry your enemies.", 12, 30, [{ kind: "summon", unit: "fox", count: 2 }]),
      a("summoner.crab-guard", "Crab Bulwark", "A sturdy crab that draws enemies onto its shell.", 16, 35, [{ kind: "summon", unit: "crab" }]),
    ],
    passive: { name: "Pack Bond", description: "Each companion makes the others a little stronger.", kind: "pack_bond", value: 0.05 },
    mods: { capacity: 1, max_hp: 0.25 },
  }),
  k({
    key: "shaman", name: "Shaman", family: "Warden", weapon_affinity: ["totem"],
    signature: a("shaman.ember", "Totem Circle", "Plant an ember totem that burns what stands near it. One totem of each role stands at a time.", 6, 25, [{ kind: "summon", unit: "totem-ember" }]),
    abilities: [
      a("shaman.mending", "Mending Totem", "A totem that heals you while you stand in its circle.", 8, 25, [{ kind: "summon", unit: "totem-mending" }]),
      a("shaman.warding", "Warding Totem", "A totem that slows enemies in its circle and wards you inside it.", 8, 25, [{ kind: "summon", unit: "totem-warding" }]),
    ],
    passive: { name: "Resonance", description: "Where two totem circles overlap, both work harder.", kind: "resonance", value: 0.35 },
    mods: { max_hp: 0.25 },
  }),
  k({
    key: "druid", name: "Druid", family: "Warden", weapon_affinity: ["staff", "totem"],
    signature: a("druid.rootbind", "Rootbind", "Roots burst from the ground at your aim, holding and hurting.", 7, 30, [hit(1.9, 2.5, "aim", { status: { hold: 2.5 } })]),
    abilities: [
      a("druid.thorn-lash", "Thorn Lash", "A thorny vine lashes the enemies in front of you.", 3, 15, [hit(1.5, 3, "self", { arc: 1.4, status: { slow: [0.3, 2] } })]),
      a("druid.wild-growth", "Wild Growth", "Green growth closes your wounds under a leaf ward.", 12, 25, [{ kind: "heal", amount: 0.15 }, { kind: "shield", amount: 0.08, duration: 6 }]),
    ],
    passive: { name: "Verdant Thirst", description: "Your hits return health, twice as much from held enemies.", kind: "lifesteal", value: 0.06 },
    mods: { max_hp: 0.25 },
  }),
  k({
    key: "priest", name: "Priest", family: "Warden", weapon_affinity: ["staff", "tome"],
    signature: a("priest.holy-beam", "Holy Beam", "A beam of light through everything in a line toward your aim.", 4, 20, [hit(2.9, 0.8, "self", { length: 9 })]),
    abilities: [
      a("priest.radiant-shield", "Radiant Shield", "A strong shield of light.", 10, 30, [{ kind: "shield", amount: 0.45, duration: 8 }]),
      a("priest.mend", "Mend", "A strong heal.", 10, 25, [{ kind: "heal", amount: 0.3 }]),
    ],
    passive: { name: "Sanctuary", description: "Healing past full becomes a shield.", kind: "overheal_shield", value: 0.5, cap: 0.3 },
    mods: { max_hp: 0.25 },
  }),
];

export const subclassesFor = (family: Family) => SUBCLASSES.filter((s) => s.family === family);
export const subclassByKey = (key: string | null | undefined) => SUBCLASSES.find((s) => s.key === key) ?? null;

// ── Summons, totems, traps, decoys ──────────────────────────────────────────
export interface UnitDef {
  key: string;
  name: string;
  /** clone: your double (lib/game/combat/primitives.ts stepClone): it moves, throws your basic attack and draws enemies.
   * Classes v2 (Vanguard): a dome stops enemy shots crossing its radius (Aegis Dome); a veil hides you inside it (Smoke Bomb). */
  kind: "minion" | "totem" | "trap" | "decoy" | "clone" | "dome" | "veil";
  hp: number;
  /** Its health as a share of your max HP instead of `hp` (a clone). */
  hpShare?: number;
  /** It bursts (the `burst` effect, or its life running out): an area of this radius and power at it. */
  burst?: { radius: number; power: number };
  /** Seconds it lasts; absent = persists until destroyed, dismissed or the loadout drops its ability (row 50). */
  life?: number;
  /** Minions: capacity cost (row 43), move speed, reach, damage power, seconds between attacks; ranged fire bolts. */
  cost?: number; speed?: number; range?: number; power?: number; rate?: number; ranged?: boolean;
  /** Enemies nearby attack it instead of you. */
  taunt?: boolean;
  /** Totems/traps: circle radius; the model it borrows (an enemy GLB) for minions. */
  radius?: number; model?: string;
  /** Totems: what a pulse does each second, per role. */
  pulse?: { damage?: number; heal?: number; slow?: number; shield?: number };
}
export const UNITS: Record<string, UnitDef> = {
  wisp: { key: "wisp", name: "Spirit wisp", kind: "minion", hp: 40, cost: 1, speed: 5, range: 6, power: 0.38, rate: 0.9, ranged: true },
  fox: { key: "fox", name: "Spirit fox", kind: "minion", hp: 70, cost: 1, speed: 6.5, range: 1.4, power: 0.4, rate: 0.8, model: "shadow-fox" },
  crab: { key: "crab", name: "Bulwark crab", kind: "minion", hp: 400, cost: 2, speed: 3, range: 1.5, power: 0.45, rate: 1.1, taunt: true, model: "thorn-crab" },
  shade: { key: "shade", name: "Shade", kind: "minion", hp: 60, cost: 1, life: 20, speed: 5, range: 1.5, power: 0.55, rate: 0.9 },
  "bone-wisp": { key: "bone-wisp", name: "Bone wisp", kind: "minion", hp: 35, cost: 1, life: 20, speed: 5, range: 6, power: 0.45, rate: 0.9, ranged: true },
  "weapon-wisp": { key: "weapon-wisp", name: "Wisp", kind: "minion", hp: 30, life: 12, speed: 5, range: 6, power: 0.85, rate: 0.9, ranged: true },
  "totem-ember": { key: "totem-ember", name: "Ember totem", kind: "totem", hp: 90, radius: 3.4, pulse: { damage: 0.55 } },
  "totem-mending": { key: "totem-mending", name: "Mending totem", kind: "totem", hp: 90, radius: 3.4, pulse: { heal: 0.025 } },
  "totem-warding": { key: "totem-warding", name: "Warding totem", kind: "totem", hp: 90, radius: 3.4, pulse: { slow: 0.35, shield: 0.015 } },
  tripwire: { key: "tripwire", name: "Tripwire", kind: "trap", hp: 1, life: 25, radius: 1.2, power: 0.8 },
  decoy: { key: "decoy", name: "Phantom", kind: "decoy", hp: 50, life: 3, taunt: true },
  // Classes v2, Arcane: the Illusionist's doubles, the Necromancer's dead (a skeleton body, lib/game/combat/primitives.ts ALLY_BODIES).
  "mirror-clone": { key: "mirror-clone", name: "Mirror clone", kind: "clone", hp: 30, hpShare: 0.3, life: 10, speed: 7.4, range: 9, power: 0.4, rate: 1.15 },
  skeleton: { key: "skeleton", name: "Skeleton", kind: "minion", hp: 30, cost: 1, life: 20, speed: 5.6, range: 1.4, power: 0.22, rate: 0.8, model: "skeleton-warrior" },
  "army-skeleton": { key: "army-skeleton", name: "Risen dead", kind: "minion", hp: 24, cost: 0, life: 8, speed: 6.6, range: 1.4, power: 0.25, rate: 0.8, model: "skeleton-warrior", burst: { radius: 1.7, power: 1 } },
  aegis: { key: "aegis", name: "Aegis dome", kind: "dome", hp: 1, life: 5, radius: 2.6 },
  "ink-smoke": { key: "ink-smoke", name: "Ink smoke", kind: "veil", hp: 1, life: 4, radius: 2.8 },
};
/** Caps (row 50): minions share the capacity stat; one totem per role and three at most; two traps; one decoy; two weapon wisps. */
export const CAPS = { totems: 3, traps: 2, decoys: 1, weaponWisps: 2, domes: 1, veils: 1 } as const;
/** Row 43: the summoning weapon selects the Summoner's companions. */
export const WEAPON_MINION: Record<string, string> = { "tome-spirits": "wisp", "tome-warden": "fox" };
export const minionFor = (weaponKey: string) => WEAPON_MINION[weaponKey] ?? "wisp";

// ── Transmuter monster traits (rows 34, 37, 40–42) ──────────────────────────
/**
 * The first eligible defeat of a species unlocks its basic trait (row 40);
 * repeated defeats raise its mastery (row 41), which sets the trait's power
 * instead of the weapon's tier (row 37). The guardian teaches nothing (row
 * 34: no copying every boss ability). Fox Stride is the starter (plan edge case).
 */
export interface Trait { key: string; from: string[]; part: string; ability: Ability }
const trait = (key: string, from: string[], part: string, name: string, description: string, cooldown_s: number, energy: number, effects: Effect[]): Trait =>
  ({ key, from, part, ability: a(`trait.${key}`, name, description, cooldown_s, energy, [{ kind: "transform", duration: 2 }, ...effects]) });
export const TRAITS: Trait[] = [
  trait("fox-stride", ["shadow-fox"], "fox legs", "Fox Stride", "Fox legs: pounce through enemies toward your aim and keep the pace.", 6, 20, [dash(5, { power: 1.7 }), buff("speed", 0.25, 3)]),
  trait("crab-shell", ["thorn-crab", "elder-thorn-crab"], "crab shell", "Crab Shell", "A crab's shell: a barrier, and hits glance off for a while.", 12, 25, [{ kind: "shield", amount: 0.18, duration: 5 }, buff("guard", 0.25, 5)]),
  trait("spore-sac", ["mushroom-beast"], "spore sac", "Spore Sac", "A mushroom's sac: spit spores that hurt and slow where you aim.", 8, 20, [hit(1.2, 2.4, "aim", { status: { slow: [0.4, 3] } })]),
  trait("wisp-core", ["rune-wisp"], "wisp core", "Wisp Core", "A wisp's glowing core: three rune bolts.", 4, 15, [shot(0.6, { count: 3, spread: 0.2, speed: 16, range: 10 })]),
  trait("page-storm", ["animated-book"], "paper wings", "Page Storm", "Paper wings: a storm of cutting pages around you.", 8, 25, [hit(1.5, 3)]),
  trait("golem-fist", ["stone-golem"], "stone fist", "Golem Fist", "A stone fist: slam where you aim and stagger.", 12, 35, [hit(2.4, 2.8, "aim", { status: { hold: 1 } })]),
  // Zone 1's pollen sprites (classes v2: the Transmuter's Pollen form; 2026..._classes_v2_arcane_seed.sql sets enemy_types.trait).
  trait("pollen-swarm", ["pollen-sprite"], "pollen wings", "Pollen Swarm", "Pollen wings: burst into a swarm and flit clear, leaving pollen that slows.", 8, 20, [dash(4, { iframes: true }), hit(0, 2, "self", { status: { slow: [0.35, 2] } })]),
];
export const STARTER_TRAIT = "fox-stride";
export const traitFor = (enemyKey: string) => TRAITS.find((t) => t.from.includes(enemyKey)) ?? null;
/** Mastery 1 at the first defeat, 2 at 10, 3 at 30 (row 41; placeholder thresholds). */
export const traitMastery = (kills: number) => (kills >= 30 ? 3 : kills >= 10 ? 2 : 1);
/** Trait damage uses its mastery as the weapon tier (tier 2 → 4), not the equipped weapon's. */
export const traitTier = (kills: number) => 1 + traitMastery(kills);

// ── Kit and loadout ─────────────────────────────────────────────────────────
export const SLOTS = 4;
/** Everything this member may equip: signature, own abilities, family abilities, and the Transmuter's traits. */
export function kitOptions(subclass: Subclass, traits: Record<string, number> = {}): Ability[] {
  const own = subclass.key === "transmuter"
    ? TRAITS.filter((t) => t.key === STARTER_TRAIT || (traits[t.key] ?? 0) > 0).map((t) => t.ability)
    : subclass.abilities;
  return [subclass.signature, ...own, ...FAMILY_ABILITIES[subclass.family]];
}
/** The stored loadout filtered to what the kit offers now; if nothing of it is left (none stored, or a new subclass), the default: signature, own, the family's second then first. */
export function resolveLoadout(subclass: Subclass, stored: string[] = [], traits: Record<string, number> = {}): Ability[] {
  const options = kitOptions(subclass, traits);
  const chosen = [...new Set(stored)].map((key) => options.find((o) => o.key === key)).filter((o): o is Ability => !!o).slice(0, SLOTS);
  if (chosen.length) return chosen;
  const fam = FAMILY_ABILITIES[subclass.family];
  const order = [subclass.signature, ...options.filter((o) => o !== subclass.signature && !fam.includes(o)), fam[1], fam[0]];
  return order.slice(0, SLOTS);
}
export type LoadoutCheck = { ok: true; loadout: string[] } | { ok: false; error: string };
export function checkLoadout(subclass: Subclass, keys: unknown, traits: Record<string, number> = {}): LoadoutCheck {
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > SLOTS || new Set(keys).size !== keys.length) return { ok: false, error: `Pick one to ${SLOTS} different abilities.` };
  const options = kitOptions(subclass, traits);
  const bad = keys.find((key) => !options.some((o) => o.key === key));
  return bad === undefined ? { ok: true, loadout: keys as string[] } : { ok: false, error: "That ability isn't in your kit." };
}
