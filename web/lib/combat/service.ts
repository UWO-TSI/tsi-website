/**
 * Combat service: progression view, stat allocation/reset, subclass choice,
 * kills, missions and gear. Rules from this folder decide; the store (035
 * functions) applies atomically and idempotently.
 */
import { ENEMIES, MINIBOSS_DROPS, MISSIONS, rollBossReward } from "./content";
import { islandProgression } from "./islandAdapter";
import { checkLoadout, kitOptions, resolveLoadout, subclassByKey, subclassesFor, traitFor } from "./kits";
import { applyEvents, canStart, type MissionEvent, type MissionState } from "./missions";
import { allocate, derived, FAMILY_PRESETS, levelProgress, pointsEarned, pointsSpent, presetAllocation, STAT_RESET_FEE, STATS, SUBCLASS_LEVEL, SUBCLASS_RESPEC_FEE, ZERO_STATS } from "./progression";
import { toFailure, type Result } from "@/lib/result";
import { CombatError, type CombatStore } from "./store";
import { repairCost, WEAPONS } from "./weapons";
import { CLASS_KITS, CLASS_RENAMES, classKit, memberKit, nextUnlock } from "./classes";
import { masteryProgress, masteryTitle } from "./mastery";
import { suggestSubclass } from "@/lib/oracle/subclass";
import type { CosmeticKind } from "./store";

const ERR: Record<string, [number, string]> = {
  unavailable: [503, "The ruins are closed for now."],
  insufficient: [409, "Not enough coins."],
  not_found: [404, "Not found."],
  not_owned: [409, "You don't own that."],
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
  gate_closed: [403, "The ruins gate is sealed: it opens after the Oracle, level 10 and your subclass choice."],
  boss_cooldown: [409, "The guardian's hoard is spent for now. It refills 20 hours after your last win."],
  miniboss_cooldown: [409, "Its hoard is spent for now. It refills 20 hours after your last win over it."],
  bad_loadout: [400, "That loadout isn't in your kit."],
  no_subclass: [409, "Choose your subclass at the Oracle first."],
  locked: [409, "Your path is locked. Redo the Oracle to choose again."],
  bad_cosmetic: [400, "That doesn't go there."],
  failed: [500, "Something went wrong. Try again."],
};
async function run<T>(f: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await f() };
  } catch (err) {
    return toFailure(ERR, err);
  }
}

/** Classes v2 (behind economy_settings.classes_v2): the flag, then mastery rows only when it is on. */
async function classesV2(store: CombatStore, m: string) {
  const on = (await store.setting("classes_v2")) === 1;
  return { on, rows: on ? await store.mastery(m) : [] };
}
/** The Oracle's suggestion for this member's reading (§1.11): the type's subclass, the keeper's line, the runner-up when unclear. */
const suggestion = async (store: CombatStore, m: string) => { const r = await store.oracleReading(m); return r ? suggestSubclass(r.type, r.scores) : null; };

