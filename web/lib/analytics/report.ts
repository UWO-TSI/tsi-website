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
  /** Every event kind the log holds since the read began, so a new system's events show before the page knows them. */
  kinds?: { kind: string; n: number; players: number; first: string; last: string }[];
}

/** A share of the players it could be true of yet (`of`); null when nobody is old enough. */
export interface Rate { pct: number | null; of: number }
/** One headline number this period, and the same number over the period just before it (null: no data that far back). */
export interface Change { key: string; label: string; now: number; before: number | null; unit: "n" | "pct" | "min" }

export interface Report {
  range: { from: string; to: string };
  totals: { players: number; newInRange: number; activeToday: number; activeWeek: number; gone: number };
  /** Per day: players who joined, who played that day, in the 7 days to it, and in the 30 days to it. */
  perDay: { d: string; new: number; active: number; week: number; month: number }[];
  /** At the range's end: the average day of the last 7, the last 7 days, the last 30, and the day over the month. */
  actives: { dau: number; wau: number; mau: number; stickiness: number };
  /** Of the players who joined in the range: came back on day 1, 7 or 30 or later, and on the very next day. */
  retention: { d1: Rate; d7: Rate; d30: Rate; nextDay: Rate };
  /** Of the players who joined in the range: the share who finished the arrival (the tutorial). */
  tutorial: Rate;
  /** Typical time from joining to a first (minutes), and how many got there. */
  firsts: { step: StepId; label: string; medianMin: number | null; reached: number; of: number }[];
  sessionLengths: { label: string; n: number }[];
  kinds: { kind: string; label: string; n: number; players: number; first: string; last: string; known: boolean; isNew: boolean }[];
  /** The headline numbers against the period before. */
  changes: Change[];
  /** What the numbers mean, in plain sentences (worked out here from the numbers, no model call). */
  summary: { tone: "up" | "down" | "warn" | "info"; text: string }[];
  /** Players who joined in the range, since the log began (every step); before it, everyone (log-only steps `of` 0). */
  funnel: { step: StepId; label: string; reached: number; of: number; pct: number; dropPct: number }[];
  /** Players in the range who joined before the log: the steps the tables know (empty when the funnel is them). */
  history: { step: StepId; label: string; reached: number; of: number; pct: number }[];
  logSince: string | null;
  quitSession: { key: string; label: string; n: number }[];
  quitGone: { key: string; label: string; n: number }[];
  engagement: { sessions: number; medianMin: number; meanMin: number; perPlayer: number; stepMinutes: { label: string; median: number }[] };
  features: { label: string; players: number; returning: number }[];
  cohorts: { week: string; size: number; d1: number | null; d7: number | null; d30: number | null }[];
  list: { name: string; joined: string; last: string | null; sessions: number; minutes: number; furthest: string; gone: boolean }[];
}

/** A screen's name on the page ("village" is the member island's id, from before the island had its name). */
const SCREEN_LABEL: Record<string, string> = { village: "Island", hq: "HQ", id: "Island ID" };
export const screenLabel = (id: string) => SCREEN_LABEL[id] ?? id[0].toUpperCase() + id.slice(1);
/** The event log's own kinds (steps.ts and the events route); any other kind is a new system's, shown by its id. */
const KIND_LABEL: Record<string, string> = { session_start: "Session start", heartbeat: "Heartbeat", session_end: "Session end", step: "Step reached", feature: "Feature used" };
/** Session length buckets, minutes: [up to, label]. */
const LENGTHS = [[1, "Under 1 min"], [5, "1 to 5"], [15, "5 to 15"], [30, "15 to 30"], [60, "30 to 60"], [Infinity, "Over an hour"]] as const;

/** The UTC day of a time (any offset) or of a plain date. */
const dayOf = (iso: string) => (iso.length === 10 ? iso : new Date(iso).toISOString().slice(0, 10));

