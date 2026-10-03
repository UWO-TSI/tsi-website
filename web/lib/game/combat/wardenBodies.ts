/**
 * The Warden wave's bodies on the island (classes v2): the Summoner's shadow beasts and the Shaman's totems and spirits
 * as ally bodies (units borrow these to be drawn and posed: EncounterRender's instanced enemies, `allies`), and the
 * beasts' untamed forms the ritual circle calls (real enemies, `local`: their fall is a taming, not a server kill).
 * Models are hand-built in Blender (art/props-enemies/build_warden.py), each a few named parts the shared telegraph
 * helper poses (body, head, wing_*, leg_*, tail, ring). Ally bodies never act on their own; their numbers only pose them.
 */
import type { EnemyAttack, EnemyType } from "./contract";

const E = "/assets/game/enemies/";
type Move = Omit<EnemyAttack, "damage"> & { damage?: number };
const body = (id: string, name: string, model: string, attacks: Move[], more: Partial<EnemyType> = {}): EnemyType => ({
  id, name, kind: "wildlife", level: 10, hp: 100, speed: 5, radius: 0.45, defense: 0, armor: 0, xp: 0, elite: false, aggroRadius: 0, leashRadius: 99,
  attacks: attacks.map(m => ({ damage: 0, ...m })), model: `${E}${model}.glb`, modelScale: 1.3, modelYaw: 0, hover: 0, ...more,
});
const idle: Move = { shape: "slam", windup: 0.3, recover: 0.6, range: 2, arc: Math.PI * 2, knockback: 0 };
const pounce: Move = { shape: "pounce", windup: 0.01, active: 0.32, recover: 0.4, range: 1.4, arc: 0, knockback: 0, leap: 0 };

/** Ally bodies: the four beasts, the three totems and the hop's post, the three spirits. */
const ALLIES: EnemyType[] = [
  body("beast-wolf", "Shadow wolf", "beast-wolf", [pounce]),
  body("beast-owl", "Shadow owl", "beast-owl", [pounce], { hover: 1.5 }),
  body("beast-toad", "Shadow toad", "beast-toad", [{ shape: "lunge", windup: 0.3, recover: 0.5, range: 2, arc: 1, knockback: 0 }], { radius: 0.6 }),
  body("beast-serpent", "Shadow serpent", "beast-serpent", [idle]),
  // Totems stand a little over waist high (1.65 × the rig) so a planted field reads from the follow camera.
  body("totem-storm", "Storm totem", "totem-storm", [idle], { modelScale: 1.65 }),
  body("totem-fire", "Fire totem", "totem-fire", [idle], { modelScale: 1.65 }),
  body("totem-earth", "Earthbind totem", "totem-earth", [idle], { modelScale: 1.65 }),
  body("totem-spirit", "Spirit post", "totem-spirit", [idle], { modelScale: 1.65 }),
  body("spirit-thunderbird", "Thunderbird", "spirit-thunderbird", [pounce], { hover: 2.2, modelScale: 1.9 }),
  body("spirit-salamander", "Salamander", "spirit-salamander", [pounce], { modelScale: 1.6 }),
  body("spirit-bear", "Spirit bear", "spirit-bear", [idle], { modelScale: 1.7, radius: 0.8 }),
];

/**
 * The untamed forms (the ritual circle, beasts.ts): the owl swoops and blinks away, the toad lashes its tongue, the
 * serpent charges through the ground and is left reeling, the hare pounces and darts off. Beaten alone with the seal
 * gloves' lash (and Escape Rabbits for the last), about a minute each at level 10 (specs/evidence/classes/K-warden-balance.md).
 */
const RITUAL = { level: 10, kind: "wildlife" as const, defense: 0, armor: 0, xp: 0, elite: true, aggroRadius: 14, leashRadius: 30, local: true, miniboss: { title: "Ritual of shadows" } };
const RITUAL_FORMS: EnemyType[] = [
  body("shadow-owl", "Untamed owl", "shadow-owl", [
    { shape: "pounce", windup: 0.7, active: 0.3, leap: 4.5, recover: 1.0, range: 1.5, reach: 4.2, arc: 0, knockback: 3, damage: 15 },
    { shape: "blink", windup: 0.3, recover: 0.35, leap: 4, range: 0, arc: 0, knockback: 0 },
  ], { ...RITUAL, hp: 460, speed: 4.2, radius: 0.45, hover: 0.9, kite: { keep: 2.4, every: 4.5 } }),
  body("shadow-toad", "Untamed toad", "shadow-toad", [
    { shape: "lunge", windup: 0.8, recover: 1.0, range: 3.2, reach: 3, arc: 0.9, knockback: 4, damage: 17 },
  ], { ...RITUAL, hp: 700, speed: 2.4, radius: 0.6 }),
  body("shadow-serpent", "Untamed serpent", "shadow-serpent", [
    { shape: "charge", windup: 0.85, active: 0.45, leap: 6, recover: 1.2, stagger: true, reach: 6, range: 1.4, arc: 0, knockback: 5, damage: 19 },
  ], { ...RITUAL, hp: 600, speed: 4.4, radius: 0.5 }),
  body("shadow-hare", "Untamed hare", "shadow-hare", [
    { shape: "pounce", windup: 0.45, active: 0.25, leap: 3.6, recover: 0.7, range: 1.2, reach: 3.4, arc: 0, knockback: 2, damage: 12 },
    { shape: "blink", windup: 0.25, recover: 0.3, leap: 4.5, range: 0, arc: 0, knockback: 0 },
  ], { ...RITUAL, hp: 360, speed: 5.6, radius: 0.35, kite: { keep: 2.2, every: 3 } }),
];

export const WARDEN_BODIES: Record<string, EnemyType> = Object.fromEntries([...ALLIES, ...RITUAL_FORMS].map(t => [t.id, t]));
/** The types EncounterRender draws as your units' bodies, and the ritual forms it draws as enemies. */
export const WARDEN_ALLY_TYPES = ALLIES.map(t => t.id);
export const WARDEN_RITUAL_TYPES = RITUAL_FORMS.map(t => t.id);
