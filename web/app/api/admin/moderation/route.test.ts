import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const mock = vi.hoisted(() => ({ ctx: null as unknown, tables: {} as Record<string, Row[]>, notices: [] as unknown[][] }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
  withStore: async (make: (db: unknown) => unknown) => ({ ...(mock.ctx as object), store: make((mock.ctx as { db: unknown }).db) }),
}));
vi.mock("@/lib/server/realtimeNotify", () => ({
  notifyRealtime: async (...args: unknown[]) => (mock.notices.push(args), "applied"),
}));

import { GET, POST } from "./route";
import { POST as moderateName } from "../../identity/moderate/route";

// Enough of the query builder for the queue: filters, update + select, upsert, insert.
function from(table: string) {
  const rows = (mock.tables[table] ??= []);
  const tests: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const hit = () => rows.filter((r) => tests.every((t) => t(r)));
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (tests.push((r) => r[c] === v), b),
    gt: (c: string, v: string) => (tests.push((r) => typeof r[c] === "string" && (r[c] as string) > v), b),
    in: (c: string, vs: unknown[]) => (tests.push((r) => vs.includes(r[c])), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: hit()[0] ?? null, error: null }),
    update: (p: Row) => ((patch = p), b),
    upsert: async (row: Row) => {
      const at = rows.findIndex((r) => r.member_id === row.member_id);
      if (at >= 0) Object.assign(rows[at], row);
      else rows.push(row);
      return { error: null };
    },
    insert: async (row: Row) => (rows.push({ created_at: "2026-09-27T12:00:00Z", ...row }), { error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => {
      const matched = hit();
      if (patch) matched.forEach((r) => Object.assign(r, patch));
      resolve({ data: matched.map((r) => ({ ...r })), error: null });
    },
  };
  return b;
}
const NOTE = "00000000-0000-4000-8000-0000000000c1";
const CHAT = "00000000-0000-4000-8000-0000000000c2";
const AUTHOR = "00000000-0000-4000-8000-0000000000a9";
const post = (body: unknown) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));

const REPORT = "00000000-0000-4000-8000-0000000000d1";
const REPORT2 = "00000000-0000-4000-8000-0000000000d2";
const REPORT3 = "00000000-0000-4000-8000-0000000000d3";
const LINE = "00000000-0000-4000-8000-0000000000e1";
const REPORTER = "00000000-0000-4000-8000-0000000000b1";
const CONTEXT = [{ id: LINE, member_id: AUTHOR, world_name: "Ash", area: "cafe", body: "mean words", created_at: "2026-09-27T09:59:00Z" }];

beforeEach(() => {
  mock.tables = {
    letters: [{ id: NOTE, sender_id: AUTHOR, recipient_id: "r", body: "rude", reported: true, hidden: false, reported_at: "2026-09-27T10:00:00Z" }],
    study_chat_messages: [{ id: CHAT, member_id: AUTHOR, reported_by: "r", body: "spam", reported: true, hidden: false, reported_at: "2026-09-27T10:00:00Z" }],
    world_chat_messages: [{ id: LINE, member_id: AUTHOR, world_name: "Ash", body: "mean words", area: "cafe", created_at: "2026-09-27T09:59:00Z", hidden: false, reported: true }],
    world_reports: [
      { id: REPORT, reporter_id: REPORTER, target_id: AUTHOR, line_id: LINE, room_id: "Ab3_x9", shard: 1, reason: "harassment", context: CONTEXT, status: "open", created_at: "2026-09-27T10:01:00Z" },
      { id: REPORT2, reporter_id: "r", target_id: AUTHOR, line_id: LINE, room_id: "Ab3_x9", shard: 1, reason: "same line", context: CONTEXT, status: "open", created_at: "2026-09-27T10:02:00Z" },
      { id: REPORT3, reporter_id: REPORTER, target_id: AUTHOR, line_id: null, room_id: null, shard: null, reason: "their name", context: [], status: "open", created_at: "2026-09-27T10:03:00Z" },
    ],
    profiles: [], member_identity: [{ member_id: AUTHOR, world_name: "Ash" }], moderation_log: [], identity_reports: [],
  };
  mock.notices = [];
  mock.ctx = { userId: "admin", tier: 2, now: new Date("2026-09-27T12:00:00Z"), db: { from } };
});

