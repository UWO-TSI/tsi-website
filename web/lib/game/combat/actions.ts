/**
 * What the player's inputs do to the encounter state (pure over the runtime,
 * testable without a canvas): weapon attacks, shots landing, dodge, taking
 * hits, the ability keys. Damage, wear and potency use the systems rules
 * (web/lib/combat/weapons.ts `damage`) through abilities.ts `strike`; the
 * island owns shapes and timing.
 */
import { ENEMIES, WEAPONS } from "./data";
import type { Vec } from "./sim";
import { BOSS, DODGE, inArc, invulnerable, spawnEnemy, sweptHit, type Enemy } from "./sim";
import { ENERGY, SLOT_IDS, type AbilityId, type CombatRuntime } from "./runtime";
import { cancelCast, cue, floater, mitigate, strike, summon, fireSlot } from "./abilities";
import type { SpawnPoint } from "./spawns";
import { FAMILY_STAT } from "@/lib/combat/kits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { MOVE_TUNING, type MoveTuning } from "@/lib/game/movement/sim";

/** Energy regen: after ENERGY.delay seconds without spending, never while tracing. */
export function regenEnergy(rt: CombatRuntime, dt: number) {
  const p = rt.player;
  p.sinceSpend += dt;
  if (!rt.casting && p.sinceSpend >= ENERGY.delay) p.energy = Math.min(ENERGY.max, p.energy + ENERGY.regen * dt);
}

const wearHit = (rt: CombatRuntime) => { const p = rt.player; p.hits[p.weapon] = (p.hits[p.weapon] ?? 0) + 1; p.durability[p.weapon] = Math.max(0, p.durability[p.weapon] - 1); };

/**
 * Facing (combat polish 10): an attack or ability snaps you to the aim and holds it AIM_HOLD s; otherwise you face the
 * way you move (the movement kit's own turn, `travel`), and standing you turn to the aim. No more sliding feet.
 */
export const AIM_HOLD = 0.6;
const MOVING = 0.6, AIM_TURN = 18;
const aimYaw = (p: CombatRuntime["player"], at: Vec) => {
  const dx = p.aim.x - at.x, dz = p.aim.z - at.z;
  return Math.hypot(dx, dz) > 0.3 ? Math.atan2(dx, dz) : p.facing; // the aim right under you keeps the facing
};
/** Snap to the aim for an attack and hold it. */
export function faceAim(p: CombatRuntime["player"], at: Vec) { p.facing = aimYaw(p, at); p.aimHold = AIM_HOLD; }
/** This frame's facing: `travel` is the movement kit's facing and `speed` how fast you move (PlayerAvatar). */
export function combatFacing(p: CombatRuntime["player"], at: Vec, travel: number, speed: number, dt: number): number {
  if (p.aimHold > 0) return aimYaw(p, at);
  if (speed > MOVING) return travel;
  const to = aimYaw(p, at);
  return p.facing + Math.atan2(Math.sin(to - p.facing), Math.cos(to - p.facing)) * (1 - Math.exp(-AIM_TURN * dt));
}

/** Primary attack with the equipped weapon toward the aim. Returns true if it fired. */
export function attack(rt: CombatRuntime, player: Vec, random = Math.random): boolean {
  const p = rt.player;
  if (!p.alive || p.attackCd > 0 || rt.casting || p.dash || (p.dodgeAge !== null && p.dodgeAge < DODGE.duration)) return false;
  const w = WEAPONS[p.weapon];
  p.attackCd = w.cooldown;
  faceAim(p, player);
  cue(rt, "swing", player);
  const dir = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  if (w.kind === "melee") {
    p.swing = 0.22;
    let landed = false;
    for (const e of rt.enemies) if (e.state !== "dead" && inArc(player, p.facing, w.range, w.arc, e, e.type.radius)) { strike(rt, e, { power: 1, from: player, knock: 4, melee: true }, random); landed = true; }
    if (landed) wearHit(rt);
  } else if (w.kind === "bow" || w.kind === "staff") {
    const speed = w.speed ?? 12;
    rt.projectiles.push({ id: rt.seq++, x: player.x + dir.x * 0.5, z: player.z + dir.z * 0.5, vx: dir.x * speed, vz: dir.z * speed, life: w.range / speed, from: "player", damage: 0, kind: w.kind === "bow" ? "arrow" : "bolt", radius: w.kind === "bow" ? 0.15 : 0.3 });
  } else {
    // The summoning charm: a short-lived wisp at your side (two at most), apart from the kit's summons.
    const stat = SYSTEM_WEAPONS.find(x => x.key === p.weapon)?.scaling[0] ?? FAMILY_STAT.Warden;
    summon(rt, "weapon-wisp", 1, { pos: player, aim: p.aim, dir, sup: 1, stat }, "weapon");
  }
  return true;
}

