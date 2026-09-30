/**
 * One encounter tick, shared by the ruins scene and the scripted balance run
 * (balance.ts): timers, statuses and buffs, energy, the dodge's clock,
 * dash/knockback impulse, enemies (aimed at you or at a phantom/crab that draws them),
 * projectiles, summons and totems, effects. Inputs (aim, attack, dodge, keys),
 * missions, respawns and server sync stay with the caller.
 */
import { enemyTarget, floater, hurtUnits, moveSpeed, stepUnits } from "./abilities";
import { hurtPlayer, regenEnergy, resolvePlayerShot, summonWisps } from "./actions";
import { SLOT_IDS, type AbilityId, type CombatRuntime } from "./runtime";
import { beamLands, DODGE, stepEnemy, strikeLands, sweptHit, type Vec } from "./sim";

export function stepCombat(rt: CombatRuntime, me: Vec, dt: number, free: (x: number, z: number, r: number) => boolean = () => true, random: () => number = Math.random) {
  const p = rt.player;
  // Timers, buffs, shield, passive stacks, the transformation.
  p.attackCd = Math.max(0, p.attackCd - dt); p.swing = Math.max(0, p.swing - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt); p.hurt = Math.max(0, p.hurt - dt);
  for (const k of [...SLOT_IDS, "swap"] as AbilityId[]) rt.cooldowns[k] = Math.max(0, rt.cooldowns[k] - dt);
  for (const b of rt.buffs) b.t -= dt;
  rt.buffs = rt.buffs.filter(b => b.t > 0);
  p.shieldFor = Math.max(0, p.shieldFor - dt); if (!p.shieldFor) p.shield = 0;
  const s = rt.passive;
  s.momentumT = Math.max(0, s.momentumT - dt); if (!s.momentumT) s.momentum = 0;
  if (rt.transform && (rt.transform.t -= dt) <= 0) rt.transform = null;
  p.still = p.last && Math.hypot(p.last.x - me.x, p.last.z - me.z) < 0.01 ? p.still + dt : 0;
  p.last = { ...me };
  p.speed = moveSpeed(rt);
  regenEnergy(rt, dt);
  // The dodge's clock (the movement kit's dash moves you), ability dash (what follows it lands where it ends), knockback.
  if (p.dodgeAge !== null) {
    p.dodgeAge += dt;
    if (p.dodgeAge >= DODGE.duration) p.dodgeAge = null;
    p.impulse = { x: 0, z: 0 };
  } else if (p.dash) {
    p.impulse = { x: p.dash.x * p.dash.speed, z: p.dash.z * p.dash.speed };
    if ((p.dash.left -= dt) <= 0) { const then = p.dash.then; p.dash = null; p.impulse = { x: 0, z: 0 }; then?.(me); }
  } else p.impulse = p.hurt > 0.2 ? { x: p.dodgeDir.x * 5, z: p.dodgeDir.z * 5 } : { x: 0, z: 0 };
  // Enemies.
  const you = { x: me.x, z: me.z, safe: p.safe, alive: p.alive };
  for (const e of [...rt.enemies]) {
    const ev = stepEnemy(e, enemyTarget(rt, e, you), dt, (x, z) => free(x, z, e.type.radius * 0.6));
    if (!ev) continue;
    const dmg = e.move.damage;
    if (ev.kind === "strike") {
      if (strikeLands(e, me)) hurtPlayer(rt, dmg, e.move.shape === "smash" ? e.aim : e, me);
      hurtUnits(rt, u => strikeLands(e, u, 0.4), dmg);
      if (rt.escort && strikeLands(e, rt.escort, 0.4)) { rt.escort.hp -= dmg; floater(rt, rt.escort, 1.8, `-${dmg}`, "hurt"); }
      if (rt.escort && Math.hypot(rt.escort.x - e.x, rt.escort.z - e.z) < Math.hypot(me.x - e.x, me.z - e.z)) e.aim = { x: rt.escort.x, z: rt.escort.z };
      if (e.move.shape === "smash") rt.blasts.push({ id: rt.seq++, x: e.aim.x, z: e.aim.z, radius: e.move.range, color: "#ffd9a0", age: 0, life: 0.45 });
    } else if (ev.kind === "spit") {
      const d = Math.hypot(ev.to.x - e.x, ev.to.z - e.z) || 1, sp = 9;
      rt.projectiles.push({ id: rt.seq++, x: e.x, z: e.z, vx: ((ev.to.x - e.x) / d) * sp, vz: ((ev.to.z - e.z) / d) * sp, life: (e.move.range + 2) / sp, from: "enemy", damage: dmg, kind: "spit", radius: 0.3 });
    } else if (ev.kind === "beam") {
      if (beamLands(e, me)) hurtPlayer(rt, dmg, e, me);
    } else if (ev.kind === "summon") summonWisps(rt, e);
    else if (ev.kind === "phase") floater(rt, e, 3.4, e.phase === 3 ? "Enraged" : "The guardian calls for help", "info");
    else if (ev.kind === "reset" && e.type.kind === "boss") rt.enemies = rt.enemies.filter(x => !x.summoned);
  }
  // Projectiles: yours hit enemies (pierce keeps going), theirs hit you or a unit.
  for (let i = rt.projectiles.length - 1; i >= 0; i--) {
    const sh = rt.projectiles[i], from = { x: sh.x, z: sh.z };
    sh.x += sh.vx * dt; sh.z += sh.vz * dt; sh.life -= dt;
    const to = { x: sh.x, z: sh.z };
    let gone = sh.life <= 0 || !free(sh.x, sh.z, 0.05);
    if (!gone && sh.from === "player") gone = resolvePlayerShot(rt, i, from, to, random);
    else if (!gone && sh.from === "enemy") {
      const unit = rt.units.find(u => u.def.kind !== "trap" && sweptHit(from, to, u, 0.4 + sh.radius));
      if (sweptHit(from, to, me, 0.35 + sh.radius)) { hurtPlayer(rt, sh.damage, from, me); gone = true; }
      else if (unit) { hurtUnits(rt, u => u === unit, sh.damage); gone = true; }
    }
    if (gone) rt.projectiles.splice(i, 1);
  }
  stepUnits(rt, me, dt, random);
  for (let i = rt.blasts.length - 1; i >= 0; i--) { rt.blasts[i].age += dt; if (rt.blasts[i].age > rt.blasts[i].life) rt.blasts.splice(i, 1); }
  for (let i = rt.floaters.length - 1; i >= 0; i--) { rt.floaters[i].age += dt; if (rt.floaters[i].age > 1.1) rt.floaters.splice(i, 1); }
}
