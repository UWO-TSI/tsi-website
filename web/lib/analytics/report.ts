/**
 * The admin analytics page's numbers, from one snapshot the server reads (game_analytics_snapshot, specs/analytics.md).
 * Pure: the dev page and the tests feed it made-up snapshots. World names only; ids never leave the server's page.
 */
import { LOG_ONLY, STEP_IDS as FUNNEL, STEP_LABEL, featureLabel, type StepId } from "./steps";

const DAY = 86_400_000;
/** Quiet this long after the last visit = "never came back" (David's words). */
export const GONE_DAYS = 7;

export interface Snapshot {
  /** Every player: world name (never a real name), when the account was made, the last thing they did in the game. */
  players: { id: string; name: string | null; joined: string; last: string | null }[];
  /** Each player's first time at each step: the event log, and the tables for history from before it (at null: no time kept). */
  steps: { m: string; s: string; at: string | null }[];
  /** One row per logged session (a page load of the member island). */
  sessions: { m: string; start: string; end: string; last_step: string | null; screen: string | null }[];
  /** A feature used on a day (event log and tables). */
  uses: { m: string; f: string; d: string }[];
  /** Days a player did anything (sessions, ledger, catches...): activity from before the log too. */
  days: { m: string; d: string }[];
}

export interface Report {
  range: { from: string; to: string };
  totals: { players: number; newInRange: number; activeToday: number; activeWeek: number; gone: number };
  perDay: { d: string; new: number; active: number }[];
  /** `of`: the players the share is of (log-only steps count only players who joined after the log started). */
  funnel: { step: StepId; label: string; reached: number; of: number; pct: number; dropPct: number }[];
  logSince: string | null;
  quitSession: { key: string; label: string; n: number }[];
  quitGone: { key: string; label: string; n: number }[];
  engagement: { sessions: number; medianMin: number; meanMin: number; perPlayer: number; stepMinutes: { label: string; median: number }[] };
  features: { label: string; players: number; returning: number }[];
  cohorts: { week: string; size: number; d1: number | null; d7: number | null; d30: number | null }[];
  list: { name: string; joined: string; last: string | null; sessions: number; minutes: number; furthest: string; gone: boolean }[];
}

const dayOf = (iso: string) => iso.slice(0, 10);

/** The page's ranges (days back from today); the snapshot always reads the log's whole 180 days and a margin. */
export const RANGES = [7, 30, 90, 180] as const;
export function rangeOf(days: number, now: Date): { from: string; to: string; since: string } {
  const n = (RANGES as readonly number[]).includes(days) ? days : 30;
  return { from: dayOf(new Date(now.getTime() - (n - 1) * DAY).toISOString()), to: dayOf(now.toISOString()), since: new Date(now.getTime() - 200 * DAY).toISOString() };
}
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const round1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
/** Monday of the week, as YYYY-MM-DD (UTC). */
const weekOf = (iso: string) => { const t = Date.parse(dayOf(iso)); return dayOf(new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY).toISOString()); };

