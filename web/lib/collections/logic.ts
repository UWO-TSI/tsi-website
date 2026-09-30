/**
 * Pure collection rules: availability + clues (row 66), journal pages
 * (row 203), museum wings (rows 67, 201, 202), weekly trophy case and
 * catch records (rows 196, 204).
 */
import { RARITY_RANK, WING_OF, type Biome, type Category, type Rarity, type Species, type Wing } from "./roster";
import { torontoParts } from "@/lib/time";

export interface WorldMoment {
  hour: number; // 0-24 local island time
  month: number; // 1-12
  weather: "clear" | "cloudy" | "rain" | "snow";
}

export interface MemberItem {
  item_key: string;
  count: number;
  total_collected: number;
  best_size_cm: number | null;
  first_collected_at: string;
}

export interface Donation {
  species_key: string;
  donor_id: string | null;
  donor_name: string | null;
  donated_at: string;
  size_cm: number | null;
}

// ── Availability ────────────────────────────────────────────────────────────

const inWindow = (h: number, [s, e]: [number, number]) => (s <= e ? h >= s && h < e : h >= s || h < e);

export function inSeason(sp: Pick<Species, "months">, month: number): boolean {
  return sp.months.length === 0 || sp.months.includes(month);
}

export function availableAt(sp: Species, m: WorldMoment): boolean {
  if (!inSeason(sp, m.month)) return false;
  if (sp.weather.length && !sp.weather.includes(m.weather)) return false;
  if (!sp.hours) return true;
  return inWindow(m.hour, sp.hours) || (sp.rainAnyHour && m.weather === "rain");
}

/** Not out now, but its window opens before midnight in the current weather and season. */
export function laterToday(sp: Species, m: WorldMoment): boolean {
  if (availableAt(sp, m) || !sp.hours || !inSeason(sp, m.month)) return false;
  if (sp.weather.length && !sp.weather.includes(m.weather)) return false;
  for (let h = Math.floor(m.hour) + 1; h < 24; h++) if (inWindow(h, sp.hours)) return true;
  return false;
}

// ── Clues (no names) ────────────────────────────────────────────────────────

const BIOME_LABEL: Record<Biome, string> = {
  river: "In the river", pond: "In the pond", cliff_pool: "In the cliff pools", sea: "Out at sea, off the pier",
  beach: "On the beach", flowers: "Around flowers", trees: "On or under trees", ground: "On the ground",
  water_edge: "Near water", bush: "On bushes", woods: "In the woods", rocks: "Struck from rocks",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

function monthsLabel(months: number[]): string {
  if (!months.length) return "all year";
  const sorted = [...months].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const m of sorted) {
    const last = runs[runs.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else runs.push([m, m]);
  }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1][1] === 12) {
    const first = runs.shift()!;
    runs[runs.length - 1][1] = first[1];
  }
  return runs.map(([a, b]) => (a === b ? MONTHS[a - 1] : `${MONTHS[a - 1]}–${MONTHS[b - 1]}`)).join(", ");
}

/** Habitat · time · weather · season. Never includes the species name or key. */
export function clueFor(sp: Species): string {
  const time = sp.hours ? `${hh(sp.hours[0])}–${hh(sp.hours[1])}${sp.rainAnyHour ? " (any hour in rain)" : ""}` : "any time";
  const weather = sp.weather.length ? `only in ${sp.weather.join(" or ")}` : "any weather";
  const size = sp.size && sp.size[1] >= 100 ? " · a big shadow" : sp.size && sp.size[1] <= 6 ? " · a tiny shadow" : "";
  return `${BIOME_LABEL[sp.biome]} · ${time} · ${weather} · ${monthsLabel(sp.months)}${size}`;
}

// ── Journal pages ───────────────────────────────────────────────────────────

export interface JournalEntryKnown {
  slot: number;
  discovered: true;
  key: string;
  name: string;
  icon: string | null;
  rarity: Rarity;
  one_liner: string;
  count: number;
  total_collected: number;
  best_size_cm: number | null;
  size_range: [number, number] | null;
  first_collected_at: string;
  clue: string;
  available_now: boolean;
  later_today: boolean;
  donatable: boolean;
  museum: { donated: boolean; donor_name: string | null; by_me: boolean };
}
export interface JournalEntryUnknown {
  slot: number;
  discovered: false;
  silhouette: string;
  clue: string;
  available_now: boolean;
  later_today: boolean;
}
export interface JournalPage {
  category: Category;
  total: number;
  discovered: number;
  entries: (JournalEntryKnown | JournalEntryUnknown)[];
}

