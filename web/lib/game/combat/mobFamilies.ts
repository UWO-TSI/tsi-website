/**
 * Zone 1's mob families as the Transmuter's forms will need them (design sheet "Transmuter": Fox, Crab, Wisp and
 * Pollen are learned in zone 1, the Golem in the inner temple). Identity only, for the Arcane wave to build the forms
 * on; nothing here plays a form. Each family names the mobs that teach it, its colour and model, the role the sheet
 * gives the form, and the moves it borrows: the mob's own attack data from data.ts, live, so a retune carries over.
 */
import type { EnemyAttack, EnemyType } from "./contract";
import { ENEMIES } from "./data";
import { RUNE_BOLT_SPEED } from "./mobs";

export type MobFamilyKey = "fox" | "crab" | "wisp" | "pollen";
export interface MobFamily {
  key: MobFamilyKey;
  /** The form's display name. */
  name: string;
  /** The mobs whose defeat teaches the form (the elder thorn crab teaches the Crab too). */
  from: string[];
  /** Its colour: the family's telegraph glow, for the form's aura and its key on the HUD. */
  color: string;
  /** The part-rigged model the form wears (art/props-enemies/build_enemies.py). */
  model: string;
  /** The design sheet's row: the form's role, its click attack and its shift-in move. */
  role: { role: string; click: string; shift: string };
  /** The moves a form borrows: the mob's attack for the click, and what the shift-in move is built from. */
  moves: { click: EnemyAttack; shift: EnemyAttack };
  /** The mob mechanic the form carries (the fox's pack turns, the crab's front shell, the wisp's blink range, the sprite's slowing pollen). */
  trait: Pick<EnemyType, "pack" | "shell" | "kite" | "hazard" | "turn">;
}

const attack = (id: string, shape: EnemyAttack["shape"]) => ENEMIES[id].attacks.find(a => a.shape === shape)!;
const trait = (id: string, keys: (keyof MobFamily["trait"])[]) => Object.fromEntries(keys.map(k => [k, ENEMIES[id][k]])) as MobFamily["trait"];

export const MOB_FAMILIES: Record<MobFamilyKey, MobFamily> = {
  fox: {
    key: "fox", name: "Fox", from: ["shadow-fox"], color: "#a66bff", model: ENEMIES["shadow-fox"].model,
    role: { role: "Basic attack", click: "Fast bite combo", shift: "Lunge" },
    // The pounce is both: its crouch and 3.6 u leap make the Lunge; its reach and damage scale the bites.
    moves: { click: attack("shadow-fox", "pounce"), shift: attack("shadow-fox", "pounce") },
    trait: trait("shadow-fox", ["pack"]),
  },
  crab: {
    key: "crab", name: "Crab", from: ["thorn-crab", "elder-thorn-crab"], color: "#ffb347", model: ENEMIES["thorn-crab"].model,
    role: { role: "Shield", click: "Pinch; blocks from the front", shift: "Block" },
    // The pinch is the claw sweep; the block is the front shell (its arc and the share of a hit that gets through).
    moves: { click: attack("thorn-crab", "sweep"), shift: attack("thorn-crab", "sweep") },
    trait: trait("thorn-crab", ["shell", "turn"]),
  },
  wisp: {
    key: "wisp", name: "Wisp", from: ["rune-wisp"], color: "#7ff0ff", model: ENEMIES["rune-wisp"].model,
    role: { role: "Ranged", click: "Rune bolts", shift: "Blink-hover" },
    // Rune bolts fly at RUNE_BOLT_SPEED down a line; the blink hops `leap` u away.
    moves: { click: attack("rune-wisp", "spit"), shift: attack("rune-wisp", "blink") },
    trait: trait("rune-wisp", ["kite"]),
  },
  pollen: {
    key: "pollen", name: "Pollen", from: ["pollen-sprite"], color: "#f2cf5b", model: ENEMIES["pollen-sprite"].model,
    role: { role: "Movement", click: "Sting the target", shift: "Burst into a sprite swarm: flit fast, briefly untargetable, keeps momentum" },
    // The sting is the sprite's dart; the burst is its pollen cloud (radius, how long it hangs, how much it slows).
    moves: { click: attack("pollen-sprite", "dart"), shift: attack("pollen-sprite", "dart") },
    trait: trait("pollen-sprite", ["pack", "hazard"]),
  },
};
/** The family a defeated mob belongs to (its form to learn), if it has one. */
export const familyOf = (enemyId: string): MobFamily | null => Object.values(MOB_FAMILIES).find(f => f.from.includes(enemyId)) ?? null;
export { RUNE_BOLT_SPEED };
