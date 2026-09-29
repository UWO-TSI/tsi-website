import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const mock = vi.hoisted(() => ({ ctx: null as unknown, tables: {} as Record<string, Row[]> }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));

import { GET, POST } from "./route";

// Enough of the query builder for the queue: filters, update + select, upsert.
function from(table: string) {
  const rows = (mock.tables[table] ??= []);
  const eqs: [string, unknown][] = [];
  let patch: Row | null = null;
  const hit = () => rows.filter((r) => eqs.every(([c, v]) => r[c] === v));
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (eqs.push([c, v]), b),
    in: () => b,
    order: () => b,
    limit: () => b,
    update: (p: Row) => ((patch = p), b),
    upsert: async (row: Row) => (rows.push(row), { error: null }),
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

beforeEach(() => {
  mock.tables = {
    letters: [{ id: NOTE, sender_id: AUTHOR, recipient_id: "r", body: "rude", reported: true, hidden: false, reported_at: "2026-09-27T10:00:00Z" }],
    study_chat_messages: [{ id: CHAT, member_id: AUTHOR, reported_by: "r", body: "spam", reported: true, hidden: false, reported_at: "2026-09-27T10:00:00Z" }],
    profiles: [], member_identity: [],
  };
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
    expect(mock.tables.member_identity).toEqual([{ member_id: AUTHOR, muted_until: "2026-10-04T12:00:00.000Z" }]);
    expect((await post({ kind: "chat", id: CHAT, action: "dismiss" })).status).toBe(200);
    expect(mock.tables.study_chat_messages[0]).toMatchObject({ hidden: false, reported: false });
    expect((await post({ kind: "chat", id: CHAT, action: "remove" })).status).toBe(404);
    expect((await (await GET()).json())).toMatchObject({ letters: [], chat: [] });
  });
  it("validates the body", async () => {
    for (const body of [{}, { kind: "name", id: NOTE, action: "remove" }, { kind: "letter", id: "x", action: "remove" }, { kind: "letter", id: NOTE, action: "ban" }]) {
      expect((await post(body)).status).toBe(400);
    }
  });
});
