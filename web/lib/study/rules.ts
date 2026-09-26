/**
 * Study session rules (specs/study.md, ledger rows 73, 78-80, 126, 165, 166, 170).
 * Pure and deterministic: the server replays wall-clock time through
 * advance() on every call, so phases change server-side whether or not the
 * client is watching. Clients only ask; they never report minutes.
 */

export const GRACE_MS = 5 * 60_000; // row 170
export const MINUTE = 60_000;
export const COINS_PER_MINUTE = 1; // row 126
export const BONUS_PER_25 = 10; // row 126, scaled by block length

export const PRESETS = [
  { id: "25-5x4", label: "25 / 5 × 4", focus_len: 25, break_len: 5, cycles: 4 },
  { id: "50-10x2", label: "50 / 10 × 2", focus_len: 50, break_len: 10, cycles: 2 },
] as const;

export const LIMITS = { focus: [5, 90], break: [1, 30], cycles: [1, 8] } as const;

export type Phase = "seated" | "focus" | "break" | "ended";
export type EndReason = "left" | "finished" | "timeout";

export interface StudySession {
  id: string;
  member_id: string;
  table_id: string;
  seat: number;
  focus_len: number | null;
  break_len: number | null;
  cycles: number | null;
  phase: Phase;
  cycle_index: number; // 0-based, current cycle
  started_at: string; // sat down
  phase_started_at: string;
  last_heartbeat: string;
  ended_at: string | null;
  end_reason: EndReason | null;
  minutes_completed: number;
  blocks_completed: number;
  bonus_earned: number;
  longest_block: number;
  coins_paid: number | null;
  settled_at: string | null;
  version: number;
}

export interface Settings {
  focus_len: number;
  break_len: number;
  cycles: number;
}

const ms = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();
const within = (n: unknown, [lo, hi]: readonly [number, number]) => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;

export function validateSettings(s: Partial<Settings>): { ok: true; settings: Settings } | { ok: false; error: string } {
  if (!within(s.focus_len, LIMITS.focus)) return { ok: false, error: `Focus is ${LIMITS.focus[0]}–${LIMITS.focus[1]} minutes.` };
  if (!within(s.break_len, LIMITS.break)) return { ok: false, error: `Breaks are ${LIMITS.break[0]}–${LIMITS.break[1]} minutes.` };
  if (!within(s.cycles, LIMITS.cycles)) return { ok: false, error: `Pick ${LIMITS.cycles[0]}–${LIMITS.cycles[1]} cycles.` };
  return { ok: true, settings: { focus_len: s.focus_len!, break_len: s.break_len!, cycles: s.cycles! } };
}

/** +10 per completed 25-minute block, scaled by block length (50 → 20, 15 → 6). */
export function blockBonus(focusLen: number): number {
  return Math.round((BONUS_PER_25 * focusLen) / 25);
}

export function coinsFor(s: Pick<StudySession, "minutes_completed" | "bonus_earned">): number {
  return s.minutes_completed * COINS_PER_MINUTE + s.bonus_earned;
}

function phaseLen(s: StudySession): number {
  return (s.phase === "focus" ? s.focus_len! : s.break_len!) * MINUTE;
}

export function phaseEndsAt(s: StudySession): string | null {
  return s.phase === "focus" || s.phase === "break" ? iso(ms(s.phase_started_at) + phaseLen(s)) : null;
}

/** Complete every phase that ended by `until`. Finishing the last focus block ends the session. */
function step(s: StudySession, until: number): StudySession {
  const n = { ...s };
  while (n.phase === "focus" || n.phase === "break") {
    const end = ms(n.phase_started_at) + phaseLen(n);
    if (end > until) break;
    if (n.phase === "focus") {
      n.minutes_completed += n.focus_len!;
      n.blocks_completed += 1;
      n.bonus_earned += blockBonus(n.focus_len!);
      n.longest_block = Math.max(n.longest_block, n.focus_len!);
      if (n.cycle_index >= n.cycles! - 1) {
        n.phase = "ended";
        n.ended_at = iso(end);
        n.end_reason = "finished";
        n.phase_started_at = iso(end);
        break;
      }
      n.phase = "break";
    } else {
      n.phase = "focus";
      n.cycle_index += 1;
    }
    n.phase_started_at = iso(end);
  }
  return n;
}