/** The page's ranges (days back from today); the snapshot always reads the log's whole 180 days and a margin. */
export const RANGES = [7, 30, 90, 180] as const;
/** How far back the snapshot reads (the log keeps 180 days). */
const READ_DAYS = 200;
export function rangeOf(days: number, now: Date): { from: string; to: string; since: string } {
  const n = (RANGES as readonly number[]).includes(days) ? days : 30;
  return { from: dayOf(new Date(now.getTime() - (n - 1) * DAY).toISOString()), to: dayOf(now.toISOString()), since: new Date(now.getTime() - READ_DAYS * DAY).toISOString() };
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
  const loggedAt = snap.sessions.reduce((a, s) => Math.min(a, Date.parse(s.start)), Infinity);
  const logged = Number.isFinite(loggedAt) ? new Date(loggedAt).toISOString() : null;
  // One base for the whole funnel, so each drop is the same people's: the players the log has seen from the start.
  const logCohort = logged ? cohort.filter((p) => Date.parse(p.joined) >= loggedAt) : [];
  const preLog = logCohort.length ? cohort.filter((p) => Date.parse(p.joined) < loggedAt) : [];
  const base = logCohort.length ? logCohort : cohort;
  let prevPct = 100;
  const funnel = FUNNEL.map((step) => {
    const of = LOG_ONLY.has(step) && !logCohort.length ? 0 : base.length;
    const reached = of ? base.filter((p) => reachedStep(p.id, p.joined, step)).length : 0;
    const share = pct(reached, of);
    const row = { step, label: STEP_LABEL[step], reached, of, pct: share, dropPct: of && prevPct ? Math.max(0, Math.round((1 - share / prevPct) * 1000) / 10) : 0 };
    if (of) prevPct = share;
    return row;
  });
  const history = preLog.length ? FUNNEL.filter((s) => !LOG_ONLY.has(s)).map((step) => {
    const reached = preLog.filter((p) => reachedStep(p.id, p.joined, step)).length;
    return { step, label: STEP_LABEL[step], reached, of: preLog.length, pct: pct(reached, preLog.length) };
  }) : [];
  const furthest = (id: string, joined: string) => {
    let last: StepId = "signed_in";
    for (const s of FUNNEL) if (reachedStep(id, joined, s)) last = s;
    return STEP_LABEL[last];
  };

  const sessions = snap.sessions.filter((s) => inRange(s.start));
  const minutes = (s: { start: string; end: string }) => Math.max(0, (Date.parse(s.end) - Date.parse(s.start)) / 60_000);
  const quitKey = (s: { last_step: string | null; screen: string | null }) => s.screen ? `screen:${s.screen}` : s.last_step ? `step:${s.last_step}` : "none";
  const quitLabel = (k: string) => k === "none" ? "Nothing logged" : k.startsWith("screen:") ? `On ${screenLabel(k.slice(7))}` : `After ${STEP_LABEL[k.slice(5) as StepId] ?? k.slice(5)}`;
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
  const dayAt = (t: number) => dayOf(new Date(t).toISOString());
  const playedIn = (days: string[]) => snap.players.filter((p) => { const a = activeDays.get(p.id); return !!a && days.some((d) => a.has(d)); }).length;
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) {
    const d = dayAt(t), back = (n: number) => Array.from({ length: n }, (_, k) => dayAt(t - k * DAY));
    perDay.push({ d, new: snap.players.filter((p) => dayOf(p.joined) === d).length, active: playedIn([d]), week: playedIn(back(7)), month: playedIn(back(30)) });
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

  // ── The headline numbers, this period and the one before it (same length), for the summary and the tiles. ──
  const span = perDay.length;
  const rate = (ps: Snapshot["players"], ok: (p: Snapshot["players"][number]) => boolean): Rate =>
    ps.length ? { pct: pct(ps.filter(ok).length, ps.length), of: ps.length } : { pct: null, of: 0 };
  // Old enough for day n: the whole of their day n is over.
  const ripe = (joined: string, n: number) => Date.parse(dayOf(joined)) + (n + 1) * DAY <= now;
  const nextDayBack = (p: Snapshot["players"][number]) => !!activeDays.get(p.id)?.has(dayAt(Date.parse(dayOf(p.joined)) + DAY));
  const period = (a: string, b: string) => {
    const within = (iso: string) => { const d = dayOf(iso); return d >= a && d <= b; };
    const joined = snap.players.filter((p) => within(p.joined));
    const ss = snap.sessions.filter((s) => within(s.start));
    let played = 0;
    for (const days of activeDays.values()) for (const d of days) if (d >= a && d <= b) played++;
    return {
      newPlayers: joined.length, avgDaily: round1(played / span), sessions: ss.length, medianMin: round1(median(ss.map(minutes))),
      nextDay: rate(joined.filter((p) => ripe(p.joined, 1)), nextDayBack),
      tutorial: rate(joined, (p) => reachedStep(p.id, p.joined, "arrived")),
    };
  };
  const cur = period(from, to);
  const prevFrom = dayAt(Date.parse(from) - span * DAY), prevTo = dayAt(Date.parse(from) - DAY);
  // Before the read window there's no activity to count; sessions need the log running the whole earlier period.
  const prev = Date.parse(prevFrom) >= now - READ_DAYS * DAY ? period(prevFrom, prevTo) : null;
  const logBefore = !!prev && loggedAt <= Date.parse(prevFrom);
  const changes: Change[] = [
    { key: "new", label: "New players", now: cur.newPlayers, before: prev?.newPlayers ?? null, unit: "n" as const },
    { key: "daily", label: "Players a day", now: cur.avgDaily, before: prev?.avgDaily ?? null, unit: "n" as const },
    { key: "sessions", label: "Sessions", now: cur.sessions, before: logBefore ? prev!.sessions : null, unit: "n" as const },
    { key: "length", label: "Typical session", now: cur.medianMin, before: logBefore ? prev!.medianMin : null, unit: "min" as const },
    { key: "tutorial", label: "Finished the tutorial", now: cur.tutorial.pct, before: prev?.tutorial.pct ?? null, unit: "pct" as const },
    { key: "nextDay", label: "Came back the next day", now: cur.nextDay.pct, before: prev?.nextDay.pct ?? null, unit: "pct" as const },
  ].flatMap((c) => c.now === null ? [] : [{ ...c, now: c.now }]);

  const firsts = (["first_catch", "first_sale", "first_quest"] as const).map((step) => {
    const waits = cohort.flatMap((p) => {
      const t = firstAt.get(p.id)?.get(step), j = Date.parse(p.joined);
      return t !== undefined && !Number.isNaN(t) && t >= j ? [(t - j) / 60_000] : [];
    });
    return { step, label: STEP_LABEL[step], medianMin: waits.length ? round1(median(waits)) : null, reached: cohort.filter((p) => firstAt.get(p.id)?.has(step)).length, of: cohort.length };
  });
  const last7 = perDay.slice(-7);
  const dau = round1(last7.reduce((a, d) => a + d.active, 0) / (last7.length || 1));
  const wau = perDay.at(-1)?.week ?? 0, mau = perDay.at(-1)?.month ?? 0;
  const kinds = (snap.kinds ?? []).map((k) => ({ ...k, label: KIND_LABEL[k.kind] ?? k.kind, known: k.kind in KIND_LABEL, isNew: !(k.kind in KIND_LABEL) && inRange(k.first) }))
    .sort((a, b) => b.n - a.n || a.kind.localeCompare(b.kind));
  const quitGone = ranked(gonePlayers.map(goneKey), quitLabel).slice(0, 10);
  const summary = summarize({ changes, span, prev: !!prev, funnel, cohorts, quitGone, perDay, kinds });

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
    actives: { dau, wau, mau, stickiness: mau ? Math.round((dau / mau) * 100) : 0 },
    retention: {
      d1: rate(cohort.filter((p) => ripe(p.joined, 1)), (p) => cameBack(p.id, p.joined, 2)),
      d7: rate(cohort.filter((p) => ripe(p.joined, 7)), (p) => cameBack(p.id, p.joined, 8)),
      d30: rate(cohort.filter((p) => ripe(p.joined, 30)), (p) => cameBack(p.id, p.joined, 31)),
      nextDay: cur.nextDay,
    },
    tutorial: cur.tutorial,
    firsts,
    sessionLengths: LENGTHS.map(([top, label], i) => ({ label, n: lengths.filter((m) => m < top && m >= (i ? LENGTHS[i - 1][0] : 0)).length })),
    kinds,
    changes,
    summary,
    funnel,
    history,
    logSince: logged,
    quitSession: ranked(sessions.map(quitKey), quitLabel).slice(0, 10),
    quitGone,
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

const md = (d: string) => new Date(dayOf(d)).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
const num = (c: Change, v: number) => c.unit === "pct" ? `${v}%` : c.unit === "min" ? `${v} min` : `${v}`;

/**
 * The summary card: the numbers read out in plain sentences, on the server, with no model call. In order: the biggest
 * moves against the period before, the worst drop in the funnel, day-7 retention moving, where people quit most, and
 * anything unusual (a spike, a silence, an event kind the page hasn't seen before).
 */
export function summarize(r: Pick<Report, "changes" | "funnel" | "cohorts" | "quitGone" | "perDay" | "kinds"> & { span: number; prev: boolean }): Report["summary"] {
  const out: Report["summary"] = [];
  const before = `the ${r.span} days before`;
  // Percentages move in points, counts in percent; a count needs a few players behind it to mean anything.
  const moves = r.changes.filter((c) => c.before !== null).map((c) => {
    const b = c.before!, d = c.unit === "pct" ? c.now - b : b ? ((c.now - b) / b) * 100 : c.now ? 100 : 0;
    return { c, d, size: c.unit === "pct" ? Math.abs(d) * 2 : Math.abs(d) };
  }).filter((m) => m.c.unit === "pct" ? Math.abs(m.d) >= 5 : Math.abs(m.d) >= 15 && Math.max(m.c.now, m.c.before!) >= 3)
    .sort((a, b) => b.size - a.size).slice(0, 3);
  for (const { c, d } of moves) {
    const way = d > 0 ? "rose" : "fell", by = c.unit === "pct" ? `${Math.round(Math.abs(d))} points` : `${Math.round(Math.abs(d))}%`;
    out.push({ tone: d > 0 ? "up" : "down", text: c.before || c.unit === "pct"
      ? `${c.label} ${way} ${by}: ${num(c, c.now)}, against ${num(c, c.before!)} in ${before}.`
      : `${c.label}: ${num(c, c.now)}, where ${before} had none.` });
  }
  if (!moves.length) out.push({ tone: "info", text: r.prev ? `Nothing moved much against ${before}.` : `There's no earlier ${r.span} days in the log to compare with yet.` });

  // The worst step: the biggest share lost between two steps of the opening and the tutorial (the returns are retention's).
  let worst: { label: string; from: string; lost: number; of: number; drop: number } | null = null;
  let last: Report["funnel"][number] | null = null;
  for (const f of r.funnel) {
    if (!f.of || f.step.startsWith("day_")) continue;
    if (last) {
      const lost = last.reached - f.reached;
      if (lost >= 2 && (!worst || f.dropPct > worst.drop)) worst = { label: f.label, from: last.label, lost, of: last.reached, drop: f.dropPct };
    }
    last = f;
  }
  if (worst) out.push({ tone: "warn", text: `The worst drop is at "${worst.label}": ${worst.lost} of the ${worst.of} who got to "${worst.from}" went no further (${worst.drop}%).` });

  // Day 7: the newest week old enough, against the weeks before it.
  const ripe = r.cohorts.filter((c) => c.d7 !== null && c.size >= 3);
  if (ripe.length >= 2) {
    const [newest, ...rest] = ripe, avg = Math.round(rest.reduce((a, c) => a + c.d7!, 0) / rest.length), d = newest.d7! - avg;
    const way = Math.abs(d) < 3 ? "is steady" : d > 0 ? "is up" : "is down";
    out.push({ tone: Math.abs(d) < 3 ? "info" : d > 0 ? "up" : "down", text: `Day 7 retention ${way}: ${newest.d7}% of the week of ${md(newest.week)} came back a week on, against ${avg}% for the weeks before.` });
  }

  const gone = r.quitGone.reduce((a, q) => a + q.n, 0);
  if (gone && r.quitGone[0].key !== "none") {
    const q = r.quitGone[0];
    out.push({ tone: "warn", text: `Most players who went quiet stopped ${lower(q.label)}: ${q.n} of ${gone} (${Math.round((q.n / gone) * 100)}%).` });
  }

  // Unusual: a day far above a usual one, days of nobody, a new kind of event.
  const usual = median(r.perDay.map((d) => d.active).filter(Boolean));
  const peak = r.perDay.reduce<Report["perDay"][number] | null>((a, d) => (!a || d.active > a.active ? d : a), null);
  if (peak && peak.active >= 5 && peak.active >= 2.5 * Math.max(usual, 1)) {
    out.push({ tone: "info", text: `${md(peak.d)} stood out: ${peak.active} played, about ${Math.round(peak.active / Math.max(usual, 1))} times a usual day.` });
  }
  const silent = r.perDay.length - 1 - r.perDay.findLastIndex((d) => d.active > 0);
  if (usual && silent >= 3) out.push({ tone: "warn", text: `Nobody has played in the last ${silent} days.` });
  for (const k of r.kinds.filter((k) => k.isNew)) out.push({ tone: "info", text: `A new kind of event, "${k.kind}", started on ${md(k.first)}: ${k.n} so far, from ${k.players} players.` });
  return out;
}
