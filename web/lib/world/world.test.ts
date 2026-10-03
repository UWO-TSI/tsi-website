import { describe, expect, it } from "vitest";
import { memoryWorldStore } from "./memoryStore";
import { REPORT_CONTEXT, REPORTS_PER_HOUR, blockPlayer, listBlocks, reportWorld, unblockPlayer } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const C = "00000000-0000-4000-8000-0000000000cc";
const now = new Date("2026-10-03T16:00:00Z");
const at = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
const lineId = (n: number) => `00000000-0000-4000-8000-1000000${String(n).padStart(5, "0")}`;

function setup() {
  const m = memoryWorldStore(() => now);
  m.member(A, "Maple");
  m.member(B, "Birch");
  m.member(C, null);
  return m;
}

describe("reports", () => {
  it("a line: the author is the target, the room's last 20 lines the context (oldest first), the line marked", async () => {
    const m = setup();
    for (let i = 0; i < 25; i++) m.say({ id: lineId(i), member_id: i % 2 ? A : B, body: `line ${i}`, created_at: at(100 - i) });
    m.say({ id: lineId(99), member_id: C, body: "other room", created_at: at(1), room_id: "room-b" });
    const r = await reportWorld(m.store, A, { line_id: lineId(24), reason: "rude" }, now);
    expect(r).toEqual({ ok: true, data: { id: expect.any(String) } });
    const rep = m.reports[0];
    expect(rep).toMatchObject({ reporter_id: A, target_id: B, line_id: lineId(24), room_id: "room-a", shard: 1, reason: "rude", status: "open" });
    expect(rep.context).toHaveLength(REPORT_CONTEXT);
    expect(rep.context.map((c) => c.body)).toEqual(Array.from({ length: 20 }, (_, i) => `line ${i + 5}`));
    expect(rep.context[0]).toEqual({ id: lineId(5), member_id: A, world_name: "Maple", area: "village", body: "line 5", created_at: at(95) });
    expect(m.lines.find((l) => l.id === lineId(24))!.reported).toBe(true);
  });

  it("an older line: the 20 lines up to it", async () => {
    const m = setup();
    for (let i = 0; i < 40; i++) m.say({ id: lineId(i), member_id: B, body: `line ${i}`, created_at: at(100 - i) });
    await reportWorld(m.store, A, { line_id: lineId(3), reason: "rude" }, now);
    expect(m.reports[0].context.map((c) => c.body)).toEqual(["line 0", "line 1", "line 2", "line 3"]);
    // A line among the room's last 20: those 20, what came after it included.
    await reportWorld(m.store, A, { line_id: lineId(30), reason: "rude" }, now);
    expect(m.reports[1].context.map((c) => c.body)).toEqual(Array.from({ length: 20 }, (_, i) => `line ${i + 20}`));
  });

  it("a player from the roster: your room's chat, else the room they last spoke in, else none", async () => {
    const m = setup();
    m.say({ id: lineId(1), member_id: B, body: "in b", created_at: at(50), room_id: "room-b" });
    m.say({ id: lineId(2), member_id: A, body: "in a", created_at: at(40), room_id: "room-a" });
    await reportWorld(m.store, A, { member_id: B, room_id: "room-a", reason: "name" }, now);
    expect(m.reports[0]).toMatchObject({ target_id: B, line_id: null, room_id: "room-a", shard: null });
    expect(m.reports[0].context.map((c) => c.body)).toEqual(["in a"]);
    await reportWorld(m.store, A, { member_id: B, reason: "name" }, now);
    expect(m.reports[1]).toMatchObject({ room_id: "room-b" });
    await reportWorld(m.store, B, { member_id: C, reason: "silent" }, now);
    expect(m.reports[2]).toMatchObject({ room_id: null, context: [] });
  });

  it("refuses yourself, unknown lines and players, a line whose author is gone", async () => {
    const m = setup();
    m.say({ id: lineId(1), member_id: A, body: "mine", created_at: at(5) });
    m.say({ id: lineId(2), member_id: null, body: "gone", created_at: at(4) });
    expect(await reportWorld(m.store, A, { line_id: lineId(1), reason: "x" }, now)).toMatchObject({ ok: false, status: 400, code: "invalid" });
    expect(await reportWorld(m.store, A, { member_id: A, reason: "x" }, now)).toMatchObject({ ok: false, status: 400 });
    expect(await reportWorld(m.store, A, { line_id: lineId(9), reason: "x" }, now)).toMatchObject({ ok: false, status: 404, code: "not_found" });
    expect(await reportWorld(m.store, A, { line_id: lineId(2), reason: "x" }, now)).toMatchObject({ ok: false, status: 404 });
    expect(await reportWorld(m.store, A, { member_id: "00000000-0000-4000-8000-0000000000ee", reason: "x" }, now)).toMatchObject({ ok: false, status: 404 });
    expect(m.reports).toEqual([]);
  });

  it(`at most ${REPORTS_PER_HOUR} an hour; the same line twice is the same report`, async () => {
    const m = setup();
    for (let i = 0; i < 6; i++) m.say({ id: lineId(i), member_id: B, body: `l${i}`, created_at: at(60 - i) });
    const first = await reportWorld(m.store, A, { line_id: lineId(0), reason: "x" }, now);
    expect(await reportWorld(m.store, A, { line_id: lineId(0), reason: "again" }, now)).toEqual(first);
    for (let i = 1; i < REPORTS_PER_HOUR; i++) expect((await reportWorld(m.store, A, { line_id: lineId(i), reason: "x" }, now)).ok).toBe(true);
    expect(await reportWorld(m.store, A, { line_id: lineId(5), reason: "x" }, now)).toMatchObject({ ok: false, status: 429, code: "rate_limited" });
    expect(await reportWorld(m.store, A, { line_id: lineId(5), reason: "x" }, new Date(now.getTime() + 3_600_001))).toMatchObject({ ok: true });
    expect((await reportWorld(m.store, C, { line_id: lineId(5), reason: "x" }, now)).ok).toBe(true); // someone else's quota
  });
});

describe("blocks", () => {
  it("block, list with world names, block again, unblock", async () => {
    const m = setup();
    expect(await listBlocks(m.store, A)).toEqual({ ok: true, data: [] });
    expect(await blockPlayer(m.store, A, B)).toEqual({ ok: true, data: [{ member_id: B, world_name: "Birch", created_at: expect.any(String) }] });
    const both = await blockPlayer(m.store, A, C);
    expect(both.ok && both.data.map((b) => [b.member_id, b.world_name])).toEqual([[C, "Islander"], [B, "Birch"]]);
    expect((await blockPlayer(m.store, A, B)).ok).toBe(true);
    expect(m.blocks).toHaveLength(2);
    expect(await listBlocks(m.store, B)).toEqual({ ok: true, data: [] }); // B can't see A's block
    const after = await unblockPlayer(m.store, A, B);
    expect(after.ok && after.data.map((b) => b.member_id)).toEqual([C]);
    expect((await unblockPlayer(m.store, A, B)).ok).toBe(true);
  });

  it("refuses yourself and unknown players", async () => {
    const m = setup();
    expect(await blockPlayer(m.store, A, A)).toMatchObject({ ok: false, status: 400 });
    expect(await blockPlayer(m.store, A, "00000000-0000-4000-8000-0000000000ee")).toMatchObject({ ok: false, status: 404 });
  });
});
