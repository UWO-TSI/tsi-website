/**
 * Seasons on the real Ontario calendar (ledger rows 99, 161), blended over
 * ~2 weeks around each astronomical boundary so dressing changes gradually.
 * Boundaries use fixed dates (Mar 20, Jun 21, Sep 22, Dec 21); the true
 * equinox/solstice moves by at most a day, which the 14-day blend absorbs.
 */
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];
export const SEASON_BLEND_DAYS = 14;

const STARTS: { season: Season; month: number; day: number }[] = [
  { season: "spring", month: 3, day: 20 },
  { season: "summer", month: 6, day: 21 },
  { season: "autumn", month: 9, day: 22 },
  { season: "winter", month: 12, day: 21 },
];
const DAY = 86_400_000;

/** Calendar date in Toronto, as a UTC-midnight timestamp (DST-proof day arithmetic). */
function torontoDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

export interface SeasonBlend {
  /** Season whose weight is largest. */
  season: Season;
  /** Weight per season; sums to 1, at most two are non-zero. */
  weights: Record<Season, number>;
}

/**
 * Weight of each season for a date. Inside ±7 days of a boundary the outgoing
 * and incoming seasons crossfade with a smoothstep; elsewhere one season is 1.
 */
export function seasonBlend(date = new Date()): SeasonBlend {
  const today = torontoDay(date);
  const year = new Date(today).getUTCFullYear();
  // Boundaries from last year's winter start through next year's spring start.
  const boundaries = [year - 1, year, year + 1].flatMap(y => STARTS.map(s => ({ season: s.season, at: Date.UTC(y, s.month - 1, s.day) })));
  const half = (SEASON_BLEND_DAYS / 2) * DAY;
  const weights: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  let current = boundaries[0];
  for (const boundary of boundaries) if (boundary.at <= today) current = boundary;
  const index = boundaries.indexOf(current);
  const previous = boundaries[index - 1], next = boundaries[index + 1];
  const fade = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
  if (today - current.at < half && previous) {
    // Just after a boundary: still finishing the crossfade from the previous season.
    const t = fade((today - current.at + half) / (2 * half));
    weights[previous.season] = 1 - t; weights[current.season] = t;
  } else if (next && next.at - today <= half) {
    const t = fade((today - next.at + half) / (2 * half));
    weights[current.season] = 1 - t; weights[next.season] = t;
  } else {
    weights[current.season] = 1;
  }
  const season = SEASONS.reduce((best, s) => weights[s] > weights[best] ? s : best, current.season);
  return { season, weights };
}

/**
 * QA override: `?season=spring|summer|autumn|winter` (also `fall`), or a
 * crossfade `?season=autumn-winter` (50%) / `?season=autumn-winter:0.25`
 * (25% of the way to winter).
 */
export function parseSeasonOverride(search: string): SeasonBlend | null {
  const value = new URLSearchParams(search).get("season");
  if (!value) return null;
  const norm = (name: string) => (name === "fall" ? "autumn" : name) as Season;
  const [pair, amountText] = value.split(":");
  const [from, to] = pair.split("-").map(norm);
  const valid = (name?: Season) => !!name && (SEASONS as readonly string[]).includes(name);
  if (!valid(from) || (to !== undefined && !valid(to))) return null;
  const amount = to ? Math.min(1, Math.max(0, amountText === undefined ? 0.5 : Number(amountText))) : 1;
  if (!Number.isFinite(amount)) return null;
  const weights: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
  weights[from] = to ? 1 - amount : 1;
  if (to) weights[to] += amount;
  return { season: to && amount >= 0.5 ? to : from, weights };
}
