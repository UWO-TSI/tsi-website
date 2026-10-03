/**
 * Combat data for the island: the systems agent's weapons, enemies, missions
 * and runes (web/lib/combat via islandAdapter) plus island presentation keyed
 * by id: models, attack shapes, timings, speeds, and blurbs. Models are the
 * Blender GLBs from art/props-enemies, authored at the character rig's scale,
 * so modelScale 1.3 = CHARACTER_SCALE keeps them in proportion to the player.
 */
import { islandEnemies, islandMissions, islandWeapons } from "@/lib/combat/islandAdapter";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { WARDEN_WEAPONS } from "@/lib/combat/wardenData";
import type { EnemyAttack, EnemyType, MissionDef, Weapon } from "./contract";
import { WARDEN_BODIES } from "./wardenBodies";

const W = "/assets/game/weapons/", E = "/assets/game/enemies/";

type Look = Pick<Weapon, "cooldown" | "range" | "arc" | "speed" | "model" | "modelScale" | "grip" | "pulse" | "shot">;
/**
 * The Rangers' grips in socket space (three.js Euler XYZ, solved from the clips' frames by
 * art/props-enemies/render_ranger.py `grips`): in the hand while shooting, at rest in the hand, across the back.
 */
const RIFLE_GRIP: NonNullable<Look["grip"]> = { hand: [-2.382, -0.919, 2.97], rest: [-0.729, 0.946, 2.325], back: [-1.571, 0.585, 0] };
const RANGER_GRIPS: Record<string, Look["grip"]> = {
  rifle: RIFLE_GRIP, harpoon: RIFLE_GRIP,
  // The revolver is authored as the brass one (barrel +Z in glTF): its grips.
  sixgun: { hand: [0.81, 1.41, -0.92], rest: [0.53, 0.92, 0.85], back: [Math.PI / 2, 0, 0] },
};
const WEAPON_LOOK: Record<string, Look> = {
  // Combat polish 11 (specs/evidence/combat-b/balance.md): the driftwood sword 0.42 → 0.45, the oak staff 0.75 → 0.5 with a
  // faster bolt (11 → 15), the wraps 0.32 → 0.42, so every subclass's normal-mission DPS sits within ±25% of the median.
  "sword-driftwood": { cooldown: 0.45, range: 1.7, arc: 1.9, model: `${W}sword-driftwood.glb`, modelScale: 1.3 },
  "bow-willow": { cooldown: 0.6, range: 11, arc: 0, speed: 18, model: `${W}bow-willow.glb`, modelScale: 1.3 },
  "staff-oak": { cooldown: 0.5, range: 8, arc: 0, speed: 15, model: `${W}staff-oak.glb`, modelScale: 1.3 },
  "tome-spirits": { cooldown: 6, range: 7, arc: 0, model: `${W}tome-spirits.glb`, modelScale: 1.3 },
  // Bare hands with wraps (the Martial Artist's full combo): quick, short, nothing held.
  "wraps-cloth": { cooldown: 0.42, range: 1.35, arc: 1.7, model: "", modelScale: 1 },
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
  // Classes v2, the Rangers' signature weapons (art/props-enemies/build_weapons.py, one model per tier). The kit's own fire
  // (lib/combat/rangerKits.ts) sets their pace in the ruins; these are the range the bot holds and the hand grips.
  ...signatureLooks("recurve", { cooldown: 0.67, range: 11, arc: 0, speed: 24 }, RANGER_GRIPS.recurve),
  ...signatureLooks("rifle", { cooldown: 1, range: 16, arc: 0, speed: 70 }, RANGER_GRIPS.rifle),
  ...signatureLooks("harpoon", { cooldown: 0.83, range: 11, arc: 0, speed: 30 }, RANGER_GRIPS.harpoon),
  ...signatureLooks("sixgun", { cooldown: 0.31, range: 10, arc: 0, speed: 55 }, RANGER_GRIPS.sixgun),
};
// Classes v2 signature weapons (the Vanguard wave): one look per type, a model per tier (art/props-enemies/build_vanguard_weapons.py).
// Grips from art/props-enemies/solve_vanguard_grips.py (vanguard_grips.json): the melee hold in the right hand, the OffHand
// part's rotation in the left (the shield facing forward on the forearm; the second tanto and the left wrap mirrored), the
// hammer upright at rest like a staff.
const MELEE_HAND: [number, number, number] = [Math.PI / 2, 0, 0], BACK: [number, number, number] = [0, 0, 0.5], MIRRORED: [number, number, number] = [1.942, -0.255, -0.15];
const SIGNATURE_LOOK: Record<string, Omit<Look, "model">> = {
  aegis: { cooldown: 0.5, range: 1.8, arc: 2.0, modelScale: 1.3, grip: { hand: MELEE_HAND, back: BACK, off: [0.029, 0.238, 1.146] } },
  warhammer: { cooldown: 0.85, range: 2.2, arc: 2.4, modelScale: 1.3, grip: { hand: [2.27, 0, 0], back: BACK, rest: [0.03, -0.24, -1.15] } }, // swinging, the head tilted down to meet the ground
  handwraps: { cooldown: 0.36, range: 1.45, arc: 1.6, modelScale: 1.3, grip: { hand: MELEE_HAND, back: BACK, off: MIRRORED } },
  tanto: { cooldown: 0.4, range: 1.5, arc: 1.9, modelScale: 1.3, grip: { hand: MELEE_HAND, back: BACK, off: MIRRORED } },
};
for (const w of SYSTEM_WEAPONS) if (w.subclass && SIGNATURE_LOOK[w.type]) WEAPON_LOOK[w.key] = { ...SIGNATURE_LOOK[w.type], model: `${W}${w.key}.glb`, ...(w.tier === 5 ? { pulse: true } : {}) }; // tier 5's runes breathe
function signatureLooks(type: string, feel: Pick<Look, "cooldown" | "range" | "arc" | "speed">, grip?: Look["grip"]): Record<string, Look> {
  return Object.fromEntries([1, 2, 3, 4, 5].map(t => [`${type}-${t}`, { ...feel, model: `${W}${type}-${t}.glb`, modelScale: 1.3, ...(grip ? { grip } : {}), ...(t === 5 ? { pulse: true } : {}) }]));
}
// Classes v2, Arcane signature weapons (lib/combat/arcaneSeed.ts): one feel per type, every tier its own model.
// The deck throws cards and the tome bone shards (their shot looks); the charm fights with bare fists. Grips solved on
// the v7 rig and the verb library's hold idles (art/props-enemies/build_arcane.py `-- held`): the staff stands beside
// the head, the deck fans above the right hand, the tome stands at the chest in the left, the charm wraps the right fist.
const ARCANE_LOOK: Record<string, Omit<Look, "model">> = {
  "prism-staff": { cooldown: 0.6, range: 8.5, arc: 0, speed: 15, modelScale: 1.3, grip: { hand: [Math.PI / 2, 0, 0], rest: [-1.084, -1.022, -2.079], back: [0, 0, -0.5] } },
  "trick-deck": { cooldown: 0.45, range: 9, arc: 0, speed: 18, modelScale: 1.3, grip: { hand: [-0.41, -0.494, -0.8], back: [0, 0, Math.PI] } },
  "bone-tome": { cooldown: 0.6, range: 8, arc: 0, speed: 16, modelScale: 1.3, grip: { hand: [0.465, 0.181, 0.344], back: [Math.PI, -Math.PI / 2, 0] } },
  "tooth-charm": { cooldown: 0.45, range: 1.4, arc: 1.7, modelScale: 1.3, grip: { hand: [0, -Math.PI / 2, 0], back: [0, Math.PI, 0] } },
};
const SHOT: Record<string, Weapon["shot"]> = { "trick-deck": "card", "bone-tome": "bone" };
for (const [type, look] of Object.entries(ARCANE_LOOK)) for (let t = 1; t <= 5; t++) WEAPON_LOOK[`${type}-${t}`] = { ...look, model: `${W}${type}-${t}.glb`, ...(SHOT[type] ? { shot: SHOT[type] } : {}) } as Look;
// Classes v2, the Warden wave's signature weapons (art/props-enemies/build_warden.py, a model per tier): the seal gloves'
// shadow lash snaps out from the hand to 7 u (worn, so held like a blade: no upright rest); the three staffs throw their
// bolts (the spirit bolt, thorn seeds, the Lightbolt).
const WARDEN_LOOK: Record<string, Omit<Look, "model">> = {
  "seal-gloves": { cooldown: 0.6, range: 7, arc: 0, speed: 24, modelScale: 1.3, grip: { hand: [Math.PI / 2, 0, 0], back: [0, 0, 0.5] } },
  "totem-staff": { cooldown: 0.6, range: 9, arc: 0, speed: 16, modelScale: 1.3 },
  "living-staff": { cooldown: 0.55, range: 8, arc: 0, speed: 15, modelScale: 1.3 },
  "sunstone-staff": { cooldown: 0.55, range: 9, arc: 0, speed: 17, modelScale: 1.3 },
};
for (const w of WARDEN_WEAPONS) WEAPON_LOOK[w.key] = { ...WARDEN_LOOK[w.type], model: `${W}${w.key}.glb` };
export const WEAPONS: Record<string, Weapon> = Object.fromEntries(islandWeapons()
  .filter(w => WEAPON_LOOK[w.id])
  .map(w => [w.id, { ...w, ...WEAPON_LOOK[w.id] }]));

