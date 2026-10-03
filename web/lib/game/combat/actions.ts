/**
 * What the player's inputs do to the encounter state (pure over the runtime,
 * testable without a canvas): weapon attacks, shots landing, dodge, taking
 * hits, the ability keys. Damage, wear and potency use the systems rules
 * (web/lib/combat/weapons.ts `damage`) through abilities.ts `strike`; the
 * island owns shapes and timing.
 */
import { ENEMIES, WEAPONS } from "./data";
import type { Vec } from "./sim";
import { BOSS, DODGE, engage, inArc, invulnerable, spawnEnemy, sweptHit, type Enemy } from "./sim";
import { ENERGY, SLOT_IDS, energyMax, energyRegen, setWeapon, type AbilityId, type CombatRuntime } from "./runtime";
import { cancelCast, chargeUlt, cue, floater, fx, mitigate, strike, summon, fireSlot } from "./abilities";
import { takenCharge } from "@/lib/combat/ult";
import { counterHit, formBasic, formTier, reveal } from "./primitives";
import type { SpawnPoint } from "./spawns";
import { FAMILY_STAT } from "@/lib/combat/kits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { MOVE_TUNING, type MoveTuning } from "@/lib/game/movement/sim";

/** Energy regen: after ENERGY.delay seconds without spending, never while tracing. */
export function regenEnergy(rt: CombatRuntime, dt: number) {
  const p = rt.player;
  p.sinceSpend += dt;
  if ((!rt.casting || rt.casting.free) && p.sinceSpend >= ENERGY.delay) p.energy = Math.min(energyMax(rt), p.energy + energyRegen(rt) * dt);
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
  if (!p.alive || p.attackCd > 0 || rt.casting || p.dash || rt.v2?.channel || (p.dodgeAge !== null && p.dodgeAge < DODGE.duration)) return false; // a channel takes your hands
  // Classes v2: a form brings its own click attack (primitives.ts formBasic); attacking ends stealth.
  const form = formBasic(rt), w = form ? { ...WEAPONS[p.weapon], ...form } : WEAPONS[p.weapon], tier = form ? formTier(rt, rt.v2?.form) : undefined;
  p.attackCd = w.cooldown / (rt.v2?.mods.attackSpeed ?? 1);
  faceAim(p, player);
  reveal(rt);
  cue(rt, "swing", player);
  const dir = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  if (w.kind === "melee") {
    p.swing = 0.22;
    let landed = false;
    for (const e of rt.enemies) if (e.state !== "dead" && inArc(player, p.facing, w.range, w.arc, e, e.type.radius)) { strike(rt, e, { power: form?.power ?? 1, from: player, knock: form?.knock ?? 4, melee: true, status: form?.status, tier }, random); landed = true; }
    if (landed) wearHit(rt);
  } else if (w.kind === "bow" || w.kind === "staff") {
    const speed = w.speed ?? 12, kind = w.shot ?? (w.kind === "bow" ? "arrow" : "bolt");
    rt.projectiles.push({ id: rt.seq++, x: player.x + dir.x * 0.5, z: player.z + dir.z * 0.5, vx: dir.x * speed, vz: dir.z * speed, life: w.range / speed, from: "player", damage: 0, kind, radius: w.kind === "bow" ? 0.15 : 0.3,
      ...(form ? { hit: { power: form.power, status: form.status, splash: form.splash, tier, hitIds: [], impact: "light" as const, ramp: rt.v2?.kit.look.ramp } } : {}) });
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
  strike(rt, target, { power: h.power, from, knock: h.unit ? 1 : knock, stat: h.stat, tier: h.tier, unit: h.unit, status: h.status, impact: h.impact, ult: h.ult, first: !h.hitIds?.length }, random);
  fx(rt, h.fx, "impact", to, to, h.impact ?? "ability");
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
let tuned: { speed: number; glide: boolean; t: MoveTuning } | null = null;
/** `glide`: the leaf glider on Space held in the air (an air-jump class that owns it; classes v2 Air Step). */
export function combatTuning(speed: number, glide = false): MoveTuning {
  if (tuned?.speed === speed && tuned.glide === glide) return tuned.t; // the avatar asks every frame; the speed stat changes rarely
  const t = MOVE_TUNING;
  tuned = { speed, glide, t: { ...t, walkSpeed: t.walkSpeed * speed, sneakSpeed: t.sneakSpeed * speed, sprintSpeed: t.sprintSpeed * speed,
    dashCooldown: DODGE.duration + DODGE.cooldown, ...DODGE_SHAPE, glider: glide ? 1 : 0 } };
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
export function hurtPlayer(rt: CombatRuntime, amount: number, from: Vec, player: Vec, knock = 3, random: () => number = Math.random, shot = false): number {
  const p = rt.player;
  if (!p.alive || p.safe || p.ultIframes > 0) return 0; // an ult's wind-up and freeze: nothing lands unseen
  if (invulnerable(p.dodgeAge) || p.dash?.iframes) { floater(rt, player, 1.7, "Dodged", "info"); return 0; }
  chargeUlt(rt, takenCharge(amount, p.maxHp)); // aimed at you, before guard, block and shield (§1.2)
  // Classes v2: a counter window (a Perfect Shift) cuts and answers it; a blinding zone makes it miss (primitives.ts).
  const c = rt.field.counter || rt.field.zones.length ? counterHit(rt, amount, from, player, random, shot) : { amount, flinch: true };
  if (c.amount <= 0) return 0;
  const { damage } = mitigate(rt, c.amount, from, player, random); // the seeded roll in the balance runs (a block's counter can crit)
  if (!c.flinch) { /* taken without flinching (a Golem's Perfect Shift): no hit clip, no knockback */ }
  else if (rt.kit?.subclass.passive.kind !== "poise") {
    const d = Math.hypot(player.x - from.x, player.z - from.z) || 1;
    p.hurt = 0.35; p.dodgeDir = { x: (player.x - from.x) / d, z: (player.z - from.z) / d };
    p.knock = knock;
  } else p.hurt = 0.19; // Unstoppable: the flinch shows, no knockback
  if (damage <= 0) return 0;
  p.hp = Math.max(0, p.hp - damage);
  floater(rt, player, 1.7, `-${damage}`, "hurt");
  cue(rt, "hurt", player);
  if (p.hp === 0) { p.alive = false; p.downFor = 0; rt.casting = null; if (rt.v2) { rt.v2.meter = 0; rt.v2.cast = null; } } // the meter empties on defeat
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

/** Keys: slots 1–4 run the equipped kit abilities; R swaps back to the previous weapon (the tool wheel picks the rest), or to the next with none. */
export function triggerAbility(rt: CombatRuntime, id: AbilityId, player: Vec = { x: 0, z: 0 }, random = Math.random): boolean {
  const p = rt.player;
  if (id === "swap") {
    if (!p.alive || rt.cooldowns.swap > 0 || rt.casting) return false;
    const back = p.prev && p.prev !== p.weapon && p.owned.includes(p.prev) ? p.prev : p.owned[(p.owned.indexOf(p.weapon) + 1) % p.owned.length];
    if (!setWeapon(rt, back)) return false;
    rt.cooldowns.swap = 0.4;
    return true;
  }
  const slot = SLOT_IDS.indexOf(id as (typeof SLOT_IDS)[number]);
  if (slot < 0) return false; // key 5 and the ult are classes v2's (classRuntime.ts)
  const fired = fireSlot(rt, slot, player, random);
  if (fired) faceAim(p, player);
  return fired;
}

export function spawnWave(rt: CombatRuntime, wave: SpawnPoint[]) {
  for (const s of wave) rt.enemies.push(engage(spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z, s.pack)));
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
