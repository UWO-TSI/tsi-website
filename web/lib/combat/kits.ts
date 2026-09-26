/**
 * The 16 subclasses (row 32 roster) with one signature and one passive each
 * (row 17). Names and roles follow the plan's proposed kits; every number is
 * a placeholder for the balance pass. Kits are data only in this milestone.
 * `incantation` marks the powerful spells that are drawn (rows 52, C2).
 */
import type { Family } from "@/lib/oracle/engine";
import type { WeaponType } from "./weapons";

export interface Ability {
  name: string;
  description: string;
  cooldown_s: number;
  energy: number;
  power: number; // damage/heal/shield multiplier on weapon base, placeholder
  incantation?: "spark" | "binding";
}
export interface Passive {
  name: string;
  description: string;
  value: number; // placeholder magnitude (fraction or flat)
}
export interface Subclass {
  key: string;
  name: string;
  family: Family;
  weapon_affinity: WeaponType[]; // suggested, never required (row 31)
  signature: Ability;
  passive: Passive;
  starter_note?: string; // edge cases from the plan (fallbacks without a kill / without gear)
}

const k = (key: string, name: string, family: Family, weapon_affinity: WeaponType[], signature: Ability, passive: Passive, starter_note?: string): Subclass => ({
  key, name, family, weapon_affinity, signature, passive, starter_note,
});

export const SUBCLASSES: Subclass[] = [
  // Arcane / NT
  k("elementalist", "Elementalist", "Arcane", ["staff"], { name: "Elemental Burst", description: "Choose fire, frost or lightning for the cast.", cooldown_s: 12, energy: 40, power: 2.2, incantation: "spark" }, { name: "Elemental Rhythm", description: "A different element than the last strengthens the next elemental hit.", value: 0.15 }),
  k("illusionist", "Illusionist", "Arcane", ["staff", "tome"], { name: "Decoy Step", description: "Evade and leave a short-lived phantom that distracts enemies.", cooldown_s: 14, energy: 30, power: 0 }, { name: "Misdirection", description: "Attacking a distracted enemy grants a brief damage bonus.", value: 0.2 }),
  k("necromancer", "Necromancer", "Arcane", ["staff", "tome"], { name: "Raise Shade", description: "Summon a temporary undead fighter from a defeated enemy.", cooldown_s: 20, energy: 45, power: 1.2, incantation: "binding" }, { name: "Grave Tithe", description: "Nearby enemy deaths restore a small amount of health.", value: 0.03 }, "Starts with a Bone Wisp shade usable before any kill."),
  k("transmuter", "Transmuter", "Arcane", ["fists", "staff"], { name: "Monster Aspect", description: "Manifest an equipped monster trait through a body-part transformation.", cooldown_s: 16, energy: 35, power: 1.6 }, { name: "Shed Skin", description: "Transforming briefly grants a small protective barrier.", value: 0.08 }, "Starts with a Fox Stride trait before its first kill."),
  // Ranger / SJ
  k("marksman", "Marksman", "Ranger", ["bow", "revolver"], { name: "Focus Shot", description: "A charged piercing shot.", cooldown_s: 10, energy: 30, power: 2.5 }, { name: "Steady Stance", description: "Holding position briefly improves shot damage.", value: 0.15 }),
  k("hunter", "Hunter", "Ranger", ["bow"], { name: "Bow Volley", description: "A burst of arrows focused on one target.", cooldown_s: 11, energy: 30, power: 2.0 }, { name: "Marked Prey", description: "Repeated hits on the same target build a modest damage bonus.", value: 0.03 }),
  k("sniper", "Sniper", "Ranger", ["bow", "revolver"], { name: "Tripwire", description: "Set a trap that holds a target for a follow-up shot.", cooldown_s: 15, energy: 25, power: 0.8 }, { name: "Long Sight", description: "Ranged damage increases with distance, up to a cap.", value: 0.25 }),
  k("gunslinger", "Gunslinger", "Ranger", ["revolver"], { name: "Fan the Hammer", description: "A rapid revolver burst.", cooldown_s: 9, energy: 30, power: 1.8 }, { name: "Hot Streak", description: "Critical hits shorten the signature cooldown (limited procs).", value: 1 }, "Without a revolver, the burst uses the equipped weapon at 70%."),
  // Vanguard / SP
  k("guardian", "Guardian", "Vanguard", ["shield", "sword"], { name: "Shield Counter", description: "Guard a frontal hit, then retaliate with a bash.", cooldown_s: 10, energy: 25, power: 1.6 }, { name: "Bulwark", description: "Successful blocks build a small protective barrier.", value: 0.05 }, "Without a shield, the guard blocks half as much."),
  k("monk", "Monk", "Vanguard", ["fists"], { name: "Flowing Strikes", description: "A short advancing martial-arts combo.", cooldown_s: 8, energy: 25, power: 1.9 }, { name: "Momentum", description: "Consecutive hits briefly increase movement speed.", value: 0.04 }, "Works with any weapon; wraps or bare hands get the full combo."),
  k("juggernaut", "Juggernaut", "Vanguard", ["sword"], { name: "Ground Slam", description: "A heavy area strike that staggers nearby enemies.", cooldown_s: 14, energy: 40, power: 2.1 }, { name: "Unstoppable", description: "Heavy attacks resist interruption.", value: 1 }),
  k("assassin", "Assassin", "Vanguard", ["sword", "fists"], { name: "Blood Lunge", description: "Dash through a target with a quick strike.", cooldown_s: 9, energy: 25, power: 1.7 }, { name: "Lifesteal", description: "Weapon hits return a modest amount of health; low survivability.", value: 0.06 }),
  // Warden / NF
  k("summoner", "Summoner", "Warden", ["tome"], { name: "Call Companions", description: "The summoning weapon selects monster minions; types coexist within capacity.", cooldown_s: 18, energy: 45, power: 1.0, incantation: "binding" }, { name: "Pack Bond", description: "Each active minion slightly raises the others' damage.", value: 0.05 }),
  k("shaman", "Shaman", "Warden", ["totem"], { name: "Totem Circle", description: "Place role-based totems; overlapping areas create bonuses.", cooldown_s: 16, energy: 40, power: 0.9 }, { name: "Resonance", description: "Standing where two totems overlap boosts their effects.", value: 0.1 }),
  k("druid", "Druid", "Warden", ["staff", "totem"], { name: "Rootbind", description: "Vines and roots hold and damage enemies.", cooldown_s: 13, energy: 35, power: 1.4, incantation: "spark" }, { name: "Verdant Thirst", description: "Lifesteal on root damage.", value: 0.05 }),
  k("priest", "Priest", "Warden", ["staff", "tome"], { name: "Holy Beam", description: "An offensive beam; separate shield and heal casts complete the kit.", cooldown_s: 12, energy: 40, power: 2.0, incantation: "binding" }, { name: "Sanctuary", description: "Healing an ally or yourself above full grants a small shield.", value: 0.1 }),
];

export const subclassesFor = (family: Family) => SUBCLASSES.filter((s) => s.family === family);
