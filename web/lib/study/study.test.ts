import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { memoryStudyStore } from "./memoryStore";
import { advance, blockBonus, coinsFor, heartbeat, leave, start, takeBreak, resume, type StudySession } from "./rules";
import { beat, board, breakNow, endNow, getState, lock, myStats, resumeNow, sit, startSession, topStudiers } from "./service";
import { DEFAULT_TABLES } from "./tables";

const T0 = Date.parse("2026-09-24T14:00:00Z");
const at = (min: number, sec = 0) => new Date(T0 + min * 60_000 + sec * 1000);
const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const C = "00000000-0000-4000-8000-0000000000cc";
const two = DEFAULT_TABLES.find((t) => t.kind === "two")!.id;
const four = DEFAULT_TABLES.find((t) => t.kind === "four")!.id;

function seated(): StudySession {
  const iso = at(0).toISOString();
  return { id: "s1", member_id: A, table_id: two, seat: 1, focus_len: null, break_len: null, cycles: null, phase: "seated", cycle_index: 0, started_at: iso, phase_started_at: iso, last_heartbeat: iso, ended_at: null, end_reason: null, minutes_completed: 0, blocks_completed: 0, bonus_earned: 0, longest_block: 0, coins_paid: null, settled_at: null, version: 0 };
}
function running(focus = 25, brk = 5, cycles = 4): StudySession {
  const r = start(seated(), { focus_len: focus, break_len: brk, cycles }, at(0));
  if (!r.ok) throw new Error(r.error);
  return r.session;
}
/** Heartbeat every minute up to `min` (a watched session). */
function watch(s: StudySession, min: number): StudySession {
  for (let m = 1; m <= min; m++) s = heartbeat(s, at(m));
  return s;
}

describe("accrual (rows 79, 126)", () => {
  it("pays 1 coin per focus minute plus 10 per 25-minute block, scaled by length", () => {
    expect([blockBonus(25), blockBonus(50), blockBonus(15), blockBonus(90)]).toEqual([10, 20, 6, 36]);
    const done = watch(running(), 115); // 4×25 focus + 3×5 break
    expect(done).toMatchObject({ phase: "ended", end_reason: "finished", minutes_completed: 100, blocks_completed: 4, bonus_earned: 40, longest_block: 25 });
    expect(coinsFor(done)).toBe(140);
    const fifty = watch(running(50, 10, 2), 110);
    expect(coinsFor(fifty)).toBe(100 + 40);
  });
  it("walks focus → break → focus server-side and never pays break minutes", () => {
    const s = watch(running(), 27);
    expect(s).toMatchObject({ phase: "break", cycle_index: 0, minutes_completed: 25, bonus_earned: 10 });
    const s2 = watch(s, 31);
    expect(s2).toMatchObject({ phase: "focus", cycle_index: 1, minutes_completed: 25 });
  });
  it("ending early keeps whole minutes, no bonus for the unfinished block", () => {
    const s = leave(watch(running(), 37), at(37, 40)); // block 1 done, 7m40s into block 2
    expect(s).toMatchObject({ phase: "ended", end_reason: "left", minutes_completed: 32, bonus_earned: 10 });
  });
  it("an early break keeps the minutes, drops the bonus, and resume starts the next block", () => {
    const b = takeBreak(watch(running(), 12), at(12, 30));
    expect(b.ok && b.session).toMatchObject({ phase: "break", minutes_completed: 12, bonus_earned: 0 });
    const r = b.ok ? resume(b.session, at(13)) : null;
    expect(r?.ok && r.session).toMatchObject({ phase: "focus", cycle_index: 1 });
    const last = takeBreak(watch(running(25, 5, 1), 10), at(10));
    expect(last.ok && last.session).toMatchObject({ phase: "ended", end_reason: "finished", minutes_completed: 10, bonus_earned: 0 });
  });
});

describe("5-minute grace (row 170)", () => {
  it("resumes the same block when the heartbeat comes back within grace", () => {
    const s = heartbeat(watch(running(), 10), at(14, 59)); // 4m59s gap
    expect(s).toMatchObject({ phase: "focus", cycle_index: 0 });
    expect(advance(heartbeat(heartbeat(s, at(19)), at(24)), at(26))).toMatchObject({ phase: "break", minutes_completed: 25, bonus_earned: 10 });
  });
  it("ends at the last heartbeat after grace, paying minutes up to it, no bonus", () => {
    const s = heartbeat(watch(running(), 10), at(10, 30));
    const late = advance(s, at(15, 31)); // 5m01s later
    expect(late).toMatchObject({ phase: "ended", end_reason: "timeout", ended_at: at(10, 30).toISOString(), minutes_completed: 10, bonus_earned: 0 });
    expect(heartbeat(s, at(40))).toMatchObject({ phase: "ended", minutes_completed: 10 });
  });
  it("still completes blocks that ended before the connection dropped", () => {
    const s = heartbeat(watch(running(), 25), at(26));
    expect(advance(s, at(60))).toMatchObject({ phase: "ended", end_reason: "timeout", minutes_completed: 25, bonus_earned: 10 });
  });
});

