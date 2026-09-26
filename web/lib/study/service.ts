/**
 * Study service: seats, host lock, phases, presence, settlement, stats.
 * Every call replays time server-side (rules.advance) before acting.
 */
import { weekStart } from "@/lib/collections/logic";
import * as R from "./rules";
import { StudyError, type StudyStore, type StudyTable, type WeekStat } from "./store";

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string };
const fail = <T>(status: number, code: string, error: string): Result<T> => ({ ok: false, status, code, error });
const ERR: Record<string, [number, string]> = {
  unavailable: [503, "Study tables aren't available yet."],
  seat_taken: [409, "Someone just took that seat."],
  already_seated: [409, "You're already sitting somewhere. Leave that seat first."],
  failed: [500, "Something went wrong. Try again."],
};
function caught<T>(err: unknown): Result<T> {
  const code = err instanceof StudyError ? err.code : "failed";
  const [status, error] = ERR[code] ?? ERR.failed;
  return fail(status, code, error);
}

let seq = 0;
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`);

/** Persist a transition; on a lost race, reload once and re-apply. */
async function commit(store: StudyStore, s: R.StudySession, next: (cur: R.StudySession) => R.StudySession | R.Transition): Promise<Result<R.StudySession>> {
  let cur: R.StudySession | null = s;
  for (let attempt = 0; attempt < 3 && cur; attempt++) {
    const out = next(cur);
    if ("ok" in out && !out.ok) return out;
    const updated = "ok" in out ? out.session : out;
    if (updated === cur) return { ok: true, data: cur };
    if (await store.updateSession({ ...updated, version: cur.version })) return { ok: true, data: { ...updated, version: cur.version + 1 } };
    cur = await store.getSession(s.id);
  }
  return fail(409, "conflict", "Your session changed on another device. Try again.");
}

/** Settle any ended-but-unpaid sessions (idempotent; safe to call on every request). */
async function settlePending(store: StudyStore, memberId: string): Promise<number> {
  let coins = 0;
  for (const s of await store.memberUnsettled(memberId)) coins += (await store.settle(s.id, memberId)).coins;
  return coins;
}

/** When the host leaves, the lock goes with them; the next earliest sitter hosts, unlocked. */
async function releaseHost(store: StudyStore, table: StudyTable, leaverId: string) {
  if (table.host_id !== leaverId) return;
  const rest = (await store.activeSessions(table.id)).filter((x) => x.member_id !== leaverId).sort((a, b) => a.started_at.localeCompare(b.started_at));
  await store.updateTable(table.id, { host_id: rest[0]?.member_id ?? null, is_private: false, allowed: [] });
}

/** End stale sessions (grace expired) so their seats free up; settles them. */
async function sweep(store: StudyStore, now: Date, tableId?: string) {
  const tables = await store.listTables();
  for (const s of await store.activeSessions(tableId)) {
    const n = R.advance(s, now);
    if (n.phase !== "ended") continue;
    const r = await commit(store, s, (cur) => R.advance(cur, now));
    if (r.ok && r.data.phase === "ended") {
      await store.settle(s.id, s.member_id);
      const t = tables.find((x) => x.id === s.table_id);
      if (t) await releaseHost(store, t, s.member_id);
    }
  }
}

export interface Mate {
  member_id: string;
  name: string;
  seat: number;
  phase: R.Phase;
  remaining_s: number | null;
  is_host: boolean;
  me: boolean;
}
export interface TableView {
  id: string;
  slug: string;
  label: string;
  location: string;
  anchor: string;
  kind: StudyTable["kind"];
  seats: number;
  taken: number[];
  is_private: boolean;
  /** Private tables read as occupied to anyone the host didn't let in (row 168). */
  can_join: boolean;
  host_name: string | null;
  mates: Mate[];
}

async function tableViews(store: StudyStore, me: string, now: Date): Promise<TableView[]> {
  const [tables, sessions] = await Promise.all([store.listTables(), store.activeSessions()]);
  const names = await store.names([...new Set([...sessions.map((s) => s.member_id), ...tables.flatMap((t) => (t.host_id ? [t.host_id] : []))])]);
  return tables.map((t) => {
    const here = sessions.filter((s) => s.table_id === t.id).map((s) => R.advance(s, now)).filter((s) => s.phase !== "ended");
    const allowed = !t.is_private || t.host_id === me || t.allowed.includes(me) || here.some((s) => s.member_id === me);
    const mates = allowed
      ? here.map((s) => ({ member_id: s.member_id, name: names.get(s.member_id) ?? "Member", seat: s.seat, phase: s.phase, remaining_s: R.viewOf(s, now).remaining_s, is_host: s.member_id === t.host_id, me: s.member_id === me }))
      : [];
    return {
      id: t.id, slug: t.slug, label: t.label, location: t.location, anchor: t.anchor, kind: t.kind, seats: t.seats,
      taken: allowed ? here.map((s) => s.seat) : Array.from({ length: t.seats }, (_, i) => i + 1),
      is_private: t.is_private, can_join: allowed && here.length < t.seats,
      host_name: t.host_id ? (names.get(t.host_id) ?? "Member") : null, mates,
    };
  });
}

export interface StudyState {
  session: R.SessionView | null;
  table: TableView | null;
  tables: TableView[];
  settled_coins: number;
  /** The session that just ended on this call (left, finished or timed out). */
  ended: R.SessionView | null;
}

async function state(store: StudyStore, me: string, now: Date, settled = 0, ended: R.SessionView | null = null): Promise<StudyState> {
  const s = await store.memberActive(me);
  const tables = await tableViews(store, me, now);
  const current = s ? R.advance(s, now) : null;
  return {
    session: current ? R.viewOf(current, now) : null,
    table: current ? (tables.find((t) => t.id === current.table_id) ?? null) : null,
    tables,
    settled_coins: settled,
    ended,
  };
}

/** After a transition that ended the session: settle and hand the lock on. */
async function afterEnd(store: StudyStore, s: R.StudySession): Promise<number> {
  if (s.phase !== "ended") return 0;
  const paid = await store.settle(s.id, s.member_id);
  const t = (await store.listTables()).find((x) => x.id === s.table_id);
  if (t) await releaseHost(store, t, s.member_id);
  return paid.coins;
}

export async function getState(store: StudyStore, me: string, now: Date): Promise<Result<StudyState>> {
  try {
    await sweep(store, now);
    const settled = await settlePending(store, me);
    return { ok: true, data: await state(store, me, now, settled) };
  } catch (err) {
    return caught(err);
  }
}

export async function sit(store: StudyStore, me: string, input: { table_id: string; seat: number }, now: Date): Promise<Result<StudyState>> {
  try {
    await sweep(store, now, input.table_id);
    const table = (await store.listTables()).find((t) => t.id === input.table_id);
    if (!table) return fail(404, "not_found", "That table isn't here.");
    if (!Number.isInteger(input.seat) || input.seat < 1 || input.seat > table.seats) return fail(400, "bad_seat", "That seat doesn't exist.");
    const mine = await store.memberActive(me);
    if (mine) {
      if (mine.table_id === input.table_id && mine.seat === input.seat) return { ok: true, data: await state(store, me, now) }; // retry-safe
      return fail(409, "already_seated", ERR.already_seated[1]);
    }
    const here = await store.activeSessions(table.id);
    if (table.is_private && table.host_id !== me && !table.allowed.includes(me)) return fail(403, "table_locked", "This table is private.");
    if (here.some((s) => s.seat === input.seat)) return fail(409, "seat_taken", ERR.seat_taken[1]);
    const at = now.toISOString();
    await store.insertSession({
      id: newId(), member_id: me, table_id: table.id, seat: input.seat, focus_len: null, break_len: null, cycles: null, phase: "seated", cycle_index: 0,
      started_at: at, phase_started_at: at, last_heartbeat: at, ended_at: null, end_reason: null, minutes_completed: 0, blocks_completed: 0,
      bonus_earned: 0, longest_block: 0, coins_paid: null, settled_at: null, version: 0,
    });
    // First sitter at an empty table hosts it (row 168).
    if (here.length === 0) await store.updateTable(table.id, { host_id: me, is_private: false, allowed: [] });
    return { ok: true, data: await state(store, me, now) };
  } catch (err) {
    return caught(err);
  }
}

async function withSession(store: StudyStore, me: string, now: Date, f: (s: R.StudySession) => R.StudySession | R.Transition): Promise<Result<StudyState>> {
  try {
    const s = await store.memberActive(me);
    if (!s) return fail(409, "not_seated", "Sit down at a table first.");
    const r = await commit(store, s, f);
    if (!r.ok) return r;
    const paid = await afterEnd(store, r.data);
    const ended = r.data.phase === "ended" ? R.viewOf({ ...r.data, coins_paid: R.coinsFor(r.data) }, now) : null;
    return { ok: true, data: await state(store, me, now, paid, ended) };
  } catch (err) {
    return caught(err);
  }
}

export function startSession(store: StudyStore, me: string, input: Partial<R.Settings>, now: Date): Promise<Result<StudyState>> {
  const v = R.validateSettings(input);
  if (!v.ok) return Promise.resolve(fail(400, "bad_settings", v.error));
  return withSession(store, me, now, (s) => R.start(s, v.settings, now));
}
export const beat = (store: StudyStore, me: string, now: Date) => withSession(store, me, now, (s) => R.heartbeat(s, now));
export const breakNow = (store: StudyStore, me: string, now: Date) => withSession(store, me, now, (s) => R.takeBreak(s, now));
export const resumeNow = (store: StudyStore, me: string, now: Date) => withSession(store, me, now, (s) => R.resume(s, now));
export const endNow = (store: StudyStore, me: string, now: Date) => withSession(store, me, now, (s) => R.leave(s, now));

export async function lock(store: StudyStore, me: string, input: { table_id: string; is_private: boolean; allowed?: string[] }, now: Date): Promise<Result<StudyState>> {
  try {
    await sweep(store, now, input.table_id);
    const table = (await store.listTables()).find((t) => t.id === input.table_id);
    if (!table) return fail(404, "not_found", "That table isn't here.");
    const mine = await store.memberActive(me);
    if (table.host_id !== me || !mine || mine.table_id !== table.id) return fail(403, "not_host", "Only the seated host can lock this table.");
    // Everyone already seated stays; the lock only stops new sitters.
    const seated = (await store.activeSessions(table.id)).map((s) => s.member_id);
    const allowed = [...new Set([...(input.allowed ?? []), ...seated])].filter((id) => id !== me).slice(0, 12);
    await store.updateTable(table.id, { is_private: input.is_private, allowed: input.is_private ? allowed : [] });
    return { ok: true, data: await state(store, me, now) };
  } catch (err) {
    return caught(err);
  }
}

export interface MyStats {
  week_start: string;
  minutes: number;
  longest_block: number;
  sessions: number;
  on_board: boolean;
}

export async function myStats(store: StudyStore, me: string, now: Date): Promise<Result<MyStats>> {
  try {
    const week = weekStart(now);
    const [stats, optIns] = await Promise.all([store.weekStats(week), store.boardOptIns()]);
    const s = stats.find((x) => x.member_id === me);
    return { ok: true, data: { week_start: week, minutes: s?.minutes ?? 0, longest_block: s?.longest_block ?? 0, sessions: s?.sessions ?? 0, on_board: optIns.has(me) } };
  } catch (err) {
    return caught(err);
  }
}

export const BOARD_SIZE = 10;

/** Opt-in only (row 171): members who haven't opted in never appear, whatever their minutes. */
export function topStudiers(stats: WeekStat[], optIns: Set<string>, names: Map<string, string>, size = BOARD_SIZE) {
  return stats
    .filter((s) => optIns.has(s.member_id) && s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || b.longest_block - a.longest_block || a.member_id.localeCompare(b.member_id))
    .slice(0, size)
    .map((s, i) => ({ rank: i + 1, name: names.get(s.member_id) ?? "Member", minutes: s.minutes, longest_block: s.longest_block }));
}

export async function board(store: StudyStore, now: Date): Promise<Result<{ week_start: string; top: ReturnType<typeof topStudiers> }>> {
  try {
    const week = weekStart(now);
    const [stats, optIns] = await Promise.all([store.weekStats(week), store.boardOptIns()]);
    const names = await store.names(stats.filter((s) => optIns.has(s.member_id)).map((s) => s.member_id));
    return { ok: true, data: { week_start: week, top: topStudiers(stats, optIns, names) } };
  } catch (err) {
    return caught(err);
  }
}
