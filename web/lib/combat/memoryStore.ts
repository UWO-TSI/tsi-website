/** In-memory CombatStore mirroring 035_combat.sql (tests, dev harness). */
import type { Family } from "@/lib/oracle/engine";
import { ENEMIES, MISSIONS } from "./content";
import { initialProgress, type MissionProgress, type MissionState } from "./missions";
import { levelForXp, pointsEarned, pointsSpent, STATS, ZERO_STATS, STAT_RESET_FEE, SUBCLASS_RESPEC_FEE, type StatBlock } from "./progression";
import { CombatError, type CombatStore, type OwnedWeapon, type ProgressRow } from "./store";
import { wear as wearRule, WEAPONS } from "./weapons";

export function memoryCombatStore(clock: () => Date = () => new Date()) {
  const prog = new Map<string, { xp: number; stats: StatBlock; subclass: string | null }>();
  const xpKeys = new Set<string>();
  const kills = new Map<string, number>(); // `${m}:${event}` → xp
  const killLog: { m: string; at: number; xp: number }[] = [];
  const weapons = new Map<string, OwnedWeapon[]>();
  const coins = new Map<string, number>();
  const ledger = new Set<string>();
  const families = new Map<string, Family>();
  const missions = new Map<string, ProgressRow & { m: string; key: string }>();
  const wearKeys = new Set<string>();
  const respecKeys = new Map<string, number>();
  let seq = 0;
  const pay = (m: string, amount: number, key: string) => {
    if (ledger.has(`${m}:${key}`)) return;
    if ((coins.get(m) ?? 0) + amount < 0) throw new CombatError("insufficient");
    coins.set(m, (coins.get(m) ?? 0) + amount);
    ledger.add(`${m}:${key}`);
  };
  const ensure = (m: string) => {
    if (!prog.has(m)) {
      prog.set(m, { xp: 0, stats: { ...ZERO_STATS }, subclass: null });
      weapons.set(m, ["sword-driftwood", "wraps-cloth"].map((k) => ({ weapon_key: k, durability: WEAPONS.find((w) => w.key === k)!.max_durability, equipped: k === "sword-driftwood" })));
    }
    return prog.get(m)!;
  };
  const store: CombatStore = {
    async progression(m) {
      const p = ensure(m);
      return { xp: p.xp, level: levelForXp(p.xp), stats: { ...p.stats }, subclass: p.subclass };
    },
    async family(m) {
      return families.get(m) ?? null;
    },
    async grantXp(m, amount, _s, _r, key) {
      const p = ensure(m);
      const before = levelForXp(p.xp);
      if (xpKeys.has(`${m}:${key}`)) return { xp: p.xp, level: before, levelled_up: false, replayed: true };
      xpKeys.add(`${m}:${key}`);
      p.xp += amount;
      return { xp: p.xp, level: levelForXp(p.xp), levelled_up: levelForXp(p.xp) > before, replayed: false };
    },
    async recordKill(m, enemy, ev) {
      if (kills.has(`${m}:${ev}`)) return store.grantXp(m, 1, "kill", enemy, `kill:${ev}`);
      const e = ENEMIES.find((x) => x.key === enemy);
      if (!e) throw new CombatError("unknown_enemy");
      const hour = killLog.filter((k) => k.m === m && k.at > clock().getTime() - 3_600_000).reduce((n, k) => n + k.xp, 0);
      if (hour + e.xp > 6000) throw new CombatError("kill_xp_cap");
      kills.set(`${m}:${ev}`, e.xp);
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
      if (p.subclass === subclass) return { subclass, fee: 0, replayed: true };
      if (levelForXp(p.xp) < 10) throw new CombatError("level_too_low");
      const own = families.get(m);
      if (!own) throw new CombatError("no_family");
      if (own !== family) throw new CombatError("wrong_family");
      const fee = p.subclass ? SUBCLASS_RESPEC_FEE : 0;
      if (fee) pay(m, -fee, `subclass:${key}`);
      p.subclass = subclass;
      return { subclass, fee, replayed: false };
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
      if (r.state === "completed") return { xp_awarded: def.rewards.xp, coins_awarded: def.rewards.coins, replayed: true };
      if (r.state !== "ready") throw new CombatError("not_ready");
      r.state = "completed";
      r.completed_at = clock().toISOString();
      await store.grantXp(m, def.rewards.xp, "mission", def.key, `mission:${id}`);
      pay(m, def.rewards.coins, `mission:${id}`);
      return { xp_awarded: def.rewards.xp, coins_awarded: def.rewards.coins, replayed: false };
    },
  };
  return { store, setFamily: (m: string, f: Family) => families.set(m, f), fund: (m: string, n: number) => coins.set(m, n), coinsOf: (m: string) => coins.get(m) ?? 0 };
}