describe("seats and host lock", () => {
  it("refuses a taken seat and a second seat for the same member; sitting twice is idempotent", async () => {
    const m = memoryStudyStore();
    expect(await sit(m.store, A, { table_id: two, seat: 1 }, at(0))).toMatchObject({ ok: true });
    expect(await sit(m.store, A, { table_id: two, seat: 1 }, at(0))).toMatchObject({ ok: true });
    expect(await sit(m.store, B, { table_id: two, seat: 1 }, at(0))).toMatchObject({ ok: false, code: "seat_taken" });
    expect(await sit(m.store, A, { table_id: four, seat: 1 }, at(0))).toMatchObject({ ok: false, code: "already_seated" });
    expect(await sit(m.store, B, { table_id: two, seat: 3 }, at(0))).toMatchObject({ ok: false, code: "bad_seat" });
    expect(m.sessions.filter((s) => !s.ended_at)).toHaveLength(1);
  });
  it("catches a race at the store's unique seat constraint", async () => {
    const m = memoryStudyStore();
    const [x, y] = await Promise.all([sit(m.store, A, { table_id: two, seat: 2 }, at(0)), sit(m.store, B, { table_id: two, seat: 2 }, at(0))]);
    expect([x.ok, y.ok].filter(Boolean)).toHaveLength(1);
  });
  it("frees a seat whose sitter timed out and pays them", async () => {
    const m = memoryStudyStore();
    await sit(m.store, A, { table_id: two, seat: 1 }, at(0));
    await startSession(m.store, A, { focus_len: 25, break_len: 5, cycles: 4 }, at(0));
    for (let i = 1; i <= 8; i++) await beat(m.store, A, at(i));
    expect(await sit(m.store, B, { table_id: two, seat: 1 }, at(14))).toMatchObject({ ok: true });
    expect(m.coinsOf(A)).toBe(8);
  });
  it("lets the first sitter lock the table; locked tables read as occupied; the lock leaves with the host", async () => {
    const m = memoryStudyStore();
    await sit(m.store, A, { table_id: four, seat: 1 }, at(0));
    await sit(m.store, B, { table_id: four, seat: 2 }, at(1));
    expect(await lock(m.store, B, { table_id: four, is_private: true }, at(2))).toMatchObject({ ok: false, code: "not_host" });
    expect(await lock(m.store, A, { table_id: four, is_private: true, allowed: [C] }, at(2))).toMatchObject({ ok: true });
    const outsider = await getState(m.store, "00000000-0000-4000-8000-0000000000dd", at(3));
    const view = outsider.ok ? outsider.data.tables.find((t) => t.id === four)! : null;
    expect(view).toMatchObject({ is_private: true, can_join: false, taken: [1, 2, 3, 4], mates: [] });
    expect(await sit(m.store, "00000000-0000-4000-8000-0000000000dd", { table_id: four, seat: 3 }, at(3))).toMatchObject({ ok: false, code: "table_locked" });
    expect(await sit(m.store, C, { table_id: four, seat: 3 }, at(3))).toMatchObject({ ok: true });
    await endNow(m.store, A, at(4));
    expect(m.tables.find((t) => t.id === four)).toMatchObject({ host_id: B, is_private: false });
  });
});

