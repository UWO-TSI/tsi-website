/**
 * One encounter tick, shared by the ruins scene and the scripted balance run
 * (balance.ts): timers, statuses and buffs, energy, the dodge's clock,
 * dash/knockback impulse, enemies (aimed at you or at a phantom/crab that draws them; zone 1's
 * packs, pounces, lobs, blinks, bursts and hazards in mobs.ts), projectiles, summons and totems, effects. Inputs (aim, attack, dodge, keys),
 * missions, respawns and server sync stay with the caller.
 */
import { cue, enemyTarget, floater, hurtUnits, moveSpeed, runEffects, stepUnits } from "./abilities";
import { hurtPlayer, regenEnergy, resolvePlayerShot, summonWisps } from "./actions";
import { SLOT_IDS, type AbilityId, type CombatRuntime } from "./runtime";
import { beamLands, DODGE, separate, stepEnemy, strikeLands, sweptHit, type Vec } from "./sim";
import { landLob, mobEvent, mobFx, rally, RUNE_BOLT_SPEED, stepHazards } from "./mobs";
import { cloneWard, inWall, parryShot, stepField } from "./primitives";

const ABILITY_IDS: readonly AbilityId[] = [...SLOT_IDS, "swap"];

/** A hit's push: `knock` × this u/s at the hit, easing to nothing over the flinch's first 0.15 s (0.225 u per point of knockback). */
const KNOCK_SPEED = 3;
/** Scratch the tick reuses every frame (combat polish 12: nothing allocated per frame in a fight). */
const YOU = { x: 0, z: 0, safe: false, alive: true }, FROM = { x: 0, z: 0 }, TO = { x: 0, z: 0 };
let freeFor: (x: number, z: number, r: number) => boolean = () => true, bodyR = 0, walled: CombatRuntime | null = null;
/** Open ground for a body: the caller's, minus classes v2 stone walls (primitives.ts). */
const freeAll = (x: number, z: number, r: number) => freeFor(x, z, r) && !(walled && inWall(walled, x, z, r));
const freeBody = (x: number, z: number) => freeAll(x, z, bodyR);

/** Inside a dome (a lobbed spore bursts on its shell instead of landing). */
const inDome = (rt: CombatRuntime, at: Vec) => rt.units.some(u => u.def.kind === "dome" && Math.hypot(u.x - at.x, u.z - at.z) <= u.def.radius!);

