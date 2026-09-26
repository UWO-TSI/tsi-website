/**
 * Combat data for the island: the systems agent's weapons, enemies, missions
 * and runes (web/lib/combat via islandAdapter) plus island presentation keyed
 * by id: dump placeholder models, attack shapes, timings, speeds, and blurbs.
 */
import { islandEnemies, islandMissions, islandWeapons } from "@/lib/combat/islandAdapter";
import { ENEMIES as ROSTER } from "@/lib/combat/content";
import type { AttackShape, EnemyType, MissionDef, Weapon } from "./contract";

const F = "/assets/acnh/furniture/";

/** Ruling 2026-09-26: when the gate opens everyone gets one starter of each archetype. */
export const WEAPON_ORDER = ["sword-driftwood", "bow-willow", "staff-oak", "tome-spirits"] as const;
const WEAPON_LOOK: Record<string, Pick<Weapon, "cooldown" | "range" | "arc" | "speed" | "model" | "modelScale">> = {
  "sword-driftwood": { cooldown: 0.42, range: 1.7, arc: 1.9, model: `${F}weapon-sword.glb`, modelScale: 0.06 },
  "bow-willow": { cooldown: 0.6, range: 11, arc: 0, speed: 18, model: `${F}weapon-bow.glb`, modelScale: 0.035 },
  "staff-oak": { cooldown: 0.75, range: 8, arc: 0, speed: 11, model: `${F}weapon-staff.glb`, modelScale: 0.12 },
  "tome-spirits": { cooldown: 6, range: 7, arc: 0, model: `${F}weapon-staff.glb`, modelScale: 0.08 },
};
export const WEAPONS: Record<string, Weapon> = Object.fromEntries(islandWeapons()
  .filter(w => WEAPON_LOOK[w.id])
  .map(w => [w.id, { ...w, ...WEAPON_LOOK[w.id] }]));

interface EnemyLook { speed: number; radius: number; shape: AttackShape; windup: number; recover: number; range?: number; arc: number; knockback: number; model: string; modelScale: number; modelYaw: number; hover: number }
const ENEMY_LOOK: Record<string, EnemyLook> = {
  "shadow-fox": { speed: 3.2, radius: 0.5, shape: "lunge", windup: 0.55, recover: 0.6, arc: 1.2, knockback: 3, model: `${F}enemy-scorpion.glb`, modelScale: 0.2, modelYaw: 0, hover: 0 },
  "thorn-crab": { speed: 1.8, radius: 0.6, shape: "sweep", windup: 0.8, recover: 0.8, arc: 2, knockback: 4, model: "/assets/acnh/props/crab-gazami.glb", modelScale: 2.4, modelYaw: 0, hover: 0 },
  "mushroom-beast": { speed: 1.4, radius: 0.55, shape: "spit", windup: 0.9, recover: 1.1, arc: 0, knockback: 1.5, model: `${F}enemy-tarantula.glb`, modelScale: 0.3, modelYaw: 0, hover: 0 },
  "rune-wisp": { speed: 3.4, radius: 0.4, shape: "spit", windup: 0.7, recover: 0.9, arc: 0, knockback: 1.5, model: `${F}enemy-wasp.glb`, modelScale: 0.16, modelYaw: 0, hover: 1.1 },
  "animated-book": { speed: 2.6, radius: 0.5, shape: "lunge", windup: 0.6, recover: 0.7, arc: 1.3, knockback: 3, model: `${F}enemy-construct.glb`, modelScale: 0.16, modelYaw: Math.PI, hover: 0 },
  "stone-golem": { speed: 1.6, radius: 0.75, shape: "slam", windup: 1.0, recover: 1.1, range: 2.4, arc: Math.PI * 2, knockback: 5, model: `${F}enemy-construct.glb`, modelScale: 0.24, modelYaw: Math.PI, hover: 0 },
  "elder-thorn-crab": { speed: 1.6, radius: 0.8, shape: "sweep", windup: 0.9, recover: 0.9, arc: 2.4, knockback: 5, model: "/assets/acnh/props/crab-gazami.glb", modelScale: 3.4, modelYaw: 0, hover: 0 },
  "guardian-statue": { speed: 1.1, radius: 1.6, shape: "slam", windup: 1.4, recover: 1.2, range: 4, arc: Math.PI * 2, knockback: 7, model: `${F}boss-statue.glb`, modelScale: 0.26, modelYaw: Math.PI, hover: 0 },
};
/** Attack reach straight from the systems roster (the adapter doesn't carry it). */
const RANGE: Record<string, number> = Object.fromEntries(ROSTER.map(e => [e.key, e.attack_range]));

export const ENEMIES: Record<string, EnemyType> = Object.fromEntries(islandEnemies().filter(e => ENEMY_LOOK[e.id]).map(e => {
  const look = ENEMY_LOOK[e.id];
  const type: EnemyType = {
    id: e.id, name: e.name, kind: e.kind, level: e.level, hp: e.hp, defense: e.defense, xp: e.xp, elite: e.elite,
    aggroRadius: e.aggroRadius, leashRadius: e.leashRadius, speed: look.speed, radius: look.radius,
    attack: { shape: look.shape, windup: look.windup, recover: look.recover, damage: e.damage, range: look.range ?? RANGE[e.id], arc: look.arc, knockback: look.knockback },
    model: look.model, modelScale: look.modelScale, modelYaw: look.modelYaw, hover: look.hover,
  };
  return [e.id, type];
}));

/** Island wording for the board (systems titles, island blurbs). */
const BLURB: Record<string, string> = {
  "hunt-foxes": "Shadow foxes are stalking the ruins path. Drive six of them off.",
  "fetch-lantern": "An old lantern was dropped by the fox den. Bring it back to the gate.",
  "survive-circle": "Stand inside the rune circle while the ruins test you, three waves.",
  "escort-botanist": "Walk the botanist through the wild area to the temple steps, checkpoint by checkpoint.",
};
export const MISSIONS: MissionDef[] = islandMissions().map(m => ({ ...m, blurb: BLURB[m.id] ?? m.blurb }));
/** One authored mission per template on the gate board (outer zone first). */
export const BOARD_MISSIONS: MissionDef[] = (["hunt", "fetch", "survive", "escort"] as const).map(t => MISSIONS.find(m => m.template === t)!);

/** Player baseline until progression loads (derived HP comes from /api/combat/progression). */
export const PLAYER_BASE = { maxHp: 100, speed: 7.4, maxEnergy: 100 };