describe("/api/admin/moderation", () => {
  it("lists open reports of notes and table chat", async () => {
    const body = await (await GET()).json();
    expect(body.letters.map((r: Row) => r.id)).toEqual([NOTE]);
    expect(body.chat.map((r: Row) => r.id)).toEqual([CHAT]);
  });
  it("removes (hides), removes and mutes 7 days, or dismisses", async () => {
    expect((await post({ kind: "letter", id: NOTE, action: "remove_mute" })).status).toBe(200);
    expect(mock.tables.letters[0]).toMatchObject({ hidden: true, reported: true });
    expect(mock.tables.member_identity).toEqual([{ member_id: AUTHOR, world_name: "Ash", muted_until: "2026-10-04T12:00:00.000Z" }]);
    expect(mock.notices).toEqual([["/internal/sanction", { member_id: AUTHOR, muted_until: "2026-10-04T12:00:00.000Z" }]]); // world chat too
    expect((await post({ kind: "chat", id: CHAT, action: "dismiss" })).status).toBe(200);
    expect(mock.tables.study_chat_messages[0]).toMatchObject({ hidden: false, reported: false });
    expect((await post({ kind: "chat", id: CHAT, action: "remove" })).status).toBe(404);
    expect((await (await GET()).json())).toMatchObject({ letters: [], chat: [] });
  });
  it("logs who did what to which item, readable in the queue", async () => {
    await post({ kind: "letter", id: NOTE, action: "remove_mute" });
    await post({ kind: "chat", id: CHAT, action: "dismiss" });
    expect(mock.tables.moderation_log).toEqual([
      expect.objectContaining({ actor_id: "admin", action: "remove_mute", item_kind: "letter", item_id: NOTE, target_id: AUTHOR, excerpt: "rude" }),
      expect.objectContaining({ actor_id: "admin", action: "dismiss", item_kind: "chat", item_id: CHAT, target_id: AUTHOR, excerpt: "spam" }),
    ]);
    const body = await (await GET()).json();
    expect(body.log.map((e: Row) => e.action)).toEqual(["remove_mute", "dismiss"]);
    expect(body.muted.map((w: Row) => w.id)).toEqual([AUTHOR]);
  });
  it("unmutes a member, and logs it", async () => {
    await post({ kind: "letter", id: NOTE, action: "remove_mute" });
    const res = await moderateName(new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ member_id: AUTHOR, action: "unmute" }) }));
    expect(res.status).toBe(200);
    expect(mock.tables.member_identity[0]).toMatchObject({ member_id: AUTHOR, muted_until: null });
    expect(mock.tables.moderation_log.at(-1)).toMatchObject({ actor_id: "admin", action: "unmute", item_kind: "member", target_id: AUTHOR });
  });
  it("validates the body", async () => {
    for (const body of [{}, { kind: "name", id: NOTE, action: "remove" }, { kind: "letter", id: "x", action: "remove" }, { kind: "letter", id: NOTE, action: "ban" }, { kind: "world", id: REPORT, action: "remove_world" }]) {
      expect((await post(body)).status).toBe(400);
    }
  });
  it("is T1/T2 only, checked on the server", async () => {
    for (const tier of [3, 4, 5]) {
      mock.ctx = { userId: "exec", tier, now: new Date("2026-09-27T12:00:00Z"), db: { from } };
      expect((await GET()).status).toBe(403);
      expect((await post({ kind: "world", id: REPORT, action: "dismiss" })).status).toBe(403);
    }
    expect(mock.tables.world_reports.every((r) => r.status === "open")).toBe(true);
  });
});