export function stepCombat(rt: CombatRuntime, me: Vec, dt: number, free: (x: number, z: number, r: number) => boolean = () => true, random: () => number = Math.random) {
  const p = rt.player;
  // Timers, buffs, shield, passive stacks, the transformation.
  p.attackCd = Math.max(0, p.attackCd - dt); p.swing = Math.max(0, p.swing - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.hurt = Math.max(0, p.hurt - dt);
  p.aimHold = Math.max(0, p.aimHold - dt);
  for (const k of ABILITY_IDS) rt.cooldowns[k] = Math.max(0, rt.cooldowns[k] - dt);
  for (let i = rt.buffs.length - 1; i >= 0; i--) if ((rt.buffs[i].t -= dt) <= 0) rt.buffs.splice(i, 1);
  p.shieldFor = Math.max(0, p.shieldFor - dt); if (!p.shieldFor) p.shield = 0;
  const s = rt.passive;
  s.momentumT = Math.max(0, s.momentumT - dt); if (!s.momentumT) s.momentum = 0;
  if (rt.transform && (rt.transform.t -= dt) <= 0) rt.transform = null;
  p.still = p.last && Math.hypot(p.last.x - me.x, p.last.z - me.z) < 0.01 ? p.still + dt : 0;
  if (p.last) { p.last.x = me.x; p.last.z = me.z; } else p.last = { x: me.x, z: me.z };
  p.speed = moveSpeed(rt);
  regenEnergy(rt, dt);
  // The dodge's clock (the movement kit's dash moves you), ability dash (what follows it lands where it ends), knockback.
  const push = p.impulse;
  push.x = push.z = 0;
  if (p.dodgeAge !== null) {
    p.dodgeAge += dt;
    if (p.dodgeAge >= DODGE.duration) p.dodgeAge = null;
  } else if (p.dash) {
    push.x = p.dash.x * p.dash.speed; push.z = p.dash.z * p.dash.speed;
    if ((p.dash.left -= dt) <= 0) { const then = p.dash.then; p.dash = null; push.x = push.z = 0; then?.(me); }
  } else if (p.hurt > 0.2) {
    const k = p.knock * KNOCK_SPEED * Math.min(1, (p.hurt - 0.2) / 0.15);
    push.x = p.dodgeDir.x * k; push.z = p.dodgeDir.z * k;
  }
  // Enemies.
  const you = YOU, list = rt.enemies;
  you.x = me.x; you.z = me.z; you.safe = p.safe; you.alive = p.alive; // a boss reset or summon makes a new list: this frame keeps the old
  freeFor = free; walled = rt.field.walls.length ? rt : null;
  for (let i = 0; i < list.length; i++) {
    const e = list[i], was = e.state;
    bodyR = e.type.radius * 0.6;
    const ev = stepEnemy(e, enemyTarget(rt, e, you), dt, freeBody, random);
    if (was !== "windup" && e.state === "windup") cue(rt, "windup", e);
    else if (was === "active" && e.state === "recover" && e.move.stagger) cue(rt, "stagger", e);
    if (!ev || mobEvent(rt, ev, me, random)) continue;
    const dmg = e.move.damage;
    if (ev.kind === "strike") {
      if (strikeLands(e, me)) hurtPlayer(rt, dmg, e.move.shape === "smash" ? e.aim : e, me, e.move.knockback, random);
      hurtUnits(rt, u => strikeLands(e, u, 0.4), dmg);
      if (rt.escort && strikeLands(e, rt.escort, 0.4)) { rt.escort.hp -= dmg; floater(rt, rt.escort, 1.8, `-${dmg}`, "hurt"); }
      if (rt.escort && Math.hypot(rt.escort.x - e.x, rt.escort.z - e.z) < Math.hypot(me.x - e.x, me.z - e.z)) e.aim = { x: rt.escort.x, z: rt.escort.z };
      if (e.move.shape === "smash") rt.blasts.push({ id: rt.seq++, x: e.aim.x, z: e.aim.z, radius: e.move.range, color: "#ffd9a0", age: 0, life: 0.45 });
    } else if (ev.kind === "spit") {
      // A rune bolt (the wisps, and the guardian's): straight down the line its telegraph drew.
      const d = Math.hypot(ev.to.x - e.x, ev.to.z - e.z) || 1, sp = RUNE_BOLT_SPEED;
      rt.projectiles.push({ id: rt.seq++, x: e.x, z: e.z, vx: ((ev.to.x - e.x) / d) * sp, vz: ((ev.to.z - e.z) / d) * sp, life: (e.move.range + 2) / sp, from: "enemy", damage: dmg, kind: "rune", radius: 0.3, knock: e.move.knockback });
    } else if (ev.kind === "beam") {
      if (beamLands(e, me)) hurtPlayer(rt, dmg, e, me, e.move.knockback, random);
    } else if (ev.kind === "summon") summonWisps(rt, e);
    else if (ev.kind === "reset" && e.type.kind === "boss") rt.enemies = rt.enemies.filter(x => !x.summoned);
  }
  rally(rt.enemies);
  separate(rt.enemies, dt, freeAll);
  // Projectiles: yours hit enemies (pierce keeps going), theirs hit you or a unit.
  for (let i = rt.projectiles.length - 1; i >= 0; i--) {
    const sh = rt.projectiles[i], from = FROM, to = TO;
    // A lobbed spore flies over everything and bursts where it lands.
    if (sh.arc) {
      sh.x += sh.vx * dt; sh.z += sh.vz * dt;
      if ((sh.life -= dt) <= 0) { if (!inDome(rt, sh)) landLob(rt, sh, me, random); rt.projectiles.splice(i, 1); }
      continue;
    }
    from.x = sh.x; from.z = sh.z;
    sh.x += sh.vx * dt; sh.z += sh.vz * dt; sh.life -= dt;
    to.x = sh.x; to.z = sh.z;
    let gone = sh.life <= 0 || !freeAll(sh.x, sh.z, 0.05);
    if (!gone && sh.from === "player") gone = resolvePlayerShot(rt, i, from, to, random);
    else if (!gone && sh.from === "enemy") {
      // A parry sends it back (primitives.ts); a clone that wards sends back its own.
      if (sweptHit(from, to, me, 0.35 + sh.radius)) { if (!parryShot(rt, sh, me)) hurtPlayer(rt, sh.damage, from, me, sh.knock, random, true); gone = true; }
      else {
        // A dome (Aegis Dome) stops a shot where it crosses its edge; a clone's ward turns it; a minion or totem takes it.
        const unit = rt.units.find(u => u.def.kind !== "trap" && u.def.kind !== "veil" && sweptHit(from, to, u, (u.def.kind === "dome" ? u.def.radius! : 0.4) + sh.radius));
        if (unit) { if (!cloneWard(rt, unit)) hurtUnits(rt, u => u === unit, sh.damage); gone = true; }
      }
    }
    if (gone && sh.kind === "rune") mobFx(rt, "runes", sh.x, sh.z); // a rune bolt bursts in a glyph wherever it ends
    if (gone && sh.hit?.burst) runEffects(rt, sh.hit.burst.effects, { ...sh.hit.burst.ctx, pos: { x: sh.x, z: sh.z }, aim: { x: sh.x, z: sh.z } }, random); // a fireball bursting where it ends
    if (gone) rt.projectiles.splice(i, 1);
  }
  stepHazards(rt, me, dt, random);
  stepUnits(rt, me, dt, random);
  stepField(rt, me, dt, random);
  for (let i = rt.blasts.length - 1; i >= 0; i--) { rt.blasts[i].age += dt; if (rt.blasts[i].age > rt.blasts[i].life) rt.blasts.splice(i, 1); }
  for (let i = rt.floaters.length - 1; i >= 0; i--) { rt.floaters[i].age += dt; if (rt.floaters[i].age > 1.1) rt.floaters.splice(i, 1); }
}
