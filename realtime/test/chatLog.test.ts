// specs/multiplayer.md §6 "Log": lines go to the database in one batch every 2 s; with the
// database down the queue stays bounded, retries back off, and pushing never waits.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatLog, type ChatLogRow } from "../src/chatLog";

let n = 0;
const row = (body = `line ${n}`): ChatLogRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  shard: 1,
  room_id: "room",
  area: "village",
  member_id: "11111111-2222-4333-8444-555555555555",
  world_name: "Maple",
  body,
  created_at: new Date(1_791_000_000_000 + n).toISOString(),
});

afterEach(() => vi.useRealTimers());

describe("chat log", () => {
  it("writes everything queued in one batch every 2 s", async () => {
    vi.useFakeTimers();
    const batches: ChatLogRow[][] = [];
    const log = createChatLog({ write: async (rows) => void batches.push(rows), log: () => {}, now: () => Date.now() });
    log.start();
    const a = row(), b = row(), c = row();
    log.push(a);
    log.push(b);
    await vi.advanceTimersByTimeAsync(1999);
    expect(batches).toEqual([]);
    log.push(c);
    await vi.advanceTimersByTimeAsync(1);
    expect(batches).toEqual([[a, b, c]]);
    expect(log.size).toBe(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(batches).toHaveLength(1); // nothing queued: no writes
    await log.stop();
  });

  it("caps a write at the batch size; the rest go next time", async () => {
    const batches: ChatLogRow[][] = [];
    const log = createChatLog({ write: async (rows) => void batches.push(rows), log: () => {}, batch: 3 });
    const rows = Array.from({ length: 7 }, () => row());
    rows.forEach((r) => log.push(r));
    await log.flush();
    await log.flush();
    await log.flush();
    expect(batches.map((b) => b.length)).toEqual([3, 3, 1]);
    expect(batches.flat()).toEqual(rows);
  });

  it("while the database is down: pushes never wait, the queue stays bounded, retries back off, then it all catches up", async () => {
    let t = 0;
    let down = true;
    const written: ChatLogRow[] = [];
    const events: string[] = [];
    const write = vi.fn(async (rows: ChatLogRow[]) => {
      if (down) throw new Error("fetch failed");
      written.push(...rows);
    });
    const log = createChatLog({ write, log: (e) => events.push(e), now: () => t, max: 5, batch: 10, flushMs: 2000, maxBackoffMs: 30_000 });
    const rows = Array.from({ length: 8 }, () => row());
    const pushStarted = performance.now();
    for (const r of rows) log.push(r);
    expect(performance.now() - pushStarted).toBeLessThan(20);
    expect(log.size).toBe(5);
    expect(log.dropped).toBe(3);
    expect(events).toContain("chat_log_dropping");

    await log.flush(); // fails: retry after 4 s
    expect(write).toHaveBeenCalledTimes(1);
    expect(events).toContain("chat_log_failed");
    t = 3999;
    await log.flush();
    expect(write).toHaveBeenCalledTimes(1); // still backing off
    t = 4000;
    await log.flush(); // fails again: 8 s
    t = 11_999;
    await log.flush();
    expect(write).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 6; i++) {
      t += 30_000;
      await log.flush(); // the backoff stops growing at 30 s
    }
    expect(write).toHaveBeenCalledTimes(8);
    expect(log.size).toBe(5); // nothing lost beyond the bound

    down = false;
    t += 30_000;
    await log.flush();
    expect(written).toEqual(rows.slice(3)); // the newest 5, in order
    expect(log.size).toBe(0);
    expect(events).toContain("chat_log_recovered");
  });

  it("a hung write is aborted at the timeout and retried", async () => {
    vi.useFakeTimers();
    let aborted = false;
    let hang = true;
    const written: ChatLogRow[] = [];
    const write = (rows: ChatLogRow[], signal: AbortSignal) =>
      hang
        ? new Promise<void>((_, reject) => signal.addEventListener("abort", () => ((aborted = true), reject(new Error("aborted")))))
        : Promise.resolve(void written.push(...rows));
    const log = createChatLog({ write, log: () => {}, timeoutMs: 5000, now: () => Date.now() });
    const r = row();
    log.push(r);
    const first = log.flush();
    await vi.advanceTimersByTimeAsync(5000);
    await first;
    expect(aborted).toBe(true);
    expect(log.size).toBe(1);
    hang = false;
    await vi.advanceTimersByTimeAsync(4000);
    await log.flush();
    expect(written).toEqual([r]);
  });

  it("lines pushed while a write is out wait for the next one", async () => {
    let release!: () => void;
    const batches: ChatLogRow[][] = [];
    const log = createChatLog({ write: (rows) => new Promise<void>((res) => { release = () => { batches.push(rows); res(); }; }), log: () => {} });
    const a = row(), b = row();
    log.push(a);
    const out = log.flush();
    log.push(b);
    await log.flush(); // one write at a time: this one does nothing
    release();
    await out;
    expect(log.size).toBe(1);
    const next = log.flush();
    release();
    await next;
    expect(batches).toEqual([[a], [b]]);
  });

  it("stop writes what's left", async () => {
    const batches: ChatLogRow[][] = [];
    const log = createChatLog({ write: async (rows) => void batches.push(rows), log: () => {} });
    log.start();
    const r = row();
    log.push(r);
    await log.stop();
    expect(batches).toEqual([[r]]);
  });
});