describe("settlement is idempotent", () => {
  it("pays once however many times the end is retried", async () => {
    const m = memoryStudyStore();
    await sit(m.store, A, { table_id: two, seat: 1 }, at(0));
    await startSession(m.store, A, { focus_len: 25, break_len: 5, cycles: 1 }, at(0));
    for (let i = 1; i <= 25; i++) await beat(m.store, A, at(i));
    expect(m.coinsOf(A)).toBe(35); // finished at 25:00 and paid on that heartbeat
    expect(await beat(m.store, A, at(25, 10))).toMatchObject({ ok: false, code: "not_seated" });
    await endNow(m.store, A, at(26));
    await getState(m.store, A, at(27));
    const s = m.sessions[0];
    expect(await m.store.settle(s.id, A)).toEqual({ coins: 35, replayed: true });
    expect(m.coinsOf(A)).toBe(35);
  });
  it("breaks, resumes and leaving settle once with the early-end rule", async () => {
    const m = memoryStudyStore();
    await sit(m.store, A, { table_id: two, seat: 1 }, at(0));
    await startSession(m.store, A, { focus_len: 25, break_len: 5, cycles: 4 }, at(0));
    await beat(m.store, A, at(4));
    await breakNow(m.store, A, at(6));
    await resumeNow(m.store, A, at(7));
    await beat(m.store, A, at(11));
    const r = await endNow(m.store, A, at(13, 30));
    expect(r.ok && r.data.ended).toMatchObject({ end_reason: "left", minutes_completed: 12, coins_paid: 12 });
    expect(m.coinsOf(A)).toBe(12);
    expect(await endNow(m.store, A, at(14))).toMatchObject({ ok: false, code: "not_seated" });
  });
  it("refuses a second start and bad settings", async () => {
    const m = memoryStudyStore();
    await sit(m.store, A, { table_id: two, seat: 1 }, at(0));
    expect(await startSession(m.store, A, { focus_len: 3, break_len: 5, cycles: 1 }, at(0))).toMatchObject({ ok: false, code: "bad_settings" });
    await startSession(m.store, A, { focus_len: 25, break_len: 5, cycles: 1 }, at(0));
    expect(await startSession(m.store, A, { focus_len: 50, break_len: 5, cycles: 1 }, at(1))).toMatchObject({ ok: false, code: "started" });
  });
});

describe("presence, stats and board", () => {
  it("shows seat-mates with phase and remaining time", async () => {
    const m = memoryStudyStore();
    m.name(B, "Jordan");
    await sit(m.store, A, { table_id: four, seat: 1 }, at(0));
    await sit(m.store, B, { table_id: four, seat: 2 }, at(0));
    await startSession(m.store, B, { focus_len: 50, break_len: 10, cycles: 2 }, at(0));
    for (const t of [4, 8, 12, 16, 20]) for (const who of [A, B]) await beat(m.store, who, at(t));
    const r = await getState(m.store, A, at(20));
    expect(r.ok && r.data.table?.mates.find((x) => x.member_id === B)).toMatchObject({ name: "Jordan", phase: "focus", remaining_s: 30 * 60, is_host: false });
  });
  it("sums this week's minutes and longest block; the board lists opt-ins only", async () => {
    const m = memoryStudyStore();
    for (const [who, mins] of [[A, 25], [B, 50], [C, 10]] as const) {
      const seat = who === A ? 1 : who === B ? 2 : 3;
      await sit(m.store, who, { table_id: four, seat }, at(0));
      await startSession(m.store, who, { focus_len: mins === 10 ? 25 : mins, break_len: 5, cycles: 1 }, at(0));
      for (let i = 1; i <= mins; i++) await beat(m.store, who, at(i));
      await endNow(m.store, who, at(mins, 5));
    }
    expect(await myStats(m.store, B, at(60))).toMatchObject({ ok: true, data: { minutes: 50, longest_block: 50, sessions: 1, on_board: false } });
    await m.store.setBoardOptIn(A, true);
    await m.store.setBoardOptIn(C, true);
    const b = await board(m.store, at(60));
    expect(b.ok && b.data.top.map((x) => [x.rank, x.minutes])).toEqual([[1, 25], [2, 10]]);
    expect(topStudiers([{ member_id: "x", minutes: 0, longest_block: 0, sessions: 1 }], new Set(["x"]), new Map())).toEqual([]);
  });
});

describe("shared hook plumbing", () => {
  it("formats the countdown", async () => {
    const { formatClock } = await import("./useStudySession");
    expect([formatClock(1500), formatClock(59), formatClock(null)]).toEqual(["25:00", "00:59", "--:--"]);
  });
  it("demo scenarios land in the phase they claim (same service as the API)", async () => {
    const { studyDemo } = await import("./demo");
    const focus = await (await studyDemo("focus")).state();
    expect(focus.session).toMatchObject({ phase: "focus", cycle: 1 });
    expect(focus.session!.remaining_s).toBeGreaterThan(12 * 60);
    expect(focus.table?.mates.map((x) => [x.name, x.phase])).toEqual(expect.arrayContaining([["Maya Chen", "focus"], ["Jordan Park", "break"], ["Priya Shah", "seated"]]));
    expect((await (await studyDemo("break")).state()).session).toMatchObject({ phase: "break", cycle: 1, minutes_completed: 25 });
    const ended = await studyDemo("ended");
    expect((await ended.state()).session).toBeNull();
    expect(await ended.stats()).toMatchObject({ minutes: 25, longest_block: 25, on_board: true });
  });
});

