/** In-memory CollectionsStore mirroring the 031, 036 and catch-roll SQL functions (tests, dev harness). */
import { FISH } from "@/lib/game/fishing";
import { weekStart, type Donation, type MemberItem, type WeeklyBest } from "./logic";
import { CAST_GAP_MS, MIN_REEL_MS, ROLL_TTL_MS } from "./rolls";
import { ROSTER } from "./roster";
import { CollectionsError, type CollectionsStore } from "./store";

/** collections_record_catch's hourly caps: per species by rarity, and 200 per member. */
const CAP: Record<string, number> = { legendary: 3, seaking: 3, epic: 6, rare: 12, uncommon: 30 };

export function memoryCollectionsStore(now: () => Date = () => new Date("2026-09-24T16:00:00Z")) {
  const items = new Map<string, MemberItem>(); // `${member}:${key}`
  const donations: (Donation & { key: string })[] = [];
  const bests = new Map<string, WeeklyBest & { week: string }>();
  const names = new Map<string, string>();
  const showcases = new Map<string, (string | null)[]>();
  const hourly = new Map<string, number>(); // `${member}:${hour}:${key}`
  const rolls = new Map<string, { member: string; key: string; size: number | null; trophy: boolean; at: number; landed: boolean }>();
  const harvests = new Set<string>(); // `${member}:${node}:${hourKey}`
  const gear = new Map<string, string[]>();
  const capped = (m: string, key: string) => {
    const hour = Math.floor(now().getTime() / 3_600_000);
    const rarity = ROSTER.find((s) => s.key === key)?.rarity ?? FISH.find((f) => f.key === key)?.rarity ?? "common";
    const mine = [...hourly.entries()].filter(([k]) => k.startsWith(`${m}:${hour}:`));
    const n = hourly.get(`${m}:${hour}:${key}`) ?? 0;
    if (n >= (CAP[rarity] ?? 60) || mine.reduce((s, [, c]) => s + c, 0) >= 200) throw new CollectionsError("rate_limited");
    hourly.set(`${m}:${hour}:${key}`, n + 1);
  };
  const store: CollectionsStore = {
    async roster() {
      return ROSTER;
    },
    async memberItems(m) {
      return [...items.entries()].filter(([k]) => k.startsWith(`${m}:`)).map(([, v]) => ({ ...v }));
    },
    async donations() {
      return donations.map(({ key: _k, ...d }) => (void _k, { ...d, donor_name: d.donor_id ? (names.get(d.donor_id) ?? null) : null }));
    },
    async findDonation(m, key) {
      const d = donations.find((x) => x.donor_id === m && x.key === key);
      return d ? { ...d } : null;
    },
    async donate(m, sk, key, size) {
      if (donations.some((x) => x.donor_id === m && x.key === key)) return { replayed: true };
      const sp = ROSTER.find((s) => s.key === sk);
      if (!sp?.donatable) throw new CollectionsError("not_donatable");
      if (donations.some((x) => x.species_key === sk)) throw new CollectionsError("already_donated");
      const row = items.get(`${m}:${sk}`);
      if (!row || row.count < 1) throw new CollectionsError("not_owned");
      row.count -= 1;
      donations.push({ species_key: sk, donor_id: m, donor_name: null, donated_at: now().toISOString(), size_cm: size, key });
      return { replayed: false };
    },
    async weeklyBests(week) {
      return [...bests.values()].filter((b) => b.week === week).map(({ week: _w, ...b }) => (void _w, { ...b, member_name: names.get(b.user_id) ?? "Member" }));
    },
    async recordCatch(m, key, size, trophy) {
      capped(m, key);
      const k = `${m}:${key}`;
      const row = items.get(k) ?? { item_key: key, count: 0, total_collected: 0, best_size_cm: null, first_collected_at: now().toISOString() };
      const newRecord = size !== null && (row.best_size_cm === null || size > row.best_size_cm);
      row.count += 1;
      row.total_collected += 1;
      if (newRecord) row.best_size_cm = size;
      items.set(k, row);
      if (trophy && size !== null) {
        const week = weekStart(now());
        const bk = `${week}:${m}:${key}`;
        const cur = bests.get(bk);
        if (!cur || size > cur.size_cm) bests.set(bk, { week, user_id: m, member_name: "", item_key: key, size_cm: size, caught_at: now().toISOString() });
      }
      return { count: row.count, total_collected: row.total_collected, best_size_cm: row.best_size_cm, new_record: newRecord };
    },
    async cast(m, key, size, trophy) {
      const at = now().getTime();
      if ([...rolls.values()].some((r) => r.member === m && at - r.at < CAST_GAP_MS)) throw new CollectionsError("too_fast");
      const id = crypto.randomUUID();
      rolls.set(id, { member: m, key, size, trophy, at, landed: false });
      return id;
    },
    async land(m, id) {
      const r = rolls.get(id);
      if (!r || r.member !== m) throw new CollectionsError("no_roll");
      if (r.landed) throw new CollectionsError("already_landed");
      const t = now().getTime();
      if (t - r.at > ROLL_TTL_MS || [...rolls.values()].some((o) => o.member === m && o.at > r.at)) throw new CollectionsError("roll_expired");
      if (t - r.at < MIN_REEL_MS) throw new CollectionsError("too_fast");
      const res = await store.recordCatch(m, r.key, r.size, r.trophy);
      r.landed = true;
      return { item_key: r.key, size_cm: r.size, ...res };
    },
    async harvest(m, node, hourKey, key, size, trophy) {
      if (harvests.has(`${m}:${node}:${hourKey}`)) throw new CollectionsError("already_harvested");
      const res = await store.recordCatch(m, key, size, trophy);
      harvests.add(`${m}:${node}:${hourKey}`);
      return res;
    },
    async ownedGear(m) {
      return gear.get(m) ?? [];
    },
    async showcase(m) {
      return showcases.get(m) ?? [null, null, null];
    },
    async setShowcase(m, keys) {
      showcases.set(m, [...keys]);
    },
  };
  return {
    store, name: (id: string, n: string) => names.set(id, n), countOf: (m: string, k: string) => items.get(`${m}:${k}`)?.count ?? 0,
    own: (m: string, refs: string[]) => gear.set(m, refs),
  };
}
