/**
 * What the player's inputs do to the encounter state (pure over the runtime,
 * testable without a canvas). Damage, wear and potency use the systems rules
 * (web/lib/combat/weapons.ts `damage`); the island owns shapes and timing.
 */
import { damage as ruleDamage, WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { ENEMIES, WEAPONS, WEAPON_ORDER } from "./data";
import type { IncantationScore } from "./contract";
import { advanceMission, type MissionEvent } from "./missions";
import { DODGE, damageEnemy, inArc, invulnerable, spawnEnemy, type Enemy, type Vec } from "./sim";
import { ENERGY, type AbilityId, type CombatRuntime, type WeaponId } from "./runtime";
import { runeById } from "./runes";
import type { SpawnPoint } from "./spawns";

export function floater(rt: CombatRuntime, at: Vec, y: number, text: string, kind: "hit" | "crit" | "hurt" | "info") {
  rt.floaters.push({ id: rt.seq++, x: at.x, y, z: at.z, text, kind, age: 0 });
  if (rt.floaters.length > 16) rt.floaters.shift();
}

export function missionEvent(rt: CombatRuntime, ev: MissionEvent) {
  if (rt.mission) rt.mission = advanceMission(rt.mission, ev);
}

function spend(rt: CombatRuntime, energy: number): boolean {
  const p = rt.player;
  if (p.energy < energy) return false;
  p.energy -= energy; p.sinceSpend = 0;
  return true;
}
/** Energy regen: after ENERGY.delay seconds without spending, never while tracing a rune. */
export function regenEnergy(rt: CombatRuntime, dt: number) {
  const p = rt.player;
  p.sinceSpend += dt;
  if (!rt.casting && p.sinceSpend >= ENERGY.delay) p.energy = Math.min(ENERGY.max, p.energy + ENERGY.regen * dt);
}

/** One hit from the equipped weapon (systems damage formula), crits 10%. */
export function weaponDamage(rt: CombatRuntime, e: Enemy, random: () => number, potency = 1): { amount: number; crit: boolean } {
  const p = rt.player, def = SYSTEM_WEAPONS.find(w => w.key === p.weapon)!;
  const crit = random() < 0.1;
  return { amount: ruleDamage({ weapon: def, durability: p.durability[p.weapon], stats: p.stats, level: p.level, enemyDefense: e.type.defense, crit, potency }), crit };
}

function hitEnemy(rt: CombatRuntime, idx: number, from: Vec, knock: number, random: () => number, potency = 1) {
  const e = rt.enemies[idx];
  const { amount, crit } = weaponDamage(rt, e, random, potency);
  const killed = damageEnemy(e, amount, from, knock);
  if (e.flash === 0.18) floater(rt, e, 1.4 + e.type.hover, String(amount), crit ? "crit" : "hit");
  if (killed) {
    rt.killQueue.push({ enemy: e.type.id, key: `kill:${e.id}:${rt.seq++}:${Date.now().toString(36)}` });
    missionEvent(rt, { kind: "kill", enemy: e.type.id });
  }
  return killed;
}
const wearHit = (rt: CombatRuntime) => { rt.player.hits[rt.player.weapon] += 1; rt.player.durability[rt.player.weapon] = Math.max(0, rt.player.durability[rt.player.weapon] - 1); };

/** Primary attack with the equipped weapon toward the aim. Returns true if it fired. */
export function attack(rt: CombatRuntime, player: Vec, random = Math.random): boolean {
  const p = rt.player;
  if (!p.alive || p.attackCd > 0 || rt.casting || (p.dodgeAge !== null && p.dodgeAge < DODGE.duration)) return false;
  const w = WEAPONS[p.weapon];
  p.attackCd = w.cooldown;
  const dir = { x: Math.sin(p.facing), z: Math.cos(p.facing) };
  if (w.kind === "melee") {
    p.swing = 0.22;
    let landed = false;
    rt.enemies.forEach((e, i) => { if (e.state !== "dead" && inArc(player, p.facing, w.range, w.arc, e, e.type.radius)) { hitEnemy(rt, i, player, 4, random); landed = true; } });
    if (landed) wearHit(rt);
  } else if (w.kind === "bow" || w.kind === "staff") {
    const speed = w.speed ?? 12;
    rt.projectiles.push({ id: rt.seq++, x: player.x + dir.x * 0.5, z: player.z + dir.z * 0.5, vx: dir.x * speed, vz: dir.z * speed, life: w.range / speed, from: "player", damage: 0, kind: w.kind === "bow" ? "arrow" : "bolt", radius: w.kind === "bow" ? 0.15 : 0.3 });
  } else {
    if (rt.minions.length >= 2) rt.minions.shift();
    rt.minions.push({ id: rt.seq++, x: player.x - dir.z * 0.8, z: player.z + dir.x * 0.8, life: 12, cooldown: 0.4 });
  }
  return true;
}

/** Player projectile hits (weapon damage at impact; staff bolts splash at half potency; wisp nips at 0.6). */
export function resolvePlayerShot(rt: CombatRuntime, shotIdx: number, from: Vec, to: Vec, sweptHit: (a: Vec, b: Vec, c: Vec, r: number) => boolean, random = Math.random): boolean {
  const s = rt.projectiles[shotIdx];
  const hit = rt.enemies.findIndex(e => e.state !== "dead" && sweptHit(from, to, e, e.type.radius + s.radius));
  if (hit < 0) return false;
  const potency = s.damage === -1 ? 0.6 : 1; // -1 marks a wisp nip
  hitEnemy(rt, hit, from, s.kind === "arrow" ? 2.5 : 3, random, potency);
  if (potency === 1) wearHit(rt);
  if (s.kind === "bolt" && potency === 1) {
    rt.blasts.push({ id: rt.seq++, x: to.x, z: to.z, radius: 1.3, color: "#b48cff", age: 0, life: 0.35 });
    rt.enemies.forEach((e, i) => { if (i !== hit && e.state !== "dead" && Math.hypot(e.x - to.x, e.z - to.z) < 1.3 + e.type.radius) hitEnemy(rt, i, to, 2, random, 0.5); });
  }
  return true;
}

export function startDodge(rt: CombatRuntime, dir: Vec): boolean {
  const p = rt.player;
  if (!p.alive || p.dodgeCd > 0) return false;
  rt.casting = null; // dodge cancels casting (row C3)
  const len = Math.hypot(dir.x, dir.z) || 1;
  p.dodgeDir = { x: dir.x / len, z: dir.z / len };
  p.dodgeAge = 0; p.dodgeCd = DODGE.duration + DODGE.cooldown;
  return true;
}

/** Damage the player unless they're in the safe zone or mid-dodge i-frames. Returns damage taken. */
export function hurtPlayer(rt: CombatRuntime, amount: number, from: Vec, player: Vec): number {
  const p = rt.player;
  if (!p.alive || p.safe || invulnerable(p.dodgeAge)) { if (p.alive && invulnerable(p.dodgeAge)) floater(rt, player, 1.7, "Dodged", "info"); return 0; }
  p.hp = Math.max(0, p.hp - amount); p.hurt = 0.35;
  const d = Math.hypot(player.x - from.x, player.z - from.z) || 1;
  p.dodgeDir = { x: (player.x - from.x) / d, z: (player.z - from.z) / d };
  floater(rt, player, 1.7, `-${amount}`, "hurt");
  if (p.hp === 0) { p.alive = false; p.downFor = 0; rt.casting = null; }
  return amount;
}

/** Ability keys 1–4. Runes open the casting mode (the world keeps running); energy is paid up front. */
export function triggerAbility(rt: CombatRuntime, id: AbilityId, player: Vec = { x: 0, z: 0 }): boolean {
  const p = rt.player;
  if (!p.alive || rt.cooldowns[id] > 0 || rt.casting) return false;
  if (id === "swap") { p.weapon = WEAPON_ORDER[(WEAPON_ORDER.indexOf(p.weapon) + 1) % WEAPON_ORDER.length] as WeaponId; p.attackCd = 0.2; rt.cooldowns.swap = 0.4; return true; }
  if (id === "spark" || id === "binding") {
    if (!spend(rt, runeById(id).energy)) { floater(rt, player, 1.9, "Not enough energy", "info"); return false; }
    rt.casting = { id: rt.seq++, rune: id, aim: { ...p.aim }, potencyScale: 1 };
    return true;
  }
  // Subclass signature (kits data). Drawn signatures open their rune at the signature's power.
  const sig = rt.signature;
  if (!sig) { floater(rt, player, 1.9, "Choose a subclass at the Oracle", "info"); return false; }
  if (!spend(rt, sig.energy)) { floater(rt, player, 1.9, "Not enough energy", "info"); return false; }
  rt.cooldowns.signature = sig.cooldown_s;
  if (sig.incantation) { rt.casting = { id: rt.seq++, rune: sig.incantation, aim: { ...p.aim }, potencyScale: Math.max(1, sig.power / 1.5) }; return true; }
  const r = 3;
  rt.blasts.push({ id: rt.seq++, x: player.x, z: player.z, radius: r, color: "#ffe08a", age: 0, life: 0.5 });
  rt.enemies.forEach((e, i) => { if (e.state !== "dead" && Math.hypot(e.x - player.x, e.z - player.z) < r + e.type.radius) hitEnemy(rt, i, player, 5, Math.random, Math.max(0.5, sig.power)); });
  floater(rt, player, 1.9, sig.name, "info");
  return true;
}

/** Finish (or fail) an incantation: effect scales with the systems potency (row 53). */
export function resolveCast(rt: CombatRuntime, player: Vec, score: IncantationScore, random = Math.random) {
  const cast = rt.casting;
  if (!cast) return;
  rt.casting = null;
  rt.cooldowns[cast.rune] = score.outcome === "fail" ? 1.5 : cast.rune === "spark" ? 4 : 10;
  const pct = Math.round(score.accuracy);
  if (score.outcome === "fail") { floater(rt, player, 1.9, `Fizzled · ${pct}%`, "info"); return; }
  floater(rt, player, 1.9, `${score.outcome === "enhanced" ? "Empowered" : "Cast"} · ${pct}%`, "info");
  const potency = score.power * 2.2 * cast.potencyScale;
  if (cast.rune === "spark") {
    const r = 2.2 * (score.outcome === "enhanced" ? 1.3 : 1);
    rt.blasts.push({ id: rt.seq++, x: cast.aim.x, z: cast.aim.z, radius: r, color: "#ffe36e", age: 0, life: 0.5 });
    rt.enemies.forEach((e, i) => { if (e.state !== "dead" && Math.hypot(e.x - cast.aim.x, e.z - cast.aim.z) < r + e.type.radius) hitEnemy(rt, i, cast.aim, 5, random, potency); });
  } else {
    const r = 4.5;
    rt.blasts.push({ id: rt.seq++, x: player.x, z: player.z, radius: r, color: "#b48cff", age: 0, life: 0.7 });
    rt.enemies.forEach((e, i) => {
      if (e.state === "dead" || Math.hypot(e.x - player.x, e.z - player.z) > r + e.type.radius) return;
      hitEnemy(rt, i, player, 6, random, potency * 0.7);
      if (!["dead", "return"].includes(e.state as string)) { e.state = "recover"; e.t = -2 * score.power; } // rooted
    });
  }
}

export function spawnWave(rt: CombatRuntime, wave: SpawnPoint[]) {
  for (const s of wave) rt.enemies.push({ ...spawnEnemy(s.id, ENEMIES[s.type], s.x, s.z), state: "chase" });
}