export function speciesInCategory(roster: Species[], category: Category): Species[] {
  return roster.filter((s) => s.category === category).sort((a, b) => a.position - b.position);
}

export function journalPage(roster: Species[], category: Category, mine: MemberItem[], donations: Donation[], memberId: string, m: WorldMoment): JournalPage {
  const owned = new Map(mine.map((r) => [r.item_key, r]));
  const donated = new Map(donations.map((d) => [d.species_key, d]));
  const list = speciesInCategory(roster, category);
  const entries = list.map((sp, i): JournalEntryKnown | JournalEntryUnknown => {
    const row = owned.get(sp.key);
    const base = { slot: i + 1, clue: clueFor(sp), available_now: availableAt(sp, m), later_today: laterToday(sp, m) };
    if (!row) return { ...base, discovered: false, silhouette: `/api/collections/silhouette/${category}/${i + 1}` };
    const d = donated.get(sp.key);
    return {
      ...base, discovered: true, key: sp.key, name: sp.name, icon: sp.icon, rarity: sp.rarity, one_liner: sp.oneLiner,
      count: row.count, total_collected: row.total_collected, best_size_cm: row.best_size_cm, size_range: sp.size,
      first_collected_at: row.first_collected_at, donatable: sp.donatable,
      museum: { donated: !!d, donor_name: d ? (d.donor_name ?? "A former member") : null, by_me: !!d && d.donor_id === memberId },
    };
  });
  return { category, total: list.length, discovered: entries.filter((e) => e.discovered).length, entries };
}

// ── Museum ──────────────────────────────────────────────────────────────────

export interface Exhibit {
  slot: number;
  category: Category;
  donated: boolean;
  key: string | null;
  name: string | null;
  icon: string | null;
  donor_name: string | null;
  donated_at: string | null;
}
export interface MuseumWing {
  wing: Wing;
  total: number;
  donated: number;
  exhibits: Exhibit[];
}

/** Empty cases never name their species (row 66 disclosure rule). */
export function museumWings(roster: Species[], donations: Donation[]): MuseumWing[] {
  const donated = new Map(donations.map((d) => [d.species_key, d]));
  const wings: Wing[] = ["aquarium", "insect_hall", "nature_room"];
  return wings.map((wing) => {
    const species = roster.filter((s) => s.donatable && WING_OF[s.category] === wing).sort((a, b) => a.position - b.position);
    const exhibits = species.map((sp, i): Exhibit => {
      const d = donated.get(sp.key);
      return d
        ? { slot: i + 1, category: sp.category, donated: true, key: sp.key, name: sp.name, icon: sp.icon, donor_name: d.donor_name ?? "A former member", donated_at: d.donated_at }
        : { slot: i + 1, category: sp.category, donated: false, key: null, name: null, icon: null, donor_name: null, donated_at: null };
    });
    return { wing, total: exhibits.length, donated: exhibits.filter((e) => e.donated).length, exhibits };
  });
}

export type DonationCheck = { ok: true } | { ok: false; status: number; code: string; error: string };

/** Row 202: first donation displays with the donor's name; duplicates refused. */
export function checkDonation(sp: Species | undefined, existing: Donation | undefined, mine: MemberItem | undefined, memberId: string): DonationCheck {
  if (!sp) return { ok: false, status: 404, code: "unknown_species", error: "The museum doesn't know that one." };
  if (!sp.donatable) return { ok: false, status: 422, code: "not_donatable", error: "The museum doesn't collect that." };
  if (existing) {
    const who = existing.donor_id === memberId ? "you" : (existing.donor_name ?? "a former member");
    return { ok: false, status: 409, code: "already_donated", error: `Already on display, donated by ${who}. You could sell yours instead.` };
  }
  if (!mine || mine.count < 1) return { ok: false, status: 409, code: "not_owned", error: "You need one in your pockets to donate it." };
  return { ok: true };
}

// ── Catch records and trophies ──────────────────────────────────────────────

/** Clamp a client-reported size into the species' range (null for sizeless items). */
export function clampSize(sp: Species | undefined, size: number | null | undefined): number | null {
  if (!sp?.size || typeof size !== "number" || !Number.isFinite(size)) return null;
  return Math.round(Math.min(sp.size[1], Math.max(sp.size[0], size)) * 10) / 10;
}

