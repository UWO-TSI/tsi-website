/**
 * A test rig for class kits (the Ranger tests and the generic class fire tests): a kit on its tier-1 signature weapon
 * at a mastery, training dummies that never move or swing, frames of the class layer and the encounter, a held mouse,
 * a key tap. Imported by tests only.
 */
import { classKey, equipClassKit, stepClass } from "../classRuntime";
import { attack } from "../actions";
import { ENEMIES } from "../data";
import { stepCombat } from "../encounter";
import { createRuntime, type CombatRuntime } from "../runtime";
import { spawnEnemy, type Enemy } from "../sim";
import type { ClassKit } from "@/lib/combat/classes";
import { signatureGrant } from "@/lib/combat/weapons";

export const DT = 1 / 30, ME = { x: 0, z: 0 };
export const never = () => 0.99; // no rolled crits
/** A training dummy: it never moves or swings, no defence, lots of health. */
export const DUMMY = { ...ENEMIES["shadow-fox"], id: "dummy", hp: 100000, defense: 0, armor: 0, speed: 0, elite: false, kind: "wildlife" as const, aggroRadius: 0, pack: undefined,
  attacks: ENEMIES["shadow-fox"].attacks.map(a => ({ ...a, range: 0.01, reach: 0.01 })) };
export const dummy = (rt: CombatRuntime, x: number, z: number, id = `d${rt.enemies.length}`, hp = DUMMY.hp): Enemy => {
  const e: Enemy = { ...spawnEnemy(id, { ...DUMMY, hp }, x, z), state: "chase" };
  rt.enemies.push(e);
  return e;
};
export function setup(kit: ClassKit, mastery = 1, weapon = signatureGrant(kit.key, 1)?.key ?? "staff-oak") {
  const rt = createRuntime(), p = rt.player;
  p.safe = false; p.level = 10; p.weapon = weapon; p.owned.push(p.weapon);
  equipClassKit(rt, kit, mastery);
  p.energy = 100; p.hp = p.maxHp; p.aim = { x: 0, z: 6 }; p.facing = 0; p.last = { ...ME };
  return { rt, p };
}
export function frame(rt: CombatRuntime, n = 1, free: (x: number, z: number, r: number) => boolean = () => true) {
  for (let i = 0; i < n; i++) { stepClass(rt, ME, DT, DT, never); stepCombat(rt, ME, DT, free, never); }
}
/** Hold the mouse for `seconds`: a shot whenever the weapon's ready. Returns the shots fired. */
export function holdFire(rt: CombatRuntime, seconds: number, free?: (x: number, z: number, r: number) => boolean) {
  let shots = 0;
  for (let t = 0; t < seconds; t += DT) { if (attack(rt, ME, never)) shots++; frame(rt, 1, free); }
  return shots;
}
export const tap = (rt: CombatRuntime, slot: number) => { classKey(rt, slot, true); classKey(rt, slot, false); frame(rt); };
export const dealt = (e: Enemy) => DUMMY.hp - e.hp;