type Move = Omit<EnemyAttack, "damage" | "range"> & { range?: number; power?: number };
type Behaviour = Pick<EnemyType, "turn" | "shell" | "pack" | "kite" | "hazard" | "miniboss">;
interface EnemyLook extends Behaviour { speed: number; radius: number; attacks: Move[]; model: string; modelScale: number; modelYaw: number; hover: number }
const look = (speed: number, radius: number, attacks: Move[], model: string, hover = 0, behaviour: Behaviour = {}): EnemyLook => ({ speed, radius, attacks, model: `${E}${model}.glb`, modelScale: 1.3, modelYaw: 0, hover, ...behaviour });
/**
 * Zone 1, the Overgrown Outskirts (design sheet "Mobs, zone 1"; sim.ts runs the behaviours): fox packs flank and pounce,
 * crabs turn a front shell to you, mushrooms lob spores that leave poison, wisps bolt and blink, pollen sprites swarm and
 * burst into slowing pollen, and the elder thorn crab fights in three phases.
 */
const ENEMY_LOOK: Record<string, EnemyLook> = {
  // Packs of three circle to slots round you and pounce in turn: a 0.6 s crouch (mane and eyes flare), then 3.6 u along a lane.
  "shadow-fox": look(3.4, 0.5, [{ shape: "pounce", windup: 0.6, active: 0.28, leap: 3.6, recover: 0.7, range: 1.5, reach: 3.2, arc: 0, knockback: 3 }], "shadow-fox", 0, { pack: "flank" }),
  // The front shell turns 80% of a hit aside; it turns at 2 rad/s, so circling or a dodge past it opens its flank.
  "thorn-crab": look(1.8, 0.6, [{ shape: "sweep", windup: 0.8, recover: 0.8, arc: 2, knockback: 4 }], "thorn-crab", 0, { turn: 2, shell: { arc: 2.2, front: 0.2 } }),
  // A spore ball arcs 0.85 s onto the marked ring (1.1 u burst), and the burst leaves a poison puddle for 4 s.
  "mushroom-beast": look(1.4, 0.55, [{ shape: "lob", windup: 0.9, active: 0.85, recover: 1.1, range: 6.5, reach: 5.5, arc: 0, splash: 1.1, knockback: 1.5 }], "mushroom-beast", 0,
    { hazard: { kind: "poison", radius: 1.2, life: 4, damage: 3, every: 0.5 } }),
  // A rune bolt down the marked line; closer than 3.2 u it shimmers 0.3 s and blinks 4 u away (every 3.5 s at most).
  "rune-wisp": look(3.4, 0.4, [
    { shape: "spit", windup: 0.7, recover: 0.9, arc: 0, knockback: 1.5 },
    { shape: "blink", windup: 0.3, recover: 0.35, leap: 4, range: 0, arc: 0, knockback: 0, power: 0 },
  ], "rune-wisp", 1.1, { kite: { keep: 3.2, every: 3.5 } }),
  // Clouds of 8–15 orbit you; one by one each flashes 0.4 s and darts 3.2 u, bursting into pollen that slows you 35%.
  "pollen-sprite": look(4.2, 0.22, [{ shape: "dart", windup: 0.4, active: 0.32, leap: 3.2, recover: 0.2, reach: 2.9, arc: 0, knockback: 1 }], "pollen-sprite", 0.75,
    { pack: "swarm", hazard: { kind: "pollen", radius: 1.3, life: 2.5, damage: 0, every: 0.5, slow: 0.35 } }),
  // Combat polish 11: the temple's pressure moved from the golem's slam (which only melee stood in) to the books' charge,
  // which reaches the back line too: books 2.6 → 4.4 u/s with a 3 u lunge at ×1.3; golems 1.6 → 2.8 u/s, the slam ×0.41 with a longer recover.
  "animated-book": look(4.4, 0.5, [{ shape: "lunge", windup: 0.6, recover: 0.7, range: 3, reach: 2.6, arc: 1.3, knockback: 3, power: 1.3 }], "animated-book"),
  "stone-golem": look(2.8, 0.75, [{ shape: "slam", windup: 1.0, recover: 1.6, range: 2.4, arc: Math.PI * 2, knockback: 5, power: 0.41 }], "stone-golem"),
  // The mini-boss (sim.ts PLANS): sweeps with the shell closed; cracked at 60%, faster and a charge down a lane that ends
  // in a stagger; enraged at 25%, claw slams whose shockwave runs out to 6 u (dodge through it).
  "elder-thorn-crab": look(1.7, 0.8, [
    { shape: "sweep", windup: 0.9, recover: 0.9, arc: 2.4, knockback: 5 },
    { shape: "charge", windup: 1.0, active: 0.6, leap: 7, recover: 1.4, stagger: true, reach: 7, range: 1.8, arc: 0, knockback: 6, power: 1.2 },
    { shape: "slam", windup: 1.1, recover: 1.0, range: 2.2, reach: 1.9, arc: Math.PI * 2, splash: 6, knockback: 5, power: 1.1 },
  ], "elder-thorn-crab", 0, { turn: 1.4, shell: { arc: 2.4, front: 0.15, cracked: 0.5 }, hazard: { kind: "wave", radius: 6, life: 0.7, damage: 0, every: 0 }, miniboss: { title: "Old shell of the Outskirts" } }),
  // Three readable patterns (sim.ts BOSS_PLAN): the smash lands on a ring where you stood, the beam
  // sweeps 140° in front and leaves it staggered, the summon calls two rune wisps.
  "guardian-statue": look(1.1, 1.6, [
    { shape: "smash", windup: 1.3, recover: 1.0, range: 2.4, reach: 9, arc: Math.PI * 2, knockback: 7 },
    { shape: "beam", windup: 1.1, active: 1.6, recover: 3.2, stagger: true, range: 11, reach: 8, arc: 2.45, knockback: 3, power: 0.9 },
    { shape: "summon", windup: 1.2, recover: 0.8, range: 0, reach: 20, arc: 0, knockback: 0, power: 0 },
  ], "guardian-statue"),
};

export const ENEMIES: Record<string, EnemyType> = { ...WARDEN_BODIES, ...Object.fromEntries(islandEnemies().filter(e => ENEMY_LOOK[e.id]).map(e => {
  const { attacks, ...l } = ENEMY_LOOK[e.id];
  const type: EnemyType = {
    id: e.id, name: e.name, kind: e.kind, level: e.level, hp: e.hp, defense: e.defense, armor: e.armor, xp: e.xp, elite: e.elite,
    aggroRadius: e.aggroRadius, leashRadius: e.leashRadius, ...l,
    attacks: attacks.map(({ power = 1, range, ...m }) => ({ ...m, range: range ?? e.range, damage: Math.round(e.damage * power) })),
  };
  return [e.id, type];
})) };

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
export const PLAYER_BASE = { maxHp: 100, speed: 7.4 };