/** Player projectile hits: weapon shots at weapon damage (staff bolts splash at half), ability and summon shots carry their own power. */
export function resolvePlayerShot(rt: CombatRuntime, shotIdx: number, from: Vec, to: Vec, random = Math.random): boolean {
  const s = rt.projectiles[shotIdx], h = s.hit;
  const target = rt.enemies.find(e => e.state !== "dead" && e.state !== "return" && !h?.hitIds?.includes(e.id) && sweptHit(from, to, e, e.type.radius + s.radius));
  if (!target) return false;
  const knock = s.kind === "arrow" ? 2.5 : 3;
  if (!h) {
    strike(rt, target, { power: 1, from, knock }, random);
    wearHit(rt);
    if (s.kind === "bolt") splash(rt, to, 1.3, target, { power: 0.5, from: to, knock: 2 }, random);
    return true;
  }
  strike(rt, target, { power: h.power, from, knock: h.unit ? 1 : knock, stat: h.stat, tier: h.tier, unit: h.unit, status: h.status }, random);
  if (h.splash) splash(rt, to, h.splash, target, { power: h.power * 0.5, from: to, knock: 2, stat: h.stat, tier: h.tier }, random);
  if (!h.pierce) return true;
  h.hitIds!.push(target.id);
  return false;
}
function splash(rt: CombatRuntime, at: Vec, r: number, skip: Enemy, src: Parameters<typeof strike>[2], random: () => number) {
  rt.blasts.push({ id: rt.seq++, x: at.x, z: at.z, radius: r, color: "#b48cff", age: 0, life: 0.35 });
  for (const e of rt.enemies) if (e !== skip && e.state !== "dead" && Math.hypot(e.x - at.x, e.z - at.z) < r + e.type.radius) strike(rt, e, src, random);
}

export function startDodge(rt: CombatRuntime, dir: Vec): boolean {
  const p = rt.player;
  if (!p.alive || p.dodgeCd > 0) return false;
  cancelCast(rt); // dodge cancels casting (row C3)
  const len = Math.hypot(dir.x, dir.z) || 1;
  p.dodgeDir = { x: dir.x / len, z: dir.z / len };
  p.dodgeAge = 0; p.dodgeCd = DODGE.duration + DODGE.cooldown;
  return true;
}

/**
 * The dodge keeps the dash's arena shape: the burst eases to 0.55 of itself and plain ground bleeds as before. The
 * village dash's carried momentum (specs/movement-slide.md) stays out of the arena, so dodges and the balance hold.
 */
export const DODGE_SHAPE = { dashExit: 0.55, overspeedDecay: 5, keepGrace: 0 } as const;
/**
 * The ruins on the movement kit (specs/movement.md): Q's dash is the dodge, the village dash's own burst with the
 * dodge's cooldown (combat polish 9: one dash), and walking and sprint scale with the combat speed stat.
 */
let tuned: { speed: number; t: MoveTuning } | null = null;
export function combatTuning(speed: number): MoveTuning {
  if (tuned?.speed === speed) return tuned.t; // the avatar asks every frame; the speed stat changes rarely
  const t = MOVE_TUNING;
  tuned = { speed, t: { ...t, walkSpeed: t.walkSpeed * speed, sneakSpeed: t.sneakSpeed * speed, sprintSpeed: t.sprintSpeed * speed,
    dashCooldown: DODGE.duration + DODGE.cooldown, ...DODGE_SHAPE } };
  return tuned.t;
}
/**
 * The kit's dash in the ruins: the sim moves you and its cooldown (the same DODGE timings) gates it. On the ground this
 * gives it the dodge's i-frames and cancels a cast; an air dash only cancels the cast (no i-frames off a jump).
 */
export function dashDodge(rt: CombatRuntime, dir: Vec, aloft = false): boolean {
  if (aloft) { cancelCast(rt); return false; }
  rt.player.dodgeCd = 0;
  return startDodge(rt, dir);
}
/** What moves you in the ruins besides the kit: an ability's dash and knockback (the dodge's own movement is the kit's dash). */
export function combatPush(p: CombatRuntime["player"]): Vec | undefined {
  return p.alive && (p.impulse.x || p.impulse.z) ? p.impulse : undefined;
}

/**
 * Damage the player unless safe or in i-frames (dodge, or a dash that grants them); guard, a frontal block and the shield
 * soak first. `knock` is the attack's knockback (data.ts): how hard it pushes you away. Returns health lost.
 */