export const getProgression = (store: CombatStore, m: string) =>
  run(async () => {
    const [p, family, owned, v2] = await Promise.all([store.progression(m), store.family(m), store.weapons(m), classesV2(store, m)]);
    const subclass = subclassByKey(p.subclass), kit = v2.on ? memberKit(p.subclass) : null;
    const row = v2.rows.find((r) => r.subclass === p.subclass), mastery = masteryProgress(row?.xp ?? 0);
    // The equipped weapon skin as its look: the mastery trim, or a bought skin's key (classes.ts WEAPON_SKINS by subclass).
    const worn = row?.cosmetics.weapon_skin, skin = !worn ? null : worn === "mastery:trim" ? worn : (await store.skinOf?.(worn)) ?? null;
    return {
      ...levelProgress(p.xp),
      stats: p.stats,
      points_available: pointsEarned(p.level) - pointsSpent(p.stats),
      derived: derived(p.stats, p.level, subclass?.mods),
      family,
      subclass,
      /** The chosen subclass's key (also when it has only a v2 kit, the dev kit). */
      subclass_key: p.subclass,
      /** Four equipped ability keys (row 50), the whole kit to choose from, and the Transmuter's traits with their defeats. */
      loadout: subclass ? resolveLoadout(subclass, p.loadout, p.traits).map((a) => a.key) : [],
      kit: subclass ? kitOptions(subclass, p.traits).map((a) => a.key) : [],
      traits: p.traits,
      subclass_choices: family && p.level >= SUBCLASS_LEVEL ? subclassesFor(family) : [],
      preset: family ? { weights: FAMILY_PRESETS[family], at_level: presetAllocation(family, p.level) } : null,
      fees: { stat_reset: STAT_RESET_FEE, subclass_change: v2.on ? 0 : SUBCLASS_RESPEC_FEE },
      /**
       * Classes v2 (null while the flag is off): the active subclass's v2 kit key (null until its family wave lands), its mastery and title,
       * equipped cosmetics, the next unlock, every subclass's row (the profile strip), the repick token, and the family's v2 kits.
       */
      classes: v2.on ? {
        kit: kit?.key ?? null, mastery, title: kit ? masteryTitle(kit.name, mastery.mastery) : null, cosmetics: row?.cosmetics ?? {}, skin,
        next: kit ? nextUnlock(kit, mastery.mastery) : null, rows: v2.rows, repick: p.repick_source,
        kits: family ? CLASS_KITS.filter((k) => k.family === family && memberKit(k.key)).map((k) => k.key) : [],
        suggestion: family && p.level >= SUBCLASS_LEVEL ? await suggestion(store, m) : null,
        /** The profile's class fields (§1.9: portal profile and phone companion, no 3D): icon, subclass, mastery and title, frame, and the other subclasses past mastery 1. */
        profile: p.subclass ? {
          icon: classKit(p.subclass)?.look.icon ?? null, subclass: p.subclass, name: classKit(p.subclass)?.name ?? CLASS_RENAMES[p.subclass] ?? subclass?.name ?? p.subclass,
          mastery: mastery.mastery, title: masteryTitle(classKit(p.subclass)?.name ?? CLASS_RENAMES[p.subclass] ?? subclass?.name ?? p.subclass, mastery.mastery),
          frame: row?.cosmetics.frame ?? null, mastered: mastery.mastery >= 20,
          others: v2.rows.filter((r) => r.subclass !== p.subclass && r.mastery > 1).map((r) => ({ subclass: r.subclass, mastery: r.mastery, icon: classKit(r.subclass)?.look.icon ?? null })),
        } : null,
      } : null,
      weapons: owned.map((w) => {
        const def = WEAPONS.find((x) => x.key === w.weapon_key)!;
        return { ...w, name: def.name, type: def.type, tier: def.tier, max_durability: def.max_durability, repair_cost: repairCost(def, w.durability), broken: w.durability <= 0 };
      }),
    };
  });

/**
 * Set the allocation to `target` (stats left out keep their value). Sending the
 * total rather than the points to add makes a retried request a no-op. Lowering
 * a stat needs the paid reset.
 */
export const allocateStats = (store: CombatStore, m: string, target: Record<string, unknown>) =>
  run(async () => {
    const p = await store.progression(m);
    const current = p.stats ?? ZERO_STATS;
    const add: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(target)) add[k] = typeof v === "number" && STATS.includes(k as never) ? v - current[k as keyof typeof current] : v;
    if (Object.values(add).some((v) => typeof v === "number" && v < 0)) throw new CombatError("needs_reset");
    const r = allocate(current, add, p.level);
    if (!r.ok) throw Object.assign(new CombatError("not_enough_points", r.error));
    return store.allocate(m, r.stats);
  });

export const resetStats = (store: CombatStore, m: string, key: string) => run(() => store.resetStats(m, key));

export const chooseSubclass = (store: CombatStore, m: string, subclassKey: string, key: string) =>
  run(async () => {
    const s = subclassByKey(subclassKey) ?? memberKit(subclassKey); // a v2 kit (the dev kit outside production) or today's
    if (!s) throw new CombatError("not_found");
    return store.chooseSubclass(m, s.key, s.family, key);
  });