/** A sized fish or sea catch counts for the weekly trophies. */
export const trophyFor = (sp: { category: string } | undefined, size: number | null) => !!sp && (sp.category === "fish" || sp.category === "sea") && size !== null;

/** Island clock for availability: Toronto hour/month unless the client passes its own. */
export function momentFrom(url: URL, now: Date) {
  const t = torontoParts(now);
  const hourParam = Number(url.searchParams.get("hour"));
  const hour = url.searchParams.has("hour") && hourParam >= 0 && hourParam < 24 ? hourParam : t.hour;
  const w = url.searchParams.get("weather");
  const weather = w === "rain" || w === "snow" || w === "cloudy" ? w : "clear";
  return { hour, month: t.month, weather } as const;
}

/** Monday 00:00 in America/Toronto, as YYYY-MM-DD (matches 031's SQL). */
export function weekStart(now: Date): string {
  const t = torontoParts(now);
  return new Date(Date.UTC(t.year, t.month - 1, t.day - t.weekday)).toISOString().slice(0, 10);
}

export interface WeeklyBest {
  user_id: string;
  member_name: string;
  item_key: string;
  size_cm: number;
  caught_at: string;
}
export interface Trophy {
  rank: number;
  key: string;
  name: string;
  icon: string | null;
  rarity: Rarity;
  size_cm: number;
  size_ratio: number;
  member_id: string;
  member_name: string;
  caught_at: string;
}

export const TROPHY_SLOTS = 6;
export const TROPHIES_PER_MEMBER = 2;

/**
 * HQ trophy case: the single biggest catch per species this week, ranked by
 * rarity, then how close to the species maximum it was, then who caught it
 * first. At most two cases per member so the wall shows the club.
 */
export function weeklyTrophies(roster: Species[], bests: WeeklyBest[], slots = TROPHY_SLOTS): Trophy[] {
  const bySpecies = new Map(roster.filter((s) => (s.category === "fish" || s.category === "sea") && s.size).map((s) => [s.key, s]));
  const top = new Map<string, WeeklyBest>();
  for (const b of bests) {
    if (!bySpecies.has(b.item_key)) continue;
    const cur = top.get(b.item_key);
    if (!cur || b.size_cm > cur.size_cm || (b.size_cm === cur.size_cm && b.caught_at < cur.caught_at)) top.set(b.item_key, b);
  }
  const ranked = [...top.values()]
    .map((b) => {
      const sp = bySpecies.get(b.item_key)!;
      const [lo, hi] = sp.size!;
      return { b, sp, ratio: hi > lo ? (b.size_cm - lo) / (hi - lo) : 1 };
    })
    .sort((x, y) => RARITY_RANK[y.sp.rarity] - RARITY_RANK[x.sp.rarity] || y.ratio - x.ratio || x.b.caught_at.localeCompare(y.b.caught_at));
  const perMember = new Map<string, number>();
  const out: Trophy[] = [];
  for (const { b, sp, ratio } of ranked) {
    if (out.length >= slots) break;
    const n = perMember.get(b.user_id) ?? 0;
    if (n >= TROPHIES_PER_MEMBER) continue;
    perMember.set(b.user_id, n + 1);
    out.push({ rank: out.length + 1, key: sp.key, name: sp.name, icon: sp.icon, rarity: sp.rarity, size_cm: b.size_cm, size_ratio: Math.round(ratio * 100) / 100, member_id: b.user_id, member_name: b.member_name, caught_at: b.caught_at });
  }
  return out;
}

export const SHOWCASE_SLOTS = 3;

export function validateShowcase(keys: unknown, mine: MemberItem[]): { ok: true; keys: (string | null)[] } | { ok: false; error: string } {
  if (!Array.isArray(keys) || keys.length !== SHOWCASE_SLOTS) return { ok: false, error: "Pick exactly three slots (empty slots are null)." };
  const owned = new Set(mine.map((r) => r.item_key));
  const seen = new Set<string>();
  for (const k of keys) {
    if (k === null) continue;
    if (typeof k !== "string" || !owned.has(k)) return { ok: false, error: "You can only show things you've found." };
    if (seen.has(k)) return { ok: false, error: "Each item can be shown once." };
    seen.add(k);
  }
  return { ok: true, keys: keys as (string | null)[] };
}