export function hurtPlayer(rt: CombatRuntime, amount: number, from: Vec, player: Vec, knock = 3, random: () => number = Math.random): number {
  const p = rt.player;
  if (!p.alive || p.safe) return 0;
  if (invulnerable(p.dodgeAge) || p.dash?.iframes) { floater(rt, player, 1.7, "Dodged", "info"); return 0; }
  const { damage } = mitigate(rt, amount, from, player, random); // the seeded roll in the balance runs (a block's counter can crit)
  p.hurt = 0.35;
  if (rt.kit?.subclass.passive.kind !== "poise") {
    const d = Math.hypot(player.x - from.x, player.z - from.z) || 1;
    p.dodgeDir = { x: (player.x - from.x) / d, z: (player.z - from.z) / d };
    p.knock = knock;
  } else p.hurt = 0.19; // Unstoppable: the flinch shows, no knockback
  if (damage <= 0) return 0;
  p.hp = Math.max(0, p.hp - damage);
  floater(rt, player, 1.7, `-${damage}`, "hurt");
  cue(rt, "hurt", player);
  if (p.hp === 0) { p.alive = false; p.downFor = 0; rt.casting = null; }
  return damage;
}

/** Presses wait this long for the attack or a slot to be ready: a tap between two frames, a press just before a cooldown ends. */
export const BUFFER = 0.15;
/** The player's presses for the frame loop: the mouse button held, a queued click (seconds it still waits), queued keys. */
export interface InputQueue { held: boolean; attack: number; keys: { id: AbilityId; left: number }[] }
export const createInputs = (): InputQueue => ({ held: false, attack: 0, keys: [] });

/**
 * One frame of presses. A held or queued click attacks as soon as it can. A key fires once its slot is ready, waiting up
 * to BUFFER; a slot that can't be ready in time counts in `rt.denied` (its slot pulses). Returns true when one was denied.
 */
export function runInputs(rt: CombatRuntime, q: InputQueue, me: Vec, dt: number, random = Math.random): boolean {
  if ((q.held || q.attack > 0) && attack(rt, me, random)) q.attack = 0;
  q.attack = Math.max(0, q.attack - dt);
  let denied = false;
  for (let i = 0; i < q.keys.length; i++) {
    const k = q.keys[i], cd = rt.cooldowns[k.id];
    let done = true;
    if (cd > k.left) { rt.denied[k.id]++; denied = true; }
    else if (cd > 0 || rt.casting || rt.player.dash) done = (k.left -= dt) <= 0;
    else triggerAbility(rt, k.id, me, random);
    if (done) q.keys.splice(i--, 1);
  }
  return denied;
}

/** Keys: slots 1–4 run the equipped kit abilities; R swaps weapons. */
export function triggerAbility(rt: CombatRuntime, id: AbilityId, player: Vec = { x: 0, z: 0 }, random = Math.random): boolean {
  const p = rt.player;
  if (id === "swap") {
    if (!p.alive || rt.cooldowns.swap > 0 || rt.casting) return false;
    p.weapon = p.owned[(p.owned.indexOf(p.weapon) + 1) % p.owned.length]; p.attackCd = 0.2; rt.cooldowns.swap = 0.4;
    return true;
  }
  const fired = fireSlot(rt, SLOT_IDS.indexOf(id), player, random);
  if (fired) faceAim(p, player);
  return fired;
}

export function spawnWave(rt: CombatRuntime, wave: SpawnPoint[]) {
  for (const s of wave) rt.enemies.push({ ...spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z), state: "chase" });
}

/** The boss calls rune wisps at its sides, topping up to BOSS.summons alive. */
export function summonWisps(rt: CombatRuntime, boss: Enemy) {
  const alive = rt.enemies.filter(e => e.summoned && e.state !== "dead").length;
  rt.enemies = rt.enemies.filter(e => !(e.summoned && e.state === "dead"));
  for (let i = alive; i < BOSS.summons; i++) {
    const side = i % 2 ? -1 : 1, x = boss.x + Math.cos(boss.facing) * 2.6 * side, z = boss.z - Math.sin(boss.facing) * 2.6 * side;
    rt.enemies.push({ ...spawnEnemy(`summon-${rt.seq++}`, ENEMIES["rune-wisp"], x, z), state: "chase", summoned: true });
  }
  rt.blasts.push({ id: rt.seq++, x: boss.x, z: boss.z, radius: 2.6, color: "#b48cff", age: 0, life: 0.6 });
}