/** End at `at`: whole focus minutes of the current block count, its bonus doesn't (row 79). */
function close(s: StudySession, at: number, reason: EndReason): StudySession {
  const n = { ...s };
  if (n.phase === "focus") {
    const partial = Math.min(n.focus_len! - 1, Math.max(0, Math.floor((at - ms(n.phase_started_at)) / MINUTE)));
    n.minutes_completed += partial;
    n.longest_block = Math.max(n.longest_block, partial);
  }
  n.phase = "ended";
  n.ended_at = iso(Math.max(at, ms(n.phase_started_at)));
  n.end_reason = reason;
  return n;
}

/**
 * Bring a session up to `now`. If the last heartbeat is older than the
 * grace period, time stops counting at that heartbeat and the session ends
 * as a timeout (minutes paid, no bonus for the interrupted block).
 */
export function advance(s: StudySession, now: Date): StudySession {
  if (s.phase === "ended") return s;
  const t = now.getTime();
  const expired = t - ms(s.last_heartbeat) > GRACE_MS;
  const cutoff = expired ? ms(s.last_heartbeat) : t;
  const n = step(s, cutoff);
  if (n.phase === "ended") return n;
  return expired ? close(n, cutoff, "timeout") : n;
}

export type Transition = { ok: true; session: StudySession } | { ok: false; status: number; error: string; code: string };
const nope = (status: number, code: string, error: string): Transition => ({ ok: false, status, code, error });

export function heartbeat(s: StudySession, now: Date): StudySession {
  const n = advance(s, now);
  return n.phase === "ended" ? n : { ...n, last_heartbeat: now.toISOString() };
}

export function start(s: StudySession, settings: Settings, now: Date): Transition {
  const n = advance(s, now);
  if (n.phase === "ended") return nope(409, "ended", "That session has ended. Sit down again to start a new one.");
  if (n.phase !== "seated") return nope(409, "started", "Your timer is already running.");
  const at = now.toISOString();
  return { ok: true, session: { ...n, ...settings, phase: "focus", cycle_index: 0, phase_started_at: at, last_heartbeat: at } };
}

/** Take the break early: completed minutes count, the block's bonus doesn't. */
export function takeBreak(s: StudySession, now: Date): Transition {
  const n = advance(s, now);
  if (n.phase !== "focus") return nope(409, "not_focus", "You can only break from a focus block.");
  const t = now.getTime();
  if (n.cycle_index >= n.cycles! - 1) return { ok: true, session: close(n, t, "finished") };
  const partial = Math.min(n.focus_len! - 1, Math.floor((t - ms(n.phase_started_at)) / MINUTE));
  return {
    ok: true,
    session: { ...n, minutes_completed: n.minutes_completed + partial, longest_block: Math.max(n.longest_block, partial), phase: "break", phase_started_at: now.toISOString(), last_heartbeat: now.toISOString() },
  };
}

/** Skip the rest of a break and start the next focus block. */
export function resume(s: StudySession, now: Date): Transition {
  const n = advance(s, now);
  if (n.phase !== "break") return nope(409, "not_break", "You're not on a break.");
  return { ok: true, session: { ...n, phase: "focus", cycle_index: n.cycle_index + 1, phase_started_at: now.toISOString(), last_heartbeat: now.toISOString() } };
}

/** Leaving the seat ends the session (row 80). */
export function leave(s: StudySession, now: Date): StudySession {
  const n = advance(s, now);
  return n.phase === "ended" ? n : close(n, now.getTime(), "left");
}

export interface SessionView {
  id: string;
  table_id: string;
  seat: number;
  phase: Phase;
  settings: Settings | null;
  cycle: number; // 1-based
  phase_ends_at: string | null;
  remaining_s: number | null;
  minutes_completed: number;
  blocks_completed: number;
  coins_pending: number;
  ended_at: string | null;
  end_reason: EndReason | null;
  coins_paid: number | null;
}

export function viewOf(s: StudySession, now: Date): SessionView {
  const end = phaseEndsAt(s);
  return {
    id: s.id,
    table_id: s.table_id,
    seat: s.seat,
    phase: s.phase,
    settings: s.focus_len ? { focus_len: s.focus_len, break_len: s.break_len!, cycles: s.cycles! } : null,
    cycle: s.cycle_index + 1,
    phase_ends_at: end,
    remaining_s: end ? Math.max(0, Math.ceil((ms(end) - now.getTime()) / 1000)) : null,
    minutes_completed: s.minutes_completed,
    blocks_completed: s.blocks_completed,
    coins_pending: coinsFor(s),
    ended_at: s.ended_at,
    end_reason: s.end_reason,
    coins_paid: s.coins_paid,
  };
}