describe("/api/admin/moderation: world chat", () => {
  it("lists open world reports with the line, the context, world names and who's removed", async () => {
    mock.tables.member_identity.push({ member_id: REPORTER, world_name: "Fern", removed_until: "2026-09-30T00:00:00Z" });
    const body = await (await GET()).json();
    expect(body.world.map((r: Row) => r.id)).toEqual([REPORT, REPORT2, REPORT3]);
    expect(body.world[0]).toEqual({
      id: REPORT, reason: "harassment", created_at: "2026-09-27T10:01:00Z", shard: 1, room_id: "Ab3_x9",
      line: { id: LINE, body: "mean words", area: "cafe", created_at: "2026-09-27T09:59:00Z", hidden: false },
      context: CONTEXT,
      target: expect.objectContaining({ id: AUTHOR, world_name: "Ash" }),
      reporter: expect.objectContaining({ id: REPORTER, world_name: "Fern", removed_until: "2026-09-30T00:00:00Z" }),
    });
    expect(body.world[2].line).toBeNull();
    expect(body.removed.map((w: Row) => w.id)).toEqual([REPORTER]);
  });
  it("still loads the rest before the world chat migration", async () => {
    // No world_reports table, no removed_until column.
    const missing: Record<string, unknown> = { then: (res: (v: unknown) => void) => res({ data: null, error: { code: "42P01" } }) };
    for (const k of ["select", "eq", "gt", "in", "order", "limit"]) missing[k] = () => missing;
    const db = { from: (t: string) => (t === "world_reports" ? missing : from(t)) };
    mock.ctx = { userId: "admin", tier: 2, now: new Date("2026-09-27T12:00:00Z"), db };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ world: [], letters: [expect.objectContaining({ id: NOTE })] });
  });
  it("remove and mute: hides the line, closes its reports, mutes 7 days in the island too, logs world_chat", async () => {
    const res = await post({ kind: "world", id: REPORT, action: "remove_mute" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, moderation: { kind: "world", id: REPORT, action: "remove_mute", muted_until: "2026-10-04T12:00:00.000Z", realtime: "applied" } });
    expect(mock.tables.world_chat_messages[0]).toMatchObject({ hidden: true });
    expect(mock.tables.world_reports.map((r) => r.status)).toEqual(["actioned", "actioned", "open"]);
    expect(mock.tables.world_reports[0]).toMatchObject({ resolved_by: "admin", resolved_at: "2026-09-27T12:00:00.000Z" });
    expect(mock.tables.member_identity[0]).toMatchObject({ member_id: AUTHOR, muted_until: "2026-10-04T12:00:00.000Z" });
    expect(mock.notices).toEqual([["/internal/sanction", { member_id: AUTHOR, muted_until: "2026-10-04T12:00:00.000Z" }]]);
    expect(mock.tables.moderation_log).toEqual([expect.objectContaining({ actor_id: "admin", action: "remove_mute", item_kind: "world_chat", item_id: REPORT, target_id: AUTHOR, excerpt: "mean words" })]);
    expect((await post({ kind: "world", id: REPORT2, action: "dismiss" })).status).toBe(404); // closed with it
  });
  it("dismiss keeps the line; a roster report has its reason as the excerpt; closed reports 404", async () => {
    expect((await post({ kind: "world", id: REPORT, action: "dismiss" })).status).toBe(200);
    expect(mock.tables.world_chat_messages[0]).toMatchObject({ hidden: false });
    expect(mock.tables.world_reports[0]).toMatchObject({ status: "dismissed" });
    expect(mock.notices).toEqual([]);
    expect((await post({ kind: "world", id: REPORT3, action: "remove" })).status).toBe(200);
    expect(mock.tables.moderation_log.at(-1)).toMatchObject({ action: "remove", item_kind: "world_chat", item_id: REPORT3, excerpt: "their name" });
    expect((await post({ kind: "world", id: REPORT3, action: "remove" })).status).toBe(404);
    expect((await post({ kind: "world", id: "00000000-0000-4000-8000-0000000000ff", action: "remove" })).status).toBe(404);
  });
});
