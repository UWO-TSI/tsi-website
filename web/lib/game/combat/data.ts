/**
 * Combat data for the island: the systems agent's weapons, enemies, missions
 * and runes (web/lib/combat via islandAdapter) plus island presentation keyed
 * by id: models, attack shapes, timings, speeds, and blurbs. Models are the
 * Blender GLBs from art/props-enemies, authored at the character rig's scale,
 * so modelScale 1.3 = CHARACTER_SCALE keeps them in proportion to the player.
 */
import { islandEnemies, islandMissions, islandWeapons } from "@/lib/combat/islandAdapter";
import type { EnemyAttack, EnemyType, MissionDef, Weapon } from "./contract";

const W = "/assets/game/weapons/", E = "/assets/game/enemies/";

/** Ruling 2026-09-26: when the gate opens everyone gets one starter of each archetype. */
export const WEAPON_ORDER = ["sword-driftwood", "bow-willow", "staff-oak", "tome-spirits"] as const;
type Look = Pick<Weapon, "cooldown" | "range" | "arc" | "speed" | "model" | "modelScale" | "grip">;
const WEAPON_LOOK: Record<string, Look> = {
  "sword-driftwood": { cooldown: 0.42, range: 1.7, arc: 1.9, model: `${W}sword-driftwood.glb`, modelScale: 1.3 },
  "bow-willow": { cooldown: 0.6, range: 11, arc: 0, speed: 18, model: `${W}bow-willow.glb`, modelScale: 1.3 },
  "staff-oak": { cooldown: 0.75, range: 8, arc: 0, speed: 11, model: `${W}staff-oak.glb`, modelScale: 1.3 },
  "tome-spirits": { cooldown: 6, range: 7, arc: 0, model: `${W}tome-spirits.glb`, modelScale: 1.3 },
  // Crafted (lib/crafting/recipes.ts): damage comes from the tier in the weapons table; these are the feel.
  "sword-iron": { cooldown: 0.45, range: 1.9, arc: 2.0, model: `${W}sword-iron.glb`, modelScale: 1.3 },
  "bow-yew": { cooldown: 0.7, range: 14, arc: 0, speed: 22, model: `${W}bow-yew.glb`, modelScale: 1.3 },
  // Barrel along +Z, so its own grips (left-hand socket, solved from the v6 AttackBow and Idle frames):
  // level and forward when firing, pointed at the ground ahead at rest, barrel down on the back.
  "revolver-brass": { cooldown: 0.34, range: 10, arc: 0, speed: 30, model: `${W}revolver-brass.glb`, modelScale: 1.3,
    grip: { hand: [0.81, 1.41, -0.92], rest: [0.53, 0.92, 0.85], back: [Math.PI / 2, 0, 0] } },
  "staff-rune": { cooldown: 0.7, range: 9, arc: 0, speed: 13, model: `${W}staff-rune.glb`, modelScale: 1.3 },
  // Guardian statue drops (row 21). ponytail: they reuse the crafted models, larger, until the Epic/Legendary set is modelled.
  "sword-guardian": { cooldown: 0.45, range: 2.1, arc: 2.1, model: `${W}sword-iron.glb`, modelScale: 1.5 },
  "bow-sentinel": { cooldown: 0.65, range: 15, arc: 0, speed: 24, model: `${W}bow-yew.glb`, modelScale: 1.45 },
  "staff-sigil": { cooldown: 0.65, range: 10, arc: 0, speed: 14, model: `${W}staff-rune.glb`, modelScale: 1.45 },
  "tome-warden": { cooldown: 5, range: 8, arc: 0, model: `${W}tome-spirits.glb`, modelScale: 1.5 },
  "staff-heartstone": { cooldown: 0.6, range: 11, arc: 0, speed: 15, model: `${W}staff-rune.glb`, modelScale: 1.6 },
};
export const WEAPONS: Record<string, Weapon> = Object.fromEntries(islandWeapons()
  .filter(w => WEAPON_LOOK[w.id])
  .map(w => [w.id, { ...w, ...WEAPON_LOOK[w.id] }]));

