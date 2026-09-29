/** In-memory CollectionsStore mirroring the 031 SQL functions (tests, dev harness). */
import { weekStart, type Donation, type MemberItem, type WeeklyBest } from "./logic";
import { ROSTER } from "./roster";
import { CollectionsError, type CollectionsStore } from "./store";
import type { TourneyEntry } from "@/lib/progression/seasonal";

export function memoryCollectionsStore(now: () => Date = () => new Date("2026-09-24T16:00:00Z")) {
  const items = new Map<string, MemberItem>(); // `${member}:${key}`
  const donations: (Donation & { key: string })[] = [];
  const bests = new Map<string, WeeklyBest & { week: string }>();
  const names = new Map<string, string>();
  const showcases = new Map<string, (string | null)[]>();
  const entries = new Map<string, TourneyEntry & { goal: string }>(); // `${goal}:${cycle}:${member}:${category}`
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
    async recordCatch(m, key, size, trophy, tourney) {
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
      const category = ROSTER.find((s) => s.key === key)?.category;
      if (tourney && size !== null && (category === "fish" || category === "sea")) {
        const ek = `${tourney.goal_id}:${tourney.cycle}:${m}:${category}`;
        if (size > (entries.get(ek)?.size_cm ?? 0)) entries.set(ek, { goal: `${tourney.goal_id}:${tourney.cycle}`, member_id: m, member_name: "", category, item_key: key, size_cm: size, caught_at: now().toISOString() });
      }
      return { count: row.count, total_collected: row.total_collected, best_size_cm: row.best_size_cm, new_record: newRecord };
    },
    async tourneyEntries(goalId, cycle) {
      return [...entries.values()].filter((e) => e.goal === `${goalId}:${cycle}`).map(({ goal: _g, ...e }) => (void _g, { ...e, member_name: names.get(e.member_id) ?? "Member" }));
    },
    async showcase(m) {
      return showcases.get(m) ?? [null, null, null];
    },
    async setShowcase(m, keys) {
      showcases.set(m, [...keys]);
    },
  };
  return { store, name: (id: string, n: string) => names.set(id, n), countOf: (m: string, k: string) => items.get(`${m}:${k}`)?.count ?? 0 };
}
