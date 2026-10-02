/** In-memory CollectionsStore mirroring the 031, 036, catch-roll, seasonal-land and recipe-drop SQL functions (tests, dev harness). */
import { FISH } from "@/lib/game/fishing";
import { clampSize, trophyFor, weekStart, type Donation, type MemberItem, type WeeklyBest } from "./logic";
import { CAST_GAP_MS, MIN_REEL_MS, ROLL_TTL_MS } from "./rolls";
import { ROSTER } from "./roster";
import { CollectionsError, type CollectionsStore, type LearnedRecipe } from "./store";
import type { TourneyEntry } from "@/lib/progression/seasonal";

/** collections_record_catch's hourly caps: per species by rarity, and 200 per member. */
const CAP: Record<string, number> = { legendary: 3, seaking: 3, epic: 6, rare: 12, uncommon: 30 };

/** `drop`: crafting_catch_drop (memoryCraftingStore's catchDrop); without it catches teach nothing. */
export function memoryCollectionsStore(now: () => Date = () => new Date("2026-09-24T16:00:00Z"), drop: (member: string, itemKey: string) => LearnedRecipe | null = () => null) {
  const items = new Map<string, MemberItem>(); // `${member}:${key}`
  const donations: (Donation & { key: string })[] = [];
  const bests = new Map<string, WeeklyBest & { week: string }>();
  const names = new Map<string, string>();
  const showcases = new Map<string, (string | null)[]>();
  const entries = new Map<string, TourneyEntry & { goal: string }>(); // `${goal}:${cycle}:${member}:${category}`
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
  /** tourney_entries: each member's biggest catch per category per tourney cycle. */
  const enter = (goalId: string, cycle: number, m: string, key: string, size: number | null) => {
    const category = ROSTER.find((s) => s.key === key)?.category;
    if (size === null || (category !== "fish" && category !== "sea")) return;
    const ek = `${goalId}:${cycle}:${m}:${category}`;
    if (size > (entries.get(ek)?.size_cm ?? 0)) entries.set(ek, { goal: `${goalId}:${cycle}`, member_id: m, member_name: "", category, item_key: key, size_cm: size, caught_at: now().toISOString() });
  };
  /** collections_record_catch: count+1, lifetime total+1, personal best size, this week's best; capped per species and member per hour. */
  const recordCatch = (m: string, key: string, size: number | null, trophy: boolean) => {
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
    async eat(m, key) {
      const row = items.get(`${m}:${key}`);
      if (!row || row.count < 1) throw new CollectionsError("none_left");
      row.count -= 1;
      return { count: row.count };
    },
    async weeklyBests(week) {
      return [...bests.values()].filter((b) => b.week === week).map(({ week: _w, ...b }) => (void _w, { ...b, member_name: names.get(b.user_id) ?? "Member" }));
    },
    async cast(m, key, size, trophy) {
      const at = now().getTime();
      if ([...rolls.values()].some((r) => r.member === m && at - r.at < CAST_GAP_MS)) throw new CollectionsError("too_fast");
      const id = crypto.randomUUID();
      rolls.set(id, { member: m, key, size, trophy, at, landed: false });
      return id;
    },
    async land(m, id, seasonal) {
      const r = rolls.get(id);
      if (!r || r.member !== m) throw new CollectionsError("no_roll");
      if (r.landed) throw new CollectionsError("already_landed");
      const t = now().getTime();
      if (t - r.at > ROLL_TTL_MS || [...rolls.values()].some((o) => o.member === m && o.at > r.at)) throw new CollectionsError("roll_expired");
      if (t - r.at < MIN_REEL_MS) throw new CollectionsError("too_fast");
      // seasonal_land (20260929120000): a limited-time catch outside its event lands nothing.
      if (seasonal?.closed.includes(r.key)) throw new CollectionsError("out_of_season");
      const res = recordCatch(m, r.key, r.size, r.trophy);
      r.landed = true;
      if (seasonal?.tourney) enter(seasonal.tourney.goal_id, seasonal.tourney.cycle, m, r.key, r.size);
      return { item_key: r.key, size_cm: r.size, ...res, recipe: drop(m, r.key) };
    },
    async harvest(m, node, hourKey, key, size, trophy) {
      if (harvests.has(`${m}:${node}:${hourKey}`)) throw new CollectionsError("already_harvested");
      const res = recordCatch(m, key, size, trophy);
      harvests.add(`${m}:${node}:${hourKey}`);
      return { ...res, recipe: drop(m, key) };
    },
    async ownedGear(m) {
      return gear.get(m) ?? [];
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
  return {
    store, name: (id: string, n: string) => names.set(id, n),
    /** A catch recorded directly (tests, the dev demo): the species' size clamp and trophy rule, then the capped record. */
    record: (m: string, key: string, sizeCm: number | null) => {
      const sp = ROSTER.find((s) => s.key === key), size = clampSize(sp, sizeCm);
      return { item_key: key, ...recordCatch(m, key, size, trophyFor(sp, size)) };
    },
    countOf: (m: string, k: string) => items.get(`${m}:${k}`)?.count ?? 0,
    own: (m: string, refs: string[]) => gear.set(m, refs),
    /** Demo fixture: a tourney entry as seasonal_land would leave it. */
    enter,
  };
}
