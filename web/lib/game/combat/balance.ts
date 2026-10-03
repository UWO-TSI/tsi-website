/**
 * Part B balance pass (G2): a scripted solo run of a survive mission for
 * every subclass through the real encounter tick (encounter.ts) and ability
 * system. The bot plays like an average member: the starter weapon its kit
 * suggests, the family stat preset at level 10, the default loadout; it keeps
 * its weapon's range without kiting (but circles a crab's shell and steps out of puddles), dodges 60% of telegraphed attacks aimed at it, uses an
 * ability when it helps (heal when hurt, guard when a hit is coming, damage
 * when in reach, summons when there's room) and draws runes at ~80% (one in
 * ten fizzles, one in ten is empowered). No collision (open ground).
 * specs/evidence/combat-b/balance.md is this table.
 */
import { FAMILY_STAT, resolveLoadout, subclassByKey, UNITS, type Ability, type Subclass } from "@/lib/combat/kits";
import { damage, STARTER_WEAPONS, WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { derived, presetAllocation, ZERO_STATS } from "@/lib/combat/progression";
import { potencyFor } from "@/lib/combat/incantation";
import { SURVIVE_CIRCLES } from "@/lib/game/ruins";
import { equipKit, fireSlot, resolveCast } from "./abilities";
import { DODGE_SHAPE, attack, spawnWave, startDodge } from "./actions";
import { ENEMIES, PLAYER_BASE, WEAPONS } from "./data";
import { stepCombat } from "./encounter";
import { createRuntime, type CombatRuntime } from "./runtime";
import { shellFactor, strikeLands, type Enemy, type Vec } from "./sim";
import { MOVE_TUNING } from "@/lib/game/movement/sim";
import { WAVES, type SpawnPoint } from "./spawns";
import { classKit, type ClassAbility } from "@/lib/combat/classes";
import { signatureGrant } from "@/lib/combat/weapons";
import { classKey, equipClassKit, pressUlt, stepClass } from "./classRuntime";
import { shapePotency } from "./abilities";
import { BOSS_CENTER } from "@/lib/game/ruins";
import { ULT } from "@/lib/combat/ult";

const FALLBACK: Record<string, string> = { Arcane: "staff-oak", Ranger: "bow-willow", Vanguard: "sword-driftwood", Warden: "tome-spirits" };
/** What a sensible member carries: the first starter the kit suggests that scales with the family's stat (row 31), else the family's own. */
export function starterWeapon(s: Subclass): string {
  for (const t of s.weapon_affinity) {
    const w = SYSTEM_WEAPONS.find(x => STARTER_WEAPONS.includes(x.key) && x.type === t);
    if (w && w.scaling[0] === FAMILY_STAT[s.family]) return w.key;
  }
  return FALLBACK[s.family];
}
const RANGE: Record<string, number> = { melee: 1.2, bow: 7, staff: 6, summon: 5 };
const RUNE_TIME = { spark: 1.6, binding: 3.2 };
const DODGE_SKILL = 0.6;
/** Classes v2: how often the bot lands a timed parry when it tries (the Guardian's 0.25 s window). */
const PARRY_SKILL = 0.5;

export interface RunResult { cleared: boolean; seconds: number; dealt: number; taken: number; minHp: number; died: boolean }

function lcg(seed: number) { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const d2 = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

/** Would this ability help right now? (the bot's whole brain) */
function useful(rt: CombatRuntime, a: Ability, me: Vec, target: Enemy | null, threat: boolean): boolean {
  const p = rt.player, dist = target ? d2(me, target) : Infinity;
  const hurt = p.hp / p.maxHp;
  for (const e of a.effects) {
    if (e.kind === "heal" && hurt < 0.7) return true;
    if (e.kind === "shield" && dist < 5 && (hurt < 0.85 || threat)) return true;
    if (e.kind === "buff" && (e.stat === "guard" || e.stat === "block") && (threat || (dist < 3 && hurt < 0.9))) return true;
    if (e.kind === "buff" && e.stat !== "guard" && e.stat !== "block" && dist < RANGE[WEAPONS[p.weapon].kind] + 2) return true;
    if (e.kind === "transform" && dist < 6) return true;
    if (e.kind === "summon") {
      const def = UNITS[e.unit === "weapon" ? "wisp" : e.unit === "corpse" ? "shade" : e.unit];
      if (def.kind === "dome") return dist < 7 && (threat || rt.projectiles.some(s => s.from === "enemy")); // classes v2: under fire
      if (def.kind === "veil") return dist < 4 && (hurt < 0.6 || threat); // an escape, or out of a telegraph's way
      if (def.kind === "totem") return dist < 7 && !rt.units.some(u => u.def.key === def.key && d2(u, me) < 2.5);
      if (def.kind === "trap") return dist > 2.5 && dist < 9;
      if (def.kind === "decoy") return dist < 3;
      const used = rt.units.reduce((n, u) => n + (u.def.kind === "minion" && u.source !== "weapon" ? u.def.cost ?? 1 : 0), 0);
      return e.unit === "corpse" || used + (def.cost ?? 1) * (e.count ?? 1) <= (rt.kit?.capacity ?? 2);
    }
    if (!target) continue;
    if (e.kind === "projectile" && dist < (e.range ?? 10) - 0.5) return true;
    if (e.kind === "area" && e.power > 0 && (e.at === "aim" ? dist < 11 : dist < (e.length ?? e.radius) + 0.3)) return true;
    if (e.kind === "area" && e.power === 0 && dist < e.radius) return true;
    if (e.kind === "dash" && e.power && dist < e.distance) return true;
    // Classes v2 primitives: a strike in reach, a delayed hit (its own effects), a blink to a target in range, a taunt with enemies near.
    if (e.kind === "strike" && dist < e.range + target.type.radius) return true;
    if (e.kind === "after" && useful(rt, { ...a, effects: e.effects }, me, target, threat)) return true;
    if (e.kind === "blink" && e.to === "behind" && dist < (e.range ?? 8) && dist > 1.5) return true;
    if (e.kind === "taunt" && rt.enemies.filter(x => x.state !== "dead" && d2(x, me) < e.radius).length >= 2) return true;
  }
  return false;
}

/** One solo run of a survive mission's waves (the mission's own spawns and circle). */
export function runSurvive(subclassKey: string, missionId: "survive-circle" | "survive-sanctum", seed: number, limit = 240): RunResult {
  return runFight(subclassKey, SURVIVE_CIRCLES[missionId], WAVES[missionId], seed, limit);
}
/** Zone 1's mini-boss alone: the elder thorn crab 5 u away, until it falls (or the limit). */
export const runElder = (subclassKey: string, seed: number, limit = 400) =>
  runFight(subclassKey, { x: 0, z: 0 }, [[{ id: "elder", type: "elder-thorn-crab", x: 0, z: 5 }]], seed, limit);

/** One solo fight through `waves` in turn, from `center`: the bot below against the real encounter tick. */
export function runFight(subclassKey: string, center: Vec, waves: SpawnPoint[][], seed: number, limit = 240): RunResult {
  const s = subclassByKey(subclassKey)!, random = lcg(seed), rt = createRuntime(), p = rt.player;
  p.stats = presetAllocation(s.family, 10); p.level = 10; p.safe = false;
  p.maxHp = p.hp = derived(p.stats, 10, s.mods).max_hp;
  p.weapon = starterWeapon(s);
  equipKit(rt, s);
  let me: Vec = { x: center.x, z: center.z }, wave = 0, castLeft = 0, strafe = 1, t = 0, dealt = 0, taken = 0, minHp = p.hp;
  const judged = new Set<string>();
  spawnWave(rt, waves[0]);
  const dt = 1 / 30;
  for (; t < limit; t += dt) {
    const alive = rt.enemies.filter(e => e.state !== "dead");
    if (!alive.length) { if (++wave >= waves.length) return { cleared: true, seconds: t, dealt, taken, minHp: minHp / p.maxHp, died: false }; spawnWave(rt, waves[wave]); }
    const target = alive.sort((a, b) => d2(a, me) - d2(b, me))[0] ?? null;
    const hpBefore = p.hp, foes = rt.enemies.map(e => e.hp); // before this tick's attacks and abilities
    if (target) { p.aim = { x: target.x, z: target.z }; p.facing = Math.atan2(target.x - me.x, target.z - me.z); }
    // Telegraphs aimed at you: dodge 60% of them, decided once per windup, past half of it.
    const threat = rt.enemies.find(e => e.state === "windup" && e.t > e.move.windup * 0.5 && strikeLands(e, me, 0.6)) ?? null;
    if (threat && !judged.has(`${threat.id}:${threat.cycle}:${Math.floor(t / 2)}`)) {
      judged.add(`${threat.id}:${threat.cycle}:${Math.floor(t / 2)}`);
      if (random() < DODGE_SKILL && p.dodgeCd <= 0) { const a = Math.atan2(me.x - threat.x, me.z - threat.z) + strafe * 1.2; startDodge(rt, { x: Math.sin(a), z: Math.cos(a) }); castLeft = 0; }
    }
    // Drawing a rune: stand still; finish at ~80%.
    if (rt.casting) {
      if ((castLeft -= dt) <= 0) {
        const r = random(), acc = r < 0.1 ? 40 : r < 0.2 ? 96 : 80, pot = potencyFor(acc);
        resolveCast(rt, me, { accuracy: acc, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: pot.outcome === "fizzle" ? "fail" : pot.outcome === "enhanced" ? "enhanced" : "normal", power: pot.potency }, random);
      }
    } else if (!p.dash && p.dodgeAge === null) {
      for (let i = 0; i < 4; i++) {
        const a = rt.slots[i];
        if (!a || rt.cooldowns[`slot${i + 1}` as "slot1"] > 0 || p.energy < a.energy || !useful(rt, a, me, target, !!threat)) continue;
        const totem = a.effects.some(e => e.kind === "summon" && (UNITS[e.unit]?.kind === "totem"));
        if (totem && target) p.aim = { x: me.x + (target.x - me.x) * 0.3, z: me.z + (target.z - me.z) * 0.3 };
        if (fireSlot(rt, i, me, random)) { const c = rt.casting as CombatRuntime["casting"]; if (c) castLeft = RUNE_TIME[c.rune as keyof typeof RUNE_TIME] ?? RUNE_TIME.spark; break; }
      }
      if (target && !rt.casting && d2(target, me) <= WEAPONS[p.weapon].range + target.type.radius) attack(rt, me, random);
    }
    stepCombat(rt, me, dt, () => true, random);
    rt.enemies.forEach((e, i) => { if (foes[i] !== undefined) dealt += Math.max(0, foes[i] - e.hp); });
    taken += Math.max(0, hpBefore - p.hp);
    minHp = Math.min(minHp, p.hp);
    if (!p.alive) return { cleared: false, seconds: t, dealt, taken, minHp: 0, died: true };
    // Walk: hold the weapon's range, circle a little; stand still while drawing. A shelled crab facing you: close to
    // 2.6 u and circle to its flank (its telegraph teaches that). Standing in a puddle or pollen: step out of it.
    let mx = 0, mz = 0;
    if (target && !rt.casting && !p.dash && p.dodgeAge === null) {
      const shelled = !!target.type.shell && shellFactor(target, me) < 1;
      const want = shelled ? Math.min(2.6, RANGE[WEAPONS[p.weapon].kind]) : RANGE[WEAPONS[p.weapon].kind], dist = d2(target, me), ux = (target.x - me.x) / (dist || 1), uz = (target.z - me.z) / (dist || 1);
      const push = dist > want + 0.3 ? 1 : 0; // an average player closes to range and holds; no kiting backpedal
      if (random() < 0.01) strafe = -strafe;
      const circle = shelled ? 1 : 0.35;
      mx = ux * push - uz * strafe * circle; mz = uz * push + ux * strafe * circle;
      const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    }
    const puddle = rt.hazards.find(h => h.kind !== "wave" && d2(h, me) < h.r + 0.3);
    if (puddle && !rt.casting && p.dodgeAge === null) { const d = d2(puddle, me) || 1; mx = (me.x - puddle.x) / d; mz = (me.z - puddle.z) / d; }
    // The bot's dodge: the kit's dash (combatTuning), its burst easing to the dodge's exit over dashTime.
    const v = PLAYER_BASE.speed * p.speed, k = p.dodgeAge === null ? 1 : Math.min(1, p.dodgeAge / MOVE_TUNING.dashTime);
    const roll = p.dodgeAge === null ? 0 : MOVE_TUNING.dashSpeed * (DODGE_SHAPE.dashExit + (1 - DODGE_SHAPE.dashExit) * (1 - k) ** MOVE_TUNING.dashEase);
    me = { x: me.x + (mx * v + p.impulse.x + p.dodgeDir.x * roll) * dt, z: me.z + (mz * v + p.impulse.z + p.dodgeDir.z * roll) * dt };
  }
  return { cleared: false, seconds: t, dealt, taken, minHp: minHp / p.maxHp, died: false };
}

const SUBCLASSES = ["elementalist", "illusionist", "necromancer", "transmuter", "marksman", "hunter", "sniper", "gunslinger", "guardian", "monk", "juggernaut", "assassin", "summoner", "shaman", "druid", "priest"];
export interface BalanceRow { subclass: string; family: string; weapon: string; loadout: string; clearRate: number; medianClear: number; dps: number; takenPerMin: number; minHp: number; deaths: number }
export function balanceTable(missionId: "survive-circle" | "survive-sanctum", seeds = 20): BalanceRow[] {
  return SUBCLASSES.map(key => {
    const s = subclassByKey(key)!, runs = Array.from({ length: seeds }, (_, i) => runSurvive(key, missionId, i + 1));
    const won = runs.filter(r => r.cleared).map(r => r.seconds).sort((a, b) => a - b);
    const time = runs.reduce((n, r) => n + r.seconds, 0);
    return {
      subclass: s.name, family: s.family, weapon: WEAPONS[starterWeapon(s)].name, loadout: resolveLoadout(s).map(a => a.name).join(", "),
      clearRate: won.length / seeds, medianClear: won.length ? won[Math.floor(won.length / 2)] : NaN,
      dps: runs.reduce((n, r) => n + r.dealt, 0) / time, takenPerMin: (runs.reduce((n, r) => n + r.taken, 0) / time) * 60,
      minHp: runs.reduce((n, r) => n + r.minHp, 0) / seeds, deaths: runs.filter(r => r.died).length,
    };
  });
}
/** Zone 1's mini-boss against every subclass's bot (starter weapon, level 10): its clear rate, median minutes, deaths, lowest health. */
export interface ElderRow { subclass: string; family: string; weapon: string; clearRate: number; medianMinutes: number; deaths: number; minHp: number }
export function elderTable(seeds = 20): ElderRow[] {
  return SUBCLASSES.map(key => {
    const s = subclassByKey(key)!, runs = Array.from({ length: seeds }, (_, i) => runElder(key, i + 1));
    const won = runs.filter(r => r.cleared).map(r => r.seconds).sort((a, b) => a - b);
    return { subclass: s.name, family: s.family, weapon: WEAPONS[starterWeapon(s)].name, clearRate: won.length / seeds, medianMinutes: won.length ? won[Math.floor(won.length / 2)] / 60 : NaN,
      deaths: runs.filter(r => r.died).length, minHp: runs.reduce((n, r) => n + r.minHp, 0) / seeds };
  });
}
/**
 * Minutes to bring the guardian down with one weapon at level 10, all 27 points in its stat, landing half the time,
 * one hit in ten a crit (the content pass's measure; boss.test.ts holds it to 4–6 minutes for the starters). The same
 * measure for the elder thorn crab (`enemy`) counts every landed hit at full: you're hitting its flank or back.
 */
export function bossMinutes(weaponKey: string, enemy = "guardian-statue"): number {
  const w = SYSTEM_WEAPONS.find(x => x.key === weaponKey)!, stats = { ...ZERO_STATS, [w.scaling[0]]: 27 }, boss = ENEMIES[enemy];
  const hit = (crit: boolean) => damage({ weapon: w, durability: 99, stats, level: 10, enemyDefense: boss.defense, enemyArmor: boss.armor, crit });
  return boss.hp / ((0.9 * hit(false) + 0.1 * hit(true)) / WEAPONS[weaponKey].cooldown) / 0.5 / 60;
}
/** Family averages of the rows (clear rate, DPS, lowest health). */
export function familyAverages(rows: BalanceRow[]) {
  return ["Arcane", "Ranger", "Vanguard", "Warden"].map(f => {
    const r = rows.filter(x => x.family === f), avg = (k: keyof BalanceRow) => r.reduce((n, x) => n + (x[k] as number), 0) / r.length;
    return { family: f, clearRate: avg("clearRate"), medianClear: avg("medianClear"), dps: avg("dps"), takenPerMin: avg("takenPerMin"), minHp: avg("minHp") };
  });
}

// ── Classes v2 (design sheet §3 "How the harness changes") ──────────────────
/**
 * The bot on a v2 kit: it holds the tier-1 signature weapon, plays at a mastery (1: the starters; 20: everything,
 * ranks and the stat direction), meets movement riders on 30% of its casts (a typical player's share of slide, dash
 * and air casts), presses keys through the input layer as a player would (taps, double taps for combos, holds held
 * 1 s, charges held to full, toggles on when nothing's out, shapes drawn at about 80%), and fires the ult at a full
 * meter when two or more enemies are inside its area, or at the boss. Same tick, seeds and limits as today's runs.
 */

export interface RunV2 extends RunResult { ultDealt: number; fills: number[]; ults: number }
/** The weapon a member holds for this kit: its tier-1 signature weapon (the dev kit: today's weapon of its type). */
export function signatureWeapon(kitKey: string): string {
  const kit = classKit(kitKey)!, sig = signatureGrant(kitKey, 1);
  return sig?.key ?? SYSTEM_WEAPONS.find(w => w.type === kit.signature.type && STARTER_WEAPONS.includes(w.key))?.key ?? SYSTEM_WEAPONS.find(w => w.type === kit.signature.type)!.key;
}
const ULT_REACH = (a: ClassAbility) => Math.max(...a.effects.map(e => (e.kind === "area" ? e.radius : e.kind === "projectile" ? 1.5 : 0)), 2);

/** One v2 run: a survive mission's waves, or the guardian (`"boss"`: the scripted fight, bot rules plus the stagger window). */
export function runV2(kitKey: string, missionId: "survive-circle" | "survive-sanctum" | "boss", seed: number, mastery = 1, limit = 240): RunV2 {
  const kit = classKit(kitKey)!, random = lcg(seed), rt = createRuntime(), p = rt.player;
  p.stats = presetAllocation(kit.family, 10); p.level = 10; p.safe = false;
  p.weapon = signatureWeapon(kitKey);
  equipClassKit(rt, kit, mastery);
  p.hp = p.maxHp; p.energy = 100;
  const v = rt.v2!, boss = missionId === "boss";
  const center = boss ? { x: BOSS_CENTER.x, z: BOSS_CENTER.z - 6 } : SURVIVE_CIRCLES[missionId], waves = boss ? [[{ id: "boss", type: "guardian-statue", x: 0, z: 25.5 }]] : WAVES[missionId];
  let me: Vec = { x: center.x, z: center.z }, wave = 0, strafe = 1, t = 0, taken = 0, minHp = p.hp, fillFrom = 0, ults = 0, drawLeft = 0;
  const fills: number[] = [], judged = new Set<string>(), held: { slot: number; at: number }[] = [];
  spawnWave(rt, waves[0]);
  const dt = 1 / 30;
  const done = (cleared: boolean, died = false): RunV2 => ({ cleared, seconds: t, dealt: rt.tally.dealt, taken, minHp: died ? 0 : minHp / p.maxHp, died, ultDealt: rt.tally.ult, fills, ults });
  for (; t < limit; t += dt) {
    const alive = rt.enemies.filter(e => e.state !== "dead");
    if (!alive.length) { if (++wave >= waves.length) return done(true); spawnWave(rt, waves[wave]); }
    const target = alive.filter(e => e.type.kind === "boss")[0] ?? alive.sort((a, b) => d2(a, me) - d2(b, me))[0] ?? null;
    const hpBefore = p.hp;
    if (target) { p.aim = { x: target.x, z: target.z }; p.facing = Math.atan2(target.x - me.x, target.z - me.z); }
    const threat = rt.enemies.find(e => e.state === "windup" && e.t > e.move.windup * 0.5 && strikeLands(e, me, 0.6)) ?? null;
    if (threat && !judged.has(`${threat.id}:${threat.cycle}:${Math.floor(t / 2)}`)) {
      judged.add(`${threat.id}:${threat.cycle}:${Math.floor(t / 2)}`);
      if (random() < DODGE_SKILL && p.dodgeCd <= 0) { const a = Math.atan2(me.x - threat.x, me.z - threat.z) + strafe * 1.2; startDodge(rt, { x: Math.sin(a), z: Math.cos(a) }); }
    }
    // Riders: 30% of the time the bot is sliding, in the air, just off a dash and fast.
    const rider = random() < 0.3;
    p.move = rider ? { mode: random() < 0.5 ? "slide" : "air", speed: 16, sinceDash: 0.1, vx: 0, vz: 16, height: 1.5 } : { mode: "ground", speed: 7.4, sinceDash: 9, vx: 0, vz: 7.4 };
    if (rt.casting && (drawLeft -= dt) <= 0) {
      const acc = random() < 0.1 ? 40 : random() < 0.2 ? 96 : 80;
      resolveCast(rt, me, { accuracy: acc, coverage: 1, deviation: 0, order: 1, scribble: false, outcome: acc < 50 ? "fail" : acc >= 95 ? "enhanced" : "normal", power: shapePotency(acc) }, random);
    }
    for (let i = held.length - 1; i >= 0; i--) if (t >= held[i].at) { classKey(rt, held[i].slot, false); held.splice(i, 1); }
    const staggered = target?.type.kind === "boss" && target.state === "recover" && !!target.move.stagger;
    const before = v.meter; // before this frame's presses and swings: a basic attack can fill it too
    // The ult: full, with two or more enemies inside its area (or the boss).
    if (v.meter >= ULT.max && target && (target.type.kind === "boss" || alive.filter(e => d2(e, target) <= ULT_REACH(v.ult)).length >= 2)) pressUlt(rt);
    else if (!rt.casting && !p.dash && p.dodgeAge === null && v.queue.length === 0 && !held.length) {
      for (let i = 0; i < v.keys.length; i++) {
        const a = v.keys[i];
        if (!a || (v.cd[a.key] ?? 0) > 0 || p.energy < a.energy || (a.when && !rider)) continue;
        const kind = a.input?.kind ?? "tap";
        if (kind === "toggle" && v.toggled[i]) continue;
        // A block that parries (classes v2): for each telegraph aimed at you, about half of members time it into the last
        // 0.2 s (a parry), the rest raise the block as soon as they see it (70% off, held a second).
        if (a.effects.some(e => e.kind === "buff" && e.stat === "parry")) {
          if (!threat) continue;
          const id = `parry:${threat.id}:${threat.cycle}`;
          if (!judged.has(id)) { judged.add(id); if (random() < PARRY_SKILL) judged.add(`${id}:late`); }
          if (judged.has(`${id}:late`) && threat.move.windup - threat.t >= 0.2) continue;
          if (judged.has(`${id}:done`)) continue;
          judged.add(`${id}:done`);
        } else if (!(staggered || useful(rt, a, me, target, !!threat))) continue;
        const combo = v.combos.find(c => c.keys[0] === i && c.keys[1] === i && p.energy >= c.ability.energy && random() < 0.5);
        classKey(rt, i, true);
        if (kind === "hold" || kind === "charge") held.push({ slot: i, at: t + (kind === "hold" ? 1 : (a.input as { max_s: number }).max_s) }); // let go later
        else { classKey(rt, i, false); if (combo) { classKey(rt, i, true); classKey(rt, i, false); } }
        if (kind === "drawn") drawLeft = RUNE_TIME.spark;
        break;
      }
      if (target && !rt.casting && d2(target, me) <= WEAPONS[p.weapon].range + target.type.radius) attack(rt, me, random);
    }
    stepClass(rt, me, dt, dt, random);
    stepCombat(rt, me, dt, () => true, random);
    if (before < ULT.max && v.meter >= ULT.max) fills.push(t - fillFrom);
    if (v.cast && v.cast.t <= dt) { ults++; fillFrom = t; }
    taken += Math.max(0, hpBefore - p.hp);
    minHp = Math.min(minHp, p.hp);
    if (!p.alive) return done(false, true);
    let mx = 0, mz = 0;
    if (target && !p.dash && p.dodgeAge === null) {
      const want = RANGE[WEAPONS[p.weapon].kind], dist = d2(target, me), ux = (target.x - me.x) / (dist || 1), uz = (target.z - me.z) / (dist || 1);
      const push = dist > want + 0.3 ? 1 : 0;
      if (random() < 0.01) strafe = -strafe;
      mx = ux * push - uz * strafe * 0.35; mz = uz * push + ux * strafe * 0.35;
      const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    }
    const vv = PLAYER_BASE.speed * p.speed, k = p.dodgeAge === null ? 1 : Math.min(1, p.dodgeAge / MOVE_TUNING.dashTime);
    const roll = p.dodgeAge === null ? 0 : MOVE_TUNING.dashSpeed * (DODGE_SHAPE.dashExit + (1 - DODGE_SHAPE.dashExit) * (1 - k) ** MOVE_TUNING.dashEase);
    me = { x: me.x + (mx * vv + p.impulse.x + p.dodgeDir.x * roll) * dt, z: me.z + (mz * vv + p.impulse.z + p.dodgeDir.z * roll) * dt };
    if (p.kick?.to) me = { x: p.kick.to.x, z: p.kick.to.z }; // a blink lands
    p.kick = null; // open ground: the bot doesn't simulate jumps; riders are sampled above
  }
  return done(false);
}

export interface BalanceRowV2 extends BalanceRow { role: string; mastery: number; ultFill: number; ultShare: number }
/** A kit's row at a mastery: the band's columns plus the median ult fill time, the ult's share of the damage and the role. */
export function balanceRowV2(kitKey: string, missionId: "survive-circle" | "survive-sanctum", mastery = 1, seeds = 20): BalanceRowV2 {
  const kit = classKit(kitKey)!, runs = Array.from({ length: seeds }, (_, i) => runV2(kitKey, missionId, i + 1, mastery));
  const won = runs.filter(r => r.cleared).map(r => r.seconds).sort((a, b) => a - b), time = runs.reduce((n, r) => n + r.seconds, 0);
  const fills = runs.flatMap(r => r.fills).sort((a, b) => a - b), dealt = runs.reduce((n, r) => n + r.dealt, 0);
  return { subclass: kit.name, family: kit.family, weapon: WEAPONS[signatureWeapon(kitKey)].name, loadout: kit.keys.map(a => a.name).join(", "), role: kit.role, mastery,
    clearRate: won.length / seeds, medianClear: won.length ? won[Math.floor(won.length / 2)] : NaN, dps: dealt / time, takenPerMin: (runs.reduce((n, r) => n + r.taken, 0) / time) * 60,
    minHp: runs.reduce((n, r) => n + r.minHp, 0) / seeds, deaths: runs.filter(r => r.died).length,
    ultFill: fills.length ? fills[Math.floor(fills.length / 2)] : NaN, ultShare: dealt ? runs.reduce((n, r) => n + r.ultDealt, 0) / dealt : 0 };
}
/** The scripted guardian fight's minutes (median of the seeds; the limit when it never falls). */
export function bossMinutesV2(kitKey: string, mastery = 1, seeds = 8): number {
  const t = Array.from({ length: seeds }, (_, i) => runV2(kitKey, "boss", i + 1, mastery, 600)).map(r => (r.cleared ? r.seconds : 600) / 60).sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)];
}
/** §3 targets the band test pins for v2 kits (waves 1–4 fill the kits; wave 5 checks all 16). */
export const V2_TARGETS = { dpsBand: [0.75, 1.25], takenSpread: 3, clearFloor: 0.7, ultFillSanctum: [60, 90], ultFillNormal: [45, 90], ultShare: [0.08, 0.15], guardian: [4, 6], guardian20: [3.5, 5], mastery20Ratio: 1.2,
  roles: { damage: [1.0, 1.2], support: [0.9, 1.05], tank: [0.8, 0.95], healer: [0.8, 0.95] } } as const;
/** Where a set of v2 rows sits against the §3 band (normal-run DPS vs the median, sanctum damage-taken spread, the lowest clear, ult fill and share, per-role DPS). */
export function bandV2(normal: BalanceRowV2[], hard: BalanceRowV2[]) {
  const med = (v: number[]) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
  const dps = med(normal.map(r => r.dps)), taken = hard.map(r => r.takenPerMin);
  return {
    dpsLow: Math.min(...normal.map(r => r.dps)) / dps, dpsHigh: Math.max(...normal.map(r => r.dps)) / dps,
    spread: Math.max(...taken) / Math.max(1e-6, Math.min(...taken)),
    clearNormal: Math.min(...normal.map(r => r.medianClear)) / med(normal.map(r => r.medianClear)), clearHard: Math.min(...hard.map(r => r.medianClear)) / med(hard.map(r => r.medianClear)),
    ultFillHard: hard.map(r => r.ultFill), ultShare: hard.map(r => r.ultShare),
    roles: normal.map(r => ({ subclass: r.subclass, role: r.role, ratio: r.dps / dps })),
  };
}