function ranked(keys: string[], label: (k: string) => string) {
  const n = new Map<string, number>();
  for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n].map(([key, v]) => ({ key, label: label(key), n: v })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export function buildReport(snap: Snapshot, opts: { from: string; to: string; now: Date }): Report {
  const now = opts.now.getTime();
  const today = dayOf(opts.now.toISOString());
  const { from, to } = opts;
  const inRange = (iso: string) => { const d = dayOf(iso); return d >= from && d <= to; };

  // NaN = reached, time unknown (history the tables keep without one).
  const firstAt = new Map<string, Map<string, number>>();
  for (const r of snap.steps) {
    const m = firstAt.get(r.m) ?? firstAt.set(r.m, new Map()).get(r.m)!;
    const t = r.at ? Date.parse(r.at) : NaN, was = m.get(r.s);
    if (was === undefined || Number.isNaN(was) || t < was) m.set(r.s, t);
  }
  const activeDays = new Map<string, Set<string>>();
  for (const r of [...snap.days, ...snap.sessions.map((s) => ({ m: s.m, d: dayOf(s.start) }))]) {
    (activeDays.get(r.m) ?? activeDays.set(r.m, new Set()).get(r.m)!).add(r.d);
  }
  const lastSeen = new Map<string, number>(snap.players.map((p) => [p.id, Math.max(Date.parse(p.joined), p.last ? Date.parse(p.last) : 0)]));
  for (const s of snap.sessions) lastSeen.set(s.m, Math.max(lastSeen.get(s.m) ?? 0, Date.parse(s.end)));
  const isGone = (id: string) => now - (lastSeen.get(id) ?? 0) >= GONE_DAYS * DAY;

  // Day 2 and day 7: came back on (or after) the second / seventh calendar day since joining.
  const cameBack = (id: string, joined: string, n: number) => {
    const j = Date.parse(dayOf(joined));
    return [...(activeDays.get(id) ?? [])].some((d) => Date.parse(d) - j >= (n - 1) * DAY);
  };
  // The funnel counts players who joined in the range, so a step's drop is the same people's.
  const cohort = snap.players.filter((p) => inRange(p.joined));
  const reachedStep = (id: string, joined: string, step: StepId) =>
    step === "day_2" ? cameBack(id, joined, 2) : step === "day_7" ? cameBack(id, joined, 7) : step === "signed_in" || !!firstAt.get(id)?.has(step);
  // The log's first day: before it, only the tables' steps can be known.
  const logged = snap.sessions.map((s) => s.start).sort()[0] ?? null;
  const logCohort = logged ? cohort.filter((p) => p.joined >= logged) : [];
  let prevPct = 100;
  const funnel = FUNNEL.map((step) => {
    const base = LOG_ONLY.has(step) ? logCohort : cohort;
    const reached = base.filter((p) => reachedStep(p.id, p.joined, step)).length;
    const share = pct(reached, base.length);
    const row = { step, label: STEP_LABEL[step], reached, of: base.length, pct: share, dropPct: base.length && prevPct ? Math.max(0, Math.round((1 - share / prevPct) * 1000) / 10) : 0 };
    if (base.length) prevPct = share;
    return row;
  });
  const furthest = (id: string, joined: string) => {
    let last: StepId = "signed_in";
    for (const s of FUNNEL) if (reachedStep(id, joined, s)) last = s;
    return STEP_LABEL[last];
  };

  const sessions = snap.sessions.filter((s) => inRange(s.start));
  const minutes = (s: { start: string; end: string }) => Math.max(0, (Date.parse(s.end) - Date.parse(s.start)) / 60_000);
  const quitKey = (s: { last_step: string | null; screen: string | null }) => s.screen ? `screen:${s.screen}` : s.last_step ? `step:${s.last_step}` : "none";
  const quitLabel = (k: string) => k === "none" ? "Nothing logged" : k.startsWith("screen:") ? `On ${k === "screen:hq" ? "HQ" : k[7].toUpperCase() + k.slice(8)}` : `After ${STEP_LABEL[k.slice(5) as StepId] ?? k.slice(5)}`;
  const lastSession = new Map<string, Snapshot["sessions"][number]>();
  for (const s of snap.sessions) if (!(Date.parse(lastSession.get(s.m)?.end ?? "") >= Date.parse(s.end))) lastSession.set(s.m, s);
  const gonePlayers = snap.players.filter((p) => isGone(p.id) && (inRange(p.joined) || lastSession.has(p.id)));
  // Before going quiet: the last session's screen if it was logged, else the furthest funnel step (history).
  const goneKey = (p: Snapshot["players"][number]) => {
    const s = lastSession.get(p.id);
    return s ? quitKey(s) : `step:${[...FUNNEL].reverse().find((st) => !st.startsWith("day_") && reachedStep(p.id, p.joined, st)) ?? "signed_in"}`;
  };

  // Time per tutorial step: from reaching one funnel step to reaching the next, for players who reached both.
  const stepMinutes = FUNNEL.slice(0, -2).flatMap((s, i) => {
    const next = FUNNEL[i + 1];
    if (next === "day_2") return [];
    const gaps = cohort.flatMap((p) => {
      const a = s === "signed_in" ? Date.parse(p.joined) : firstAt.get(p.id)?.get(s), b = firstAt.get(p.id)?.get(next);
      return a !== undefined && b !== undefined && b >= a ? [(b - a) / 60_000] : [];
    });
    return gaps.length ? [{ label: `${STEP_LABEL[s]} to ${STEP_LABEL[next]}`, median: round1(median(gaps)) }] : [];
  });

  const useDays = new Map<string, Map<string, Set<string>>>();
  for (const u of snap.uses.filter((u) => u.d >= from && u.d <= to)) {
    const byM = useDays.get(u.f) ?? useDays.set(u.f, new Map()).get(u.f)!;
    (byM.get(u.m) ?? byM.set(u.m, new Set()).get(u.m)!).add(u.d);
  }
  const features = [...useDays].map(([f, byM]) => ({ label: featureLabel(f), players: byM.size, returning: [...byM.values()].filter((d) => d.size > 1).length }))
    .sort((a, b) => b.players - a.players || a.label.localeCompare(b.label));

  const perDay: Report["perDay"] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) {
    const d = dayOf(new Date(t).toISOString());
    perDay.push({ d, new: snap.players.filter((p) => dayOf(p.joined) === d).length, active: snap.players.filter((p) => activeDays.get(p.id)?.has(d)).length });
  }
  const weekAgo = dayOf(new Date(now - 6 * DAY).toISOString());

  const byWeek = new Map<string, Snapshot["players"]>();
  for (const p of snap.players) (byWeek.get(weekOf(p.joined)) ?? byWeek.set(weekOf(p.joined), []).get(weekOf(p.joined))!).push(p);
  const cohorts = [...byWeek].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([week, ps]) => {
    // A cohort's day-n share shows once every member of it is at least n days old.
    const ripe = (n: number) => Date.parse(week) + 6 * DAY + n * DAY <= now;
    const share = (n: number) => ripe(n) ? pct(ps.filter((p) => cameBack(p.id, p.joined, n + 1)).length, ps.length) : null;
    return { week, size: ps.length, d1: share(1), d7: share(7), d30: share(30) };
  });

  const playedMin = new Map<string, number>();
  const sessionsOf = new Map<string, number>();
  for (const s of snap.sessions) { playedMin.set(s.m, (playedMin.get(s.m) ?? 0) + minutes(s)); sessionsOf.set(s.m, (sessionsOf.get(s.m) ?? 0) + 1); }
  const lengths = sessions.map(minutes);
  const players = new Set(sessions.map((s) => s.m)).size;

  return {
    range: { from, to },
    totals: {
      players: snap.players.length,
      newInRange: cohort.length,
      activeToday: snap.players.filter((p) => activeDays.get(p.id)?.has(today)).length,
      activeWeek: snap.players.filter((p) => [...(activeDays.get(p.id) ?? [])].some((d) => d >= weekAgo)).length,
      gone: snap.players.filter((p) => isGone(p.id)).length,
    },
    perDay,
    funnel,
    logSince: logged,
    quitSession: ranked(sessions.map(quitKey), quitLabel).slice(0, 10),
    quitGone: ranked(gonePlayers.map(goneKey), quitLabel).slice(0, 10),
    engagement: {
      sessions: sessions.length,
      medianMin: round1(median(lengths)),
      meanMin: round1(lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1)),
      perPlayer: round1(sessions.length / (players || 1)),
      stepMinutes,
    },
    features,
    cohorts,
    list: [...snap.players].sort((a, b) => (lastSeen.get(b.id) ?? 0) - (lastSeen.get(a.id) ?? 0)).map((p) => ({
      name: p.name || "Unnamed islander",
      joined: p.joined,
      last: new Date(lastSeen.get(p.id) ?? Date.parse(p.joined)).toISOString(),
      sessions: sessionsOf.get(p.id) ?? 0,
      minutes: Math.round(playedMin.get(p.id) ?? 0),
      furthest: furthest(p.id, p.joined),
      gone: isGone(p.id),
    })),
  };
}