/** Row 50: four abilities from the kit, chosen outside combat. Setting the same list again changes nothing. */
export const setLoadout = (store: CombatStore, m: string, loadout: unknown) =>
  run(async () => {
    const p = await store.progression(m);
    const s = subclassByKey(p.subclass);
    if (!s) throw new CombatError("no_subclass");
    const c = checkLoadout(s, loadout, p.traits);
    if (!c.ok) throw new CombatError("bad_loadout", c.error);
    return store.setLoadout(m, c.loadout);
  });

/**
 * Rows 179/207: the ruins open with the Oracle family, level 10 and the subclass
 * choice. Every call that implies being inside (mission start and progress,
 * kills, the boss reward) checks it here, since the client can't be trusted to.
 */
async function requireGate(store: CombatStore, m: string) {
  const [p, family] = await Promise.all([store.progression(m), store.family(m)]);
  if (!islandProgression({ level: p.level, family, subclass: p.subclass ? { key: p.subclass } : null }).gateOpen) throw new CombatError("gate_closed");
  return p;
}

/** A kill; for a Transmuter the first defeat of a species also names the trait it just learned (row 40, counted in the same transaction). */
export const recordKill = (store: CombatStore, m: string, enemyKey: string, eventKey: string) =>
  run(async () => {
    const p = await requireGate(store, m);
    // Only a Transmuter's defeats count traits (combat_kits): nobody else needs the second read.
    const t = p.subclass === "transmuter" ? traitFor(enemyKey) : undefined;
    const before = t ? p.traits[t.key] ?? 0 : 0;
    // Classes v2: the kill also trains the active subclass by the same XP (combat_grant_xp); read its row once, before.
    const v2 = p.subclass ? await classesV2(store, m) : { on: false, rows: [] };
    const was = v2.on ? v2.rows.find((x) => x.subclass === p.subclass)?.xp ?? 0 : 0;
    const r = await store.recordKill(m, enemyKey, eventKey);
    const after = t && !r.replayed ? (await store.progression(m)).traits[t.key] ?? 0 : 0;
    const mastery = v2.on && !r.replayed ? masteryProgress(was + r.xp - p.xp) : null;
    return { ...r, trait_unlocked: t && before === 0 && after > 0 ? t.key : null,
      /** Classes v2: the active subclass's mastery after this kill, and whether it levelled. */
      mastery: mastery && { ...mastery, levelled_up: mastery.mastery > masteryProgress(was).mastery } };
  });

/** Classes v2: put on (or take off, null) a weapon skin, aura colours or a nameplate frame for one subclass (§1.10). */
export const equipCosmetic = (store: CombatStore, m: string, subclass: string, kind: CosmeticKind, value: string | null) => run(() => store.equipCosmetic(m, subclass, kind, value));

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
    await requireGate(store, m);
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
    await requireGate(store, m);
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
  run(async () => {
    await requireGate(store, m);
    return store.bossReward(m, eventKey, rollBossReward((await store.weapons(m)).map((w) => w.weapon_key), random));
  });
/** A mini-boss's victory (the elder thorn crab): its own table, rolled here, paid by the store once per kill. */
export const claimMinibossReward = (store: CombatStore, m: string, enemyKey: string, eventKey: string, random: () => number = Math.random) =>
  run(async () => {
    const table = MINIBOSS_DROPS[enemyKey];
    if (!table) throw new CombatError("unknown_enemy");
    await requireGate(store, m);
    return store.minibossReward(m, enemyKey, eventKey, rollBossReward((await store.weapons(m)).map((w) => w.weapon_key), random, table));
  });
export const reportWear = (store: CombatStore, m: string, weaponKey: string, hits: number, defeated: boolean, key: string) => run(() => store.wear(m, weaponKey, hits, defeated, key));
export const repairWeapon = (store: CombatStore, m: string, weaponKey: string, key: string) => run(() => store.repair(m, weaponKey, key));
export const equipWeapon = (store: CombatStore, m: string, weaponKey: string) =>
  run(async () => {
    await store.equip(m, weaponKey);
    return { equipped: weaponKey };
  });
