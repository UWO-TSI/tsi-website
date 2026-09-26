/**
 * Combat service: progression view, stat allocation/reset, subclass choice,
 * kills, missions and gear. Rules from this folder decide; the store (035
 * functions) applies atomically and idempotently.
 */
import { ENEMIES, MISSIONS, rollBossReward } from "./content";
import { SUBCLASSES, subclassesFor } from "./kits";
import { applyEvents, canStart, type MissionEvent, type MissionState } from "./missions";
import { allocate, derived, FAMILY_PRESETS, levelProgress, pointsEarned, pointsSpent, presetAllocation, STAT_RESET_FEE, SUBCLASS_LEVEL, SUBCLASS_RESPEC_FEE, ZERO_STATS } from "./progression";
import { toFailure, type Result } from "@/lib/result";
import { CombatError, type CombatStore } from "./store";
import { repairCost, WEAPONS } from "./weapons";

const ERR: Record<string, [number, string]> = {
  unavailable: [503, "The ruins are closed for now."],
  insufficient: [409, "Not enough coins."],
  not_found: [404, "Not found."],
  not_owned: [409, "You don't own that weapon."],
  needs_reset: [409, "Removing points needs a stat reset at the Oracle."],
  not_enough_points: [409, "Not enough stat points."],
  level_too_low: [409, `Subclasses unlock at level ${SUBCLASS_LEVEL}.`],
  wrong_family: [409, "That subclass belongs to another family."],
  no_family: [409, "Visit the Oracle first to learn your family."],
  cooldown: [409, "That mission is on cooldown."],
  not_ready: [409, "The mission isn't finished yet."],
  kill_xp_cap: [429, "You've earned all the kill XP you can this hour. Missions still pay."],
  unknown_enemy: [400, "Unknown enemy."],
  unknown_mission: [404, "Unknown mission."],
  bad_hits: [400, "Invalid hit count."],
  boss_cooldown: [409, "The guardian's hoard is spent for now. It refills 20 hours after your last win."],
  failed: [500, "Something went wrong. Try again."],
};
async function run<T>(f: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await f() };
  } catch (err) {
    return toFailure(ERR, err);
  }
}

export const getProgression = (store: CombatStore, m: string) =>
  run(async () => {
    const [p, family, owned] = await Promise.all([store.progression(m), store.family(m), store.weapons(m)]);
    return {
      ...levelProgress(p.xp),
      stats: p.stats,
      points_available: pointsEarned(p.level) - pointsSpent(p.stats),
      derived: derived(p.stats, p.level),
      family,
      subclass: p.subclass ? (SUBCLASSES.find((s) => s.key === p.subclass) ?? null) : null,
      subclass_choices: family && p.level >= SUBCLASS_LEVEL ? subclassesFor(family) : [],
      preset: family ? { weights: FAMILY_PRESETS[family], at_level: presetAllocation(family, p.level) } : null,
      fees: { stat_reset: STAT_RESET_FEE, subclass_change: SUBCLASS_RESPEC_FEE },
      weapons: owned.map((w) => {
        const def = WEAPONS.find((x) => x.key === w.weapon_key)!;
        return { ...w, name: def.name, type: def.type, tier: def.tier, max_durability: def.max_durability, repair_cost: repairCost(def, w.durability), broken: w.durability <= 0 };
      }),
    };
  });

export const allocateStats = (store: CombatStore, m: string, add: Record<string, unknown>) =>
  run(async () => {
    const p = await store.progression(m);
    const r = allocate(p.stats ?? ZERO_STATS, add, p.level);
    if (!r.ok) throw Object.assign(new CombatError("not_enough_points", r.error));
    return store.allocate(m, r.stats);
  });

export const resetStats = (store: CombatStore, m: string, key: string) => run(() => store.resetStats(m, key));

export const chooseSubclass = (store: CombatStore, m: string, subclassKey: string, key: string) =>
  run(async () => {
    const s = SUBCLASSES.find((x) => x.key === subclassKey);
    if (!s) throw new CombatError("not_found");
    return store.chooseSubclass(m, s.key, s.family, key);
  });

export const recordKill = (store: CombatStore, m: string, enemyKey: string, eventKey: string) => run(() => store.recordKill(m, enemyKey, eventKey));

export const listMissions = (store: CombatStore, m: string, now: Date) =>
  run(async () => {
    const rows = await store.missionRows(m);
    return MISSIONS.map((def) => {
      const open = rows.find((r) => r.mission_key === def.key && (r.state === "active" || r.state === "ready")) ?? null;
      const last = rows.filter((r) => r.mission_key === def.key && r.completed_at).map((r) => r.completed_at!).sort().pop() ?? null;
      const start = canStart(def, last, !!open, now);
      return { ...def, open, can_start: start.ok, cooldown_until: !start.ok && start.reason === "cooldown" ? start.until : null };
    });
  });

export const startMission = (store: CombatStore, m: string, missionKey: string, startKey: string, now: Date) =>
  run(async () => {
    const def = MISSIONS.find((x) => x.key === missionKey);
    if (!def) throw new CombatError("unknown_mission");
    const rows = await store.missionRows(m);
    const open = rows.find((r) => r.mission_key === missionKey && (r.state === "active" || r.state === "ready"));
    if (!open) {
      const last = rows.filter((r) => r.mission_key === missionKey && r.completed_at).map((r) => r.completed_at!).sort().pop() ?? null;
      const c = canStart(def, last, false, now);
      if (!c.ok) throw new CombatError("cooldown");
    }
    return store.startMission(m, missionKey, startKey);
  });

/** Apply client-reported events (deduped by id) and save the new state. */
export const missionProgress = (store: CombatStore, m: string, progressId: string, events: MissionEvent[]) =>
  run(async () => {
    const row = (await store.missionRows(m)).find((r) => r.id === progressId);
    if (!row) throw new CombatError("not_found");
    const def = MISSIONS.find((x) => x.key === row.mission_key)!;
    for (const ev of events) {
      if (ev.type === "kill" && !ENEMIES.some((e) => e.key === ev.enemy)) throw new CombatError("unknown_enemy");
    }
    const next = applyEvents(def, { ...row.progress, state: row.state as MissionState }, events);
    if (next !== row.progress) await store.saveMission(m, progressId, next.state, next);
    return { id: progressId, mission_key: def.key, state: next.state, counter: next.counter, carrying: next.carrying };
  });

export const completeMission = (store: CombatStore, m: string, progressId: string) => run(() => store.completeMission(m, progressId));
/** Guardian statue victory: rolled here on the server against the gear the member owns, paid by the store once. */
export const claimBossReward = (store: CombatStore, m: string, eventKey: string, random: () => number = Math.random) =>
  run(async () => store.bossReward(m, eventKey, rollBossReward((await store.weapons(m)).map((w) => w.weapon_key), random)));
export const reportWear = (store: CombatStore, m: string, weaponKey: string, hits: number, defeated: boolean, key: string) => run(() => store.wear(m, weaponKey, hits, defeated, key));
export const repairWeapon = (store: CombatStore, m: string, weaponKey: string, key: string) => run(() => store.repair(m, weaponKey, key));
export const equipWeapon = (store: CombatStore, m: string, weaponKey: string) =>
  run(async () => {
    await store.equip(m, weaponKey);
    return { equipped: weaponKey };
  });
