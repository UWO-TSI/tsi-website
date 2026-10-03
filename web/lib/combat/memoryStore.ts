/** In-memory CombatStore mirroring 20260926150800_combat.sql, 190000_combat_content, 210000_combat_kits and 20261002181044_classes_v2 (tests, dev harness). */
import type { Family } from "@/lib/oracle/engine";
import { BOSS_DROPS, ENEMIES, MINIBOSS_DROPS, MISSIONS, type BossReward } from "./content";
import { initialProgress, type MissionProgress, type MissionState } from "./missions";
import { KILL_XP_PER_HOUR_CAP, levelForXp, pointsEarned, pointsSpent, STATS, ZERO_STATS, STAT_RESET_FEE, SUBCLASS_RESPEC_FEE, type StatBlock } from "./progression";
import { CombatError, type CombatStore, type CosmeticKind, type MasteryRow, type OwnedWeapon, type ProgressRow } from "./store";
import { FIRST_WEAPONS, signatureGrant, signatureTier, STARTER_WEAPONS, wear as wearRule, WEAPONS } from "./weapons";
import { MASTERY_EQUIP, masteryForXp } from "./mastery";
import { traitFor } from "./kits";
import { nextToTame, TAME_ORDER } from "./wardenData";

export function memoryCombatStore(clock: () => Date = () => new Date()) {
  const prog = new Map<string, { xp: number; stats: StatBlock; subclass: string | null; loadout: string[]; traits: Record<string, number>; repick: "oracle" | "launch" | null }>();
  const settings = new Map<string, number>([["classes_v2", 0]]);
  const v2 = () => settings.get("classes_v2") === 1;
  const masteryRows = new Map<string, { xp: number; cosmetics: MasteryRow["cosmetics"] }>(); // `${m}:${subclass}`
  const shopOwned = new Map<string, { kind: CosmeticKind; subclass?: string }>(); // `${m}:${item}`: owned cosmetic items (member_inventory)
  const readings = new Map<string, { type: string; scores: { dichotomy: "EI" | "SN" | "TF" | "JP"; clarity: number }[] }>(); // member_identity.mbti_type + the latest scores
  const xpKeys = new Set<string>();
  const kills = new Map<string, number>(); // `${m}:${event}` → xp
  const killEnemy = new Map<string, string>(); // `${m}:${event}` → enemy key
  const killLog: { m: string; at: number; xp: number }[] = [];
  const weapons = new Map<string, OwnedWeapon[]>();
  const coins = new Map<string, number>();
  const ledger = new Set<string>();
  const families = new Map<string, Family>();
  const missions = new Map<string, ProgressRow & { m: string; key: string }>();
  const wearKeys = new Set<string>();
  const respecKeys = new Map<string, number>(); // stat resets: key → fee
  const subclassKeys = new Map<string, { subclass: string; fee: number }>(); // as combat_respec_log: a replay answers with the first result
  const materials = new Map<string, number>(); // `${m}:${item}` → count (member_collections)
  const bossRewards = new Map<string, { reward: BossReward; at: number }>(); // `${m}:${event}`
  const minibossRewards = new Map<string, { enemy: string; reward: BossReward; at: number }>(); // `${m}:${event}`
  const tamedBy = new Map<string, Set<string>>(); // member_tamed_beasts
  const tameKeys = new Set<string>(); // `${m}:${key}`
  const tamedOf = (m: string) => TAME_ORDER.filter(b => tamedBy.get(m)?.has(b));
  const give = (m: string, items: Record<string, number>) => { for (const [k, n] of Object.entries(items)) materials.set(`${m}:${k}`, (materials.get(`${m}:${k}`) ?? 0) + n); };
  let seq = 0;
  const pay = (m: string, amount: number, key: string) => {
    if (ledger.has(`${m}:${key}`)) return;
    if ((coins.get(m) ?? 0) + amount < 0) throw new CombatError("insufficient");
    coins.set(m, (coins.get(m) ?? 0) + amount);
    ledger.add(`${m}:${key}`);
  };
  const ensure = (m: string) => {
    if (!prog.has(m)) {
      prog.set(m, { xp: 0, stats: { ...ZERO_STATS }, subclass: null, loadout: [], traits: {}, repick: null });
      weapons.set(m, FIRST_WEAPONS.map((k) => ({ weapon_key: k, durability: WEAPONS.find((w) => w.key === k)!.max_durability, equipped: k === "sword-driftwood" })));
    }
    return prog.get(m)!;
  };
  const store: CombatStore = {
    async progression(m) {
      const p = ensure(m);
      return { xp: p.xp, level: levelForXp(p.xp), stats: { ...p.stats }, subclass: p.subclass, loadout: [...p.loadout], traits: { ...p.traits }, repick_source: p.repick };
    },
    async family(m) {
      return families.get(m) ?? null;
    },
    async grantXp(m, amount, source, _r, key) {
      const p = ensure(m);
      const before = levelForXp(p.xp);
      if (xpKeys.has(`${m}:${key}`)) return { xp: p.xp, level: before, levelled_up: false, replayed: true };
      xpKeys.add(`${m}:${key}`);
      if ((source === "kill" || source === "mission") && v2() && p.subclass) { // ruins XP trains the active subclass (classes_v2)
        const row = masteryRows.get(`${m}:${p.subclass}`) ?? { xp: 0, cosmetics: {} };
        masteryRows.set(`${m}:${p.subclass}`, { ...row, xp: row.xp + amount });
      }
      p.xp += amount;
      return { xp: p.xp, level: levelForXp(p.xp), levelled_up: levelForXp(p.xp) > before, replayed: false };
    },
    async recordKill(m, enemy, ev) {
      if (kills.has(`${m}:${ev}`)) return store.grantXp(m, 1, "kill", enemy, `kill:${ev}`);
      const e = ENEMIES.find((x) => x.key === enemy);
      if (!e) throw new CombatError("unknown_enemy");
      const hour = killLog.filter((k) => k.m === m && k.at > clock().getTime() - 3_600_000).reduce((n, k) => n + k.xp, 0);
      if (hour + e.xp > KILL_XP_PER_HOUR_CAP) throw new CombatError("kill_xp_cap");
      kills.set(`${m}:${ev}`, e.xp);
      killEnemy.set(`${m}:${ev}`, enemy);
      const p = ensure(m), t = traitFor(enemy); // row 40: a Transmuter's defeats teach and train traits
      if (t && p.subclass === "transmuter") p.traits[t.key] = (p.traits[t.key] ?? 0) + 1;
      killLog.push({ m, at: clock().getTime(), xp: e.xp });
      return store.grantXp(m, e.xp, "kill", enemy, `kill:${ev}`);
    },
    async allocate(m, stats) {
      const p = ensure(m);
      if (STATS.some((k) => stats[k] < p.stats[k])) throw new CombatError("needs_reset");
      if (pointsSpent(stats) > pointsEarned(levelForXp(p.xp))) throw new CombatError("not_enough_points");
      p.stats = { ...stats };
      return { ...p.stats };
    },
    async resetStats(m, key) {
      const p = ensure(m);
      if (respecKeys.has(`${m}:stat:${key}`)) return { fee: respecKeys.get(`${m}:stat:${key}`)!, replayed: true };
      pay(m, -STAT_RESET_FEE, `stat_reset:${key}`);
      respecKeys.set(`${m}:stat:${key}`, STAT_RESET_FEE);
      p.stats = { ...ZERO_STATS };
      return { fee: STAT_RESET_FEE, replayed: false };
    },
    async chooseSubclass(m, subclass, family, key) {
      const p = ensure(m);
      const first = subclassKeys.get(`${m}:${key}`);
      if (first) return { ...first, replayed: true };
      if (p.subclass === subclass) return { subclass, fee: 0, replayed: true };
      if (levelForXp(p.xp) < 10) throw new CombatError("level_too_low");
      const own = families.get(m);
      if (!own) throw new CombatError("no_family");
      if (own !== family) throw new CombatError("wrong_family");
      const list = weapons.get(m)!;
      const give = (k: string) => { if (!list.some((w) => w.weapon_key === k)) list.push({ weapon_key: k, durability: WEAPONS.find((w) => w.key === k)!.max_durability, equipped: false }); };
      if (v2()) { // §1.11: locked after the first choice; a change spends the repick token, no fee; the signature weapon at the best signature tier owned
        if (p.subclass && !p.repick) throw new CombatError("locked");
        if (!masteryRows.has(`${m}:${subclass}`)) masteryRows.set(`${m}:${subclass}`, { xp: 0, cosmetics: {} });
        const grant = signatureGrant(subclass, signatureTier(list.map((w) => w.weapon_key)));
        if (grant) give(grant.key);
        if (p.subclass) p.repick = null;
        subclassKeys.set(`${m}:${key}`, { subclass, fee: 0 });
        p.subclass = subclass;
        return { subclass, fee: 0, replayed: false };
      }
      const fee = p.subclass ? SUBCLASS_RESPEC_FEE : 0;
      if (fee) pay(m, -fee, `subclass:${key}`);
      subclassKeys.set(`${m}:${key}`, { subclass, fee });
      p.subclass = subclass;
      for (const k of STARTER_WEAPONS) give(k); // the gate opens: one starter per archetype
      return { subclass, fee, replayed: false };
    },
    async setLoadout(m, loadout) {
      const p = ensure(m);
      p.loadout = [...loadout];
      return [...p.loadout];
    },
    async weapons(m) {
      ensure(m);
      return weapons.get(m)!.map((w) => ({ ...w }));
    },
    async equip(m, k) {
      const list = weapons.get(m) ?? [];
      if (!list.some((w) => w.weapon_key === k)) throw new CombatError("not_owned");
      for (const w of list) w.equipped = w.weapon_key === k;
    },
    async wear(m, k, hits, defeated, key) {
      const w = (weapons.get(m) ?? []).find((x) => x.weapon_key === k);
      if (!w) throw new CombatError("not_owned");
      if (wearKeys.has(`${m}:${key}`)) return { durability: w.durability, replayed: true };
      if (hits < 0 || hits > 500) throw new CombatError("bad_hits");
      wearKeys.add(`${m}:${key}`);
      w.durability = wearRule(WEAPONS.find((x) => x.key === k)!, w.durability, hits, defeated);
      return { durability: w.durability, replayed: false };
    },
    async repair(m, k, key) {
      const w = (weapons.get(m) ?? []).find((x) => x.weapon_key === k);
      if (!w) throw new CombatError("not_owned");
      const def = WEAPONS.find((x) => x.key === k)!;
      if (ledger.has(`${m}:repair:${key}`)) return { durability: w.durability, cost: 0, replayed: true };
      const cost = (def.max_durability - w.durability) * def.repair_per_point;
      if (cost > 0) pay(m, -cost, `repair:${key}`);
      else ledger.add(`${m}:repair:${key}`);
      w.durability = def.max_durability;
      return { durability: w.durability, cost, replayed: false };
    },
    async missionRows(m) {
      return [...missions.values()].filter((r) => r.m === m).map(({ m: _m, key: _k, ...r }) => (void _m, void _k, { ...r, progress: { ...r.progress, seen: [...r.progress.seen] } }));
    },
    async startMission(m, mk, startKey) {
      const def = MISSIONS.find((x) => x.key === mk);
      if (!def) throw new CombatError("unknown_mission");
      ensure(m);
      for (const r of missions.values()) if (r.m === m && (r.key === startKey || (r.mission_key === mk && (r.state === "active" || r.state === "ready")))) return { progress_id: r.id, resumed: true };
      const last = [...missions.values()].filter((r) => r.m === m && r.mission_key === mk && r.completed_at).map((r) => Date.parse(r.completed_at!)).sort().pop();
      if (last && clock().getTime() - last < def.cooldown_hours * 3_600_000) throw new CombatError("cooldown");
      const id = `00000000-0000-4000-8000-00000000c${String(++seq).padStart(3, "0")}`;
      missions.set(id, { id, m, key: startKey, mission_key: mk, state: "active", progress: initialProgress(), started_at: clock().toISOString(), completed_at: null });
      return { progress_id: id, resumed: false };
    },
    async saveMission(m, id, state: MissionState, progress: MissionProgress) {
      const r = missions.get(id);
      if (!r || r.m !== m || !(r.state === "active" || r.state === "ready")) return false;
      r.state = state;
      r.progress = progress;
      return true;
    },
    async completeMission(m, id) {
      const r = missions.get(id);
      if (!r || r.m !== m) throw new CombatError("not_found");
      const def = MISSIONS.find((x) => x.key === r.mission_key)!;
      if (r.state === "completed") return { xp_awarded: def.rewards.xp, coins_awarded: def.rewards.coins, materials_awarded: def.rewards.materials, replayed: true };
      if (r.state !== "ready") throw new CombatError("not_ready");
      r.state = "completed";
      r.completed_at = clock().toISOString();
      await store.grantXp(m, def.rewards.xp, "mission", def.key, `mission:${id}`);
      pay(m, def.rewards.coins, `mission:${id}`);
      give(m, def.rewards.materials);
      return { xp_awarded: def.rewards.xp, coins_awarded: def.rewards.coins, materials_awarded: def.rewards.materials, replayed: false };
    },
    async oracleReading(m) {
      return readings.get(m) ?? null;
    },
    async setting(k) {
      return settings.get(k) ?? null;
    },
    async mastery(m) {
      return [...masteryRows.entries()].filter(([k]) => k.startsWith(`${m}:`)).map(([k, r]) => ({ subclass: k.slice(m.length + 1), xp: r.xp, mastery: masteryForXp(r.xp), cosmetics: { ...r.cosmetics } }));
    },
    async equipCosmetic(m, subclass, kind, value) {
      const row = masteryRows.get(`${m}:${subclass}`);
      if (!row) throw new CombatError("not_found");
      if (value !== null) {
        const mastery = MASTERY_EQUIP[value], owned = shopOwned.get(`${m}:${value}`);
        if (value.startsWith("mastery:")) {
          if (!mastery || mastery.kind !== kind) throw new CombatError("bad_cosmetic");
          if (masteryForXp(row.xp) < mastery.at) throw new CombatError("locked");
        } else if (!owned) throw new CombatError("not_owned");
        else if (owned.kind !== kind || (kind === "weapon_skin" && owned.subclass !== subclass)) throw new CombatError("bad_cosmetic");
      }
      const cosmetics = { ...row.cosmetics };
      if (value === null) delete cosmetics[kind]; else cosmetics[kind] = value;
      row.cosmetics = cosmetics;
      return { ...cosmetics };
    },
    async bossReward(m, ev, reward) {
      const done = bossRewards.get(`${m}:${ev}`);
      if (done) return { reward: done.reward, replayed: true };
      if (!kills.has(`${m}:${ev}`) || killEnemy.get(`${m}:${ev}`) !== BOSS_DROPS.enemy) throw new CombatError("not_found");
      const last = Math.max(0, ...[...bossRewards.entries()].filter(([k]) => k.startsWith(`${m}:`)).map(([, v]) => v.at));
      if (last && clock().getTime() - last < BOSS_DROPS.cooldown_hours * 3_600_000) throw new CombatError("boss_cooldown");
      bossRewards.set(`${m}:${ev}`, { reward, at: clock().getTime() });
      pay(m, reward.coins, `boss:${ev}`);
      give(m, reward.materials);
      const list = weapons.get(m)!;
      if (reward.weapon && !list.some((w) => w.weapon_key === reward.weapon)) list.push({ weapon_key: reward.weapon, durability: WEAPONS.find((w) => w.key === reward.weapon)!.max_durability, equipped: false });
      return { reward, replayed: false };
    },
    async minibossReward(m, enemy, ev, reward) {
      const done = minibossRewards.get(`${m}:${ev}`);
      if (done) return { reward: done.reward, replayed: true };
      if (!kills.has(`${m}:${ev}`) || killEnemy.get(`${m}:${ev}`) !== enemy || ENEMIES.find((e) => e.key === enemy)?.kind !== "elite") throw new CombatError("not_found");
      const last = Math.max(0, ...[...minibossRewards.entries()].filter(([k, v]) => k.startsWith(`${m}:`) && v.enemy === enemy).map(([, v]) => v.at));
      if (last && clock().getTime() - last < (MINIBOSS_DROPS[enemy]?.cooldown_hours ?? 20) * 3_600_000) throw new CombatError("miniboss_cooldown");
      minibossRewards.set(`${m}:${ev}`, { enemy, reward, at: clock().getTime() });
      pay(m, reward.coins, `miniboss:${ev}`);
      give(m, reward.materials);
      const list = weapons.get(m)!;
      if (reward.weapon && !list.some((w) => w.weapon_key === reward.weapon)) list.push({ weapon_key: reward.weapon, durability: WEAPONS.find((w) => w.key === reward.weapon)!.max_durability, equipped: false });
      return { reward, replayed: false };
    },
    async tamed(m) {
      return tamedOf(m);
    },
    async tameBeast(m, beast, key) {
      if (tameKeys.has(`${m}:${key}`)) return { tamed: tamedOf(m), replayed: true };
      if (!v2()) throw new CombatError("unavailable");
      if (ensure(m).subclass !== "summoner") throw new CombatError("bad_beast");
      const have = tamedBy.get(m) ?? new Set<string>();
      if (have.has(beast)) return { tamed: tamedOf(m), replayed: true };
      if (nextToTame([...have]) !== beast) throw new CombatError("bad_beast");
      have.add(beast); tamedBy.set(m, have); tameKeys.add(`${m}:${key}`);
      return { tamed: tamedOf(m), replayed: false };
    },
  };
  return { store, setFamily: (m: string, f: Family | null) => (f ? families.set(m, f) : families.delete(m)), fund: (m: string, n: number) => coins.set(m, n), coinsOf: (m: string) => coins.get(m) ?? 0, materialOf: (m: string, item: string) => materials.get(`${m}:${item}`) ?? 0,
    /** economy_settings (classes_v2: 1 on). */
    setSetting: (k: string, v: number) => settings.set(k, v),
    /** A completed paid Oracle reading (oracle_complete) or the launch gift: one repick for a member with a subclass. */
    grantRepick: (m: string, source: "oracle" | "launch") => { const p = ensure(m); if (p.subclass) p.repick = source; },
    /** A cosmetic bought in the shop (member_inventory). */
    own: (m: string, item: string, kind: CosmeticKind, subclass?: string) => shopOwned.set(`${m}:${item}`, { kind, subclass }),
    /** The member's Oracle reading (type and clarities). */
    setReading: (m: string, type: string, scores: { dichotomy: "EI" | "SN" | "TF" | "JP"; clarity: number }[] = []) => readings.set(m, { type, scores }),
    /** A weapon handed over (the dev kit's signature type before any wave seeds signature rows). */
    giveWeapon: (m: string, key: string) => { const list = weapons.get(m) ?? []; if (!list.some((w) => w.weapon_key === key)) list.push({ weapon_key: key, durability: WEAPONS.find((w) => w.key === key)!.max_durability, equipped: false }); },
    /** Beasts already tamed (the Summoner's demo: `?tamed=owl,toad`). */
    setTamed: (m: string, beasts: string[]) => tamedBy.set(m, new Set(beasts.filter(b => (TAME_ORDER as readonly string[]).includes(b)))),
    /** Mastery XP straight onto a row (evidence and tests). */
    setMasteryXp: (m: string, subclass: string, xp: number) => masteryRows.set(`${m}:${subclass}`, { cosmetics: {}, ...masteryRows.get(`${m}:${subclass}`), xp }) };
}