type Move = Omit<EnemyAttack, "damage" | "range"> & { range?: number; power?: number };
interface EnemyLook { speed: number; radius: number; attacks: Move[]; model: string; modelScale: number; modelYaw: number; hover: number }
const look = (speed: number, radius: number, attacks: Move[], model: string, hover = 0): EnemyLook => ({ speed, radius, attacks, model: `${E}${model}.glb`, modelScale: 1.3, modelYaw: 0, hover });
const ENEMY_LOOK: Record<string, EnemyLook> = {
  "shadow-fox": look(3.2, 0.5, [{ shape: "lunge", windup: 0.55, recover: 0.6, arc: 1.2, knockback: 3 }], "shadow-fox"),
  "thorn-crab": look(1.8, 0.6, [{ shape: "sweep", windup: 0.8, recover: 0.8, arc: 2, knockback: 4 }], "thorn-crab"),
  "mushroom-beast": look(1.4, 0.55, [{ shape: "spit", windup: 0.9, recover: 1.1, arc: 0, knockback: 1.5 }], "mushroom-beast"),
  "rune-wisp": look(3.4, 0.4, [{ shape: "spit", windup: 0.7, recover: 0.9, arc: 0, knockback: 1.5 }], "rune-wisp", 1.1),
  "animated-book": look(2.6, 0.5, [{ shape: "lunge", windup: 0.6, recover: 0.7, arc: 1.3, knockback: 3 }], "animated-book"),
  "stone-golem": look(1.6, 0.75, [{ shape: "slam", windup: 1.0, recover: 1.1, range: 2.4, arc: Math.PI * 2, knockback: 5 }], "stone-golem"),
  "elder-thorn-crab": look(1.6, 0.8, [{ shape: "sweep", windup: 0.9, recover: 0.9, arc: 2.4, knockback: 5 }], "elder-thorn-crab"),
  // Three readable patterns (sim.ts BOSS_PLAN): the smash lands on a ring where you stood, the beam
  // sweeps 140° in front and leaves it staggered, the summon calls two rune wisps.
  "guardian-statue": look(1.1, 1.6, [
    { shape: "smash", windup: 1.3, recover: 1.0, range: 2.4, reach: 9, arc: Math.PI * 2, knockback: 7 },
    { shape: "beam", windup: 1.1, active: 1.6, recover: 3.2, stagger: true, range: 11, reach: 8, arc: 2.45, knockback: 3, power: 0.9 },
    { shape: "summon", windup: 1.2, recover: 0.8, range: 0, reach: 20, arc: 0, knockback: 0, power: 0 },
  ], "guardian-statue"),
};

export const ENEMIES: Record<string, EnemyType> = Object.fromEntries(islandEnemies().filter(e => ENEMY_LOOK[e.id]).map(e => {
  const { attacks, ...l } = ENEMY_LOOK[e.id];
  const type: EnemyType = {
    id: e.id, name: e.name, kind: e.kind, level: e.level, hp: e.hp, defense: e.defense, armor: e.armor, xp: e.xp, elite: e.elite,
    aggroRadius: e.aggroRadius, leashRadius: e.leashRadius, speed: l.speed, radius: l.radius,
    attacks: attacks.map(({ power = 1, range, ...m }) => ({ ...m, range: range ?? e.range, damage: Math.round(e.damage * power) })),
    model: l.model, modelScale: l.modelScale, modelYaw: l.modelYaw, hover: l.hover,
  };
  return [e.id, type];
}));

/** Island wording for the board (systems titles, island blurbs). */
const BLURB: Record<string, string> = {
  "hunt-foxes": "Shadow foxes are stalking the ruins path. Drive six of them off.",
  "hunt-crabs": "Thorn crabs have dug in across the wild. Clear five before they spread.",
  "hunt-wisps": "Rune wisps drift over the outer wild. Put four of them out.",
  "hunt-golem": "A stone golem guards the temple court. Break one.",
  "fetch-lantern": "An old lantern was dropped by the fox den. Bring it back to the gate.",
  "fetch-tome": "A sealed tome is still in the temple library. Bring it out to the gate.",
  "survive-circle": "Stand inside the rune circle while the ruins test you, three waves.",
  "survive-sanctum": "Hold the circle in the temple court through four waves of constructs.",
  "escort-botanist": "Walk the botanist through the wild area to the temple steps, checkpoint by checkpoint.",
  "escort-scholar": "Take the scholar through the temple to the shrine before the guardian's chamber.",
};
export const MISSIONS: MissionDef[] = islandMissions().map(m => ({ ...m, blurb: BLURB[m.id] ?? m.blurb }));

/** Player baseline until progression loads (derived HP comes from /api/combat/progression). */
export const PLAYER_BASE = { maxHp: 100, speed: 7.4, maxEnergy: 100 };
