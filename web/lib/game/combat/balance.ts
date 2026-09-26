/**
 * Part B balance pass (G2): a scripted solo run of a survive mission for
 * every subclass through the real encounter tick (encounter.ts) and ability
 * system. The bot plays like an average member: the starter weapon its kit
 * suggests, the family stat preset at level 10, the default loadout; it keeps
 * its weapon's range without kiting, dodges 60% of telegraphed attacks aimed at it, uses an
 * ability when it helps (heal when hurt, guard when a hit is coming, damage
 * when in reach, summons when there's room) and draws runes at ~80% (one in
 * ten fizzles, one in ten is empowered). No collision (open ground).
 * specs/evidence/combat-b/balance.md is this table.
 */
import { FAMILY_STAT, resolveLoadout, subclassByKey, UNITS, type Ability, type Subclass } from "@/lib/combat/kits";
import { WEAPONS as SYSTEM_WEAPONS } from "@/lib/combat/weapons";
import { derived, presetAllocation } from "@/lib/combat/progression";
import { potencyFor } from "@/lib/combat/incantation";
import { SURVIVE_CIRCLES } from "@/lib/game/ruins";
import { equipKit, useSlot, resolveCast } from "./abilities";
import { attack, spawnWave, startDodge } from "./actions";
import { PLAYER_BASE, WEAPONS } from "./data";
import { stepCombat } from "./encounter";
import { createRuntime, type CombatRuntime } from "./runtime";
import { strikeLands, type Enemy, type Vec } from "./sim";
import { WAVES } from "./spawns";

export const STARTERS = ["sword-driftwood", "bow-willow", "staff-oak", "tome-spirits", "wraps-cloth"];
const FALLBACK: Record<string, string> = { Arcane: "staff-oak", Ranger: "bow-willow", Vanguard: "sword-driftwood", Warden: "tome-spirits" };
/** What a sensible member carries: the first starter the kit suggests that scales with the family's stat (row 31), else the family's own. */
export function starterWeapon(s: Subclass): string {
  for (const t of s.weapon_affinity) {
    const w = SYSTEM_WEAPONS.find(x => STARTERS.includes(x.key) && x.type === t);
    if (w && w.scaling[0] === FAMILY_STAT[s.family]) return w.key;
  }
  return FALLBACK[s.family];
}
const RANGE: Record<string, number> = { melee: 1.2, bow: 7, staff: 6, summon: 5 };
const RUNE_TIME = { spark: 1.6, binding: 3.2 };
const DODGE_SKILL = 0.6;

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
  }
  return false;
}

/** One solo run of a survive mission's waves (the mission's own spawns and circle). */
export function runSurvive(subclassKey: string, missionId: "survive-circle" | "survive-sanctum", seed: number, limit = 240): RunResult {
  const s = subclassByKey(subclassKey)!, random = lcg(seed), rt = createRuntime(), p = rt.player;
  p.stats = presetAllocation(s.family, 10); p.level = 10; p.safe = false;
  p.maxHp = p.hp = derived(p.stats, 10, s.mods).max_hp;
  p.weapon = starterWeapon(s);
  equipKit(rt, s);
  const center = SURVIVE_CIRCLES[missionId], waves = WAVES[missionId];
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
        if (useSlot(rt, i, me, random)) { if (rt.casting) castLeft = RUNE_TIME[rt.casting.rune]; break; }
      }
      if (target && !rt.casting && d2(target, me) <= WEAPONS[p.weapon].range + target.type.radius) attack(rt, me, random);
    }
    stepCombat(rt, me, dt, () => true, random);
    rt.enemies.forEach((e, i) => { if (foes[i] !== undefined) dealt += Math.max(0, foes[i] - e.hp); });
    taken += Math.max(0, hpBefore - p.hp);
    minHp = Math.min(minHp, p.hp);
    if (!p.alive) return { cleared: false, seconds: t, dealt, taken, minHp: 0, died: true };
    // Walk: hold the weapon's range, circle a little; stand still while drawing.
    let mx = 0, mz = 0;
    if (target && !rt.casting && !p.dash && p.dodgeAge === null) {
      const want = RANGE[WEAPONS[p.weapon].kind], dist = d2(target, me), ux = (target.x - me.x) / (dist || 1), uz = (target.z - me.z) / (dist || 1);
      const push = dist > want + 0.3 ? 1 : 0; // an average player closes to range and holds; no kiting backpedal
      if (random() < 0.01) strafe = -strafe;
      mx = ux * push - uz * strafe * 0.35; mz = uz * push + ux * strafe * 0.35;
      const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    }
    const v = PLAYER_BASE.speed * p.speed;
    me = { x: me.x + (mx * v + p.impulse.x) * dt, z: me.z + (mz * v + p.impulse.z) * dt };
  }
  return { cleared: false, seconds: t, dealt, taken, minHp: minHp / p.maxHp, died: false };
}

export interface BalanceRow { subclass: string; family: string; weapon: string; loadout: string; clearRate: number; medianClear: number; dps: number; takenPerMin: number; minHp: number; deaths: number }
export function balanceTable(missionId: "survive-circle" | "survive-sanctum", seeds = 20): BalanceRow[] {
  return ["elementalist", "illusionist", "necromancer", "transmuter", "marksman", "hunter", "sniper", "gunslinger", "guardian", "monk", "juggernaut", "assassin", "summoner", "shaman", "druid", "priest"].map(key => {
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
/** Family averages of the rows (clear rate, DPS, lowest health). */
export function familyAverages(rows: BalanceRow[]) {
  return ["Arcane", "Ranger", "Vanguard", "Warden"].map(f => {
    const r = rows.filter(x => x.family === f), avg = (k: keyof BalanceRow) => r.reduce((n, x) => n + (x[k] as number), 0) / r.length;
    return { family: f, clearRate: avg("clearRate"), medianClear: avg("medianClear"), dps: avg("dps"), takenPerMin: avg("takenPerMin"), minHp: avg("minHp") };
  });
}