describe("table chat (row 77)", () => {
  it("is for seated members, filtered, length- and rate-limited, and reportable", async () => {
    const { postChat, readChat, reportChat } = await import("./chat");
    const m = memoryStudyStore();
    m.name(B, "Jordan");
    expect(await postChat(m.store, A, "hi", at(0))).toMatchObject({ ok: false, code: "not_seated" });
    await sit(m.store, A, { table_id: four, seat: 1 }, at(0));
    await sit(m.store, B, { table_id: four, seat: 2 }, at(0));
    await sit(m.store, C, { table_id: two, seat: 1 }, at(0));
    expect(await postChat(m.store, A, "   ", at(0))).toMatchObject({ ok: false, code: "empty" });
    expect(await postChat(m.store, A, "x".repeat(201), at(0))).toMatchObject({ ok: false, code: "too_long" });
    expect(await postChat(m.store, A, "what the fuck", at(0))).toMatchObject({ ok: false, code: "profanity" });
    const r = await postChat(m.store, B, "  break at :25?  ", at(0));
    expect(r.ok && r.data).toEqual([expect.objectContaining({ name: "Jordan", body: "break at :25?", mine: true })]);
    expect((await readChat(m.store, C, at(0))).ok && (await readChat(m.store, C, at(0)))).toMatchObject({ ok: true, data: [] }); // other table
    for (let i = 0; i < 6; i++) await postChat(m.store, A, `msg ${i}`, at(0));
    expect(await postChat(m.store, A, "one more", at(0))).toMatchObject({ ok: false, code: "rate_limited" });
    const jordans = m.chat[0].id;
    const after = await reportChat(m.store, A, jordans, "rude", at(0));
    expect(after.ok && after.data.some((x) => x.id === jordans)).toBe(false);
    expect(m.chat[0]).toMatchObject({ reported: true, reported_by: A });
    const forB = await readChat(m.store, B, at(0));
    expect(forB.ok && forB.data.some((x) => x.id === jordans)).toBe(true);
  });
});

describe("seed", () => {
  it("DEFAULT_TABLES mirror 20260926150500_study.sql's study_tables seed", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20260926150500_study.sql"), "utf8");
    const rows = DEFAULT_TABLES.map((t) => `  ('${t.id}', '${t.slug}', '${t.label}', '${t.location}', '${t.anchor}', '${t.kind}', ${t.seats}, ${t.position})`);
    expect(sql).toContain(["INSERT INTO study_tables (id, slug, label, location, anchor, kind, seats, position) VALUES", rows.join(",\n"), "ON CONFLICT (slug) DO NOTHING;"].join("\n"));
  });
});

describe("the café gate (row 177)", () => {
  const cafe = DEFAULT_TABLES.filter((t) => t.location === "cafe");
  const outdoor = DEFAULT_TABLES.filter((t) => t.location !== "cafe");
  it("keeps café seats shut until the chapter 2 goal opens the café; outdoor tables stay open", async () => {
    const m = memoryStudyStore(DEFAULT_TABLES, { cafeOpen: false });
    for (const t of cafe) expect(await sit(m.store, A, { table_id: t.id, seat: 1 }, at(0)), t.slug).toMatchObject({ ok: false, status: 403, code: "cafe_closed" });
    const closed = await getState(m.store, A, at(0));
    expect(closed.ok && closed.data.tables.filter((t) => t.location === "cafe").map((t) => [t.closed, t.can_join])).toEqual(cafe.map(() => [true, false]));
    expect(closed.ok && closed.data.tables.filter((t) => t.location !== "cafe").map((t) => [t.closed, t.can_join])).toEqual(outdoor.map(() => [false, true]));
    expect(await sit(m.store, A, { table_id: outdoor[0].id, seat: 1 }, at(0))).toMatchObject({ ok: true });
  });
  it("opens every café seat once the goal completes", async () => {
    const m = memoryStudyStore(DEFAULT_TABLES, { cafeOpen: false });
    m.setCafeOpen(true);
    expect(await sit(m.store, A, { table_id: cafe[0].id, seat: 1 }, at(0))).toMatchObject({ ok: true });
    const open = await getState(m.store, B, at(0));
    expect(open.ok && open.data.tables.every((t) => !t.closed)).toBe(true);
  });
});
