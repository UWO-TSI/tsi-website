/** POST /api/identity/moderate: world removal and restore (multiplayer M2 §2.3), and mutes reaching the island. */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const mock = vi.hoisted(() => ({
  ctx: null as unknown,
  tables: {} as Record<string, Row[]>,
  rpcs: [] as [string, Row][],
  rpc: { data: null as unknown, error: null as { message: string } | null },
  notices: [] as unknown[][],
}));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
  withStore: async (make: (db: unknown) => unknown) => ({ ...(mock.ctx as object), store: make((mock.ctx as { db: unknown }).db) }),
}));
vi.mock("@/lib/server/realtimeNotify", () => ({
  notifyRealtime: async (...args: unknown[]) => (mock.notices.push(args), "applied"),
}));

import { POST } from "./route";

function from(table: string) {
  const rows = (mock.tables[table] ??= []);
  const eqs: [string, unknown][] = [];
  const hit = () => rows.filter((r) => eqs.every(([c, v]) => r[c] === v));
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (eqs.push([c, v]), b),
    maybeSingle: async () => ({ data: hit()[0] ?? null, error: null }),
    update: () => b,
    upsert: async (row: Row) => {
      const at = rows.findIndex((r) => r.member_id === row.member_id);
      if (at >= 0) Object.assign(rows[at], row);
      else rows.push(row);
      return { error: null };
    },
    insert: async (row: Row) => (rows.push(row), { error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: hit(), error: null }),
  };
  return b;
}
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const M = "00000000-0000-4000-8000-0000000000aa";
const UNTIL = "2026-10-06T16:00:00.123456+00:00";
const db = { from, rpc: async (fn: string, args: Row) => (mock.rpcs.push([fn, args]), mock.rpc) };
const as = (tier: number) => (mock.ctx = { userId: ADMIN, tier, now: new Date("2026-10-03T16:00:00Z"), db });
const post = async (body: unknown) => {
  const res = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  mock.tables = { member_identity: [{ member_id: M, world_name: "Ash" }], moderation_log: [], identity_reports: [] };
  mock.rpcs = [];
  mock.notices = [];
  mock.rpc = { data: { member_id: M, muted_until: null, removed_until: UNTIL }, error: null };
  as(2);
});

describe("POST /api/identity/moderate: remove and restore", () => {
  it("removes through realtime_sanction (the audit row comes with it) and tells the island", async () => {
    const r = await post({ member_id: M, action: "remove", days: 3 });
    expect(r).toEqual({ status: 200, body: { ok: true, moderation: { action: "remove", removed_until: UNTIL, realtime: "applied" } } });
    expect(mock.rpcs).toEqual([["realtime_sanction", { p_actor: ADMIN, p_member: M, p_action: "remove", p_days: 3 }]]);
    expect(mock.notices).toEqual([["/internal/sanction", { member_id: M, removed_until: UNTIL }]]);
    expect(mock.tables.moderation_log).toEqual([]); // written by the function, not twice
  });

  it("removes for 7 days by default; restore clears it", async () => {
    await post({ member_id: M, action: "remove" });
    expect(mock.rpcs[0][1]).toMatchObject({ p_days: 7 });
    mock.rpc = { data: { member_id: M, muted_until: null, removed_until: null }, error: null };
    const r = await post({ member_id: M, action: "restore" });
    expect(r.body).toEqual({ ok: true, moderation: { action: "restore", removed_until: null, realtime: "applied" } });
    expect(mock.rpcs[1][1]).toMatchObject({ p_action: "restore", p_days: null });
    expect(mock.notices.at(-1)).toEqual(["/internal/sanction", { member_id: M, removed_until: null }]);
  });

  it("maps the function's refusals and tells nobody", async () => {
    for (const [message, status] of [["forbidden", 403], ["not_found", 404], ["self", 400], ["staff", 409], ["invalid", 400], ["connection reset", 500]] as const) {
      mock.rpc = { data: null, error: { message } };
      expect((await post({ member_id: M, action: "remove" })).status, message).toBe(status);
    }
    expect(mock.notices).toEqual([]);
  });

  it("is T1/T2 only, before anything is called", async () => {
    for (const tier of [3, 4, 5]) {
      as(tier);
      expect((await post({ member_id: M, action: "remove" })).status).toBe(403);
    }
    expect(mock.rpcs).toEqual([]);
  });

  it("validates", async () => {
    for (const body of [{ member_id: M, action: "ban" }, { member_id: M, action: "remove", days: 0 }, { member_id: M, action: "remove", days: 366 }, { member_id: M, action: "remove", days: 1.5 }, { member_id: "x", action: "remove" }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(mock.rpcs).toEqual([]);
  });
});

describe("POST /api/identity/moderate: mutes reach the island", () => {
  it("mute and unmute: as before, plus the realtime notice", async () => {
    const r = await post({ member_id: M, action: "mute" });
    expect(r.body).toEqual({ ok: true, moderation: { action: "mute", muted_until: "2026-10-10T16:00:00.000Z", realtime: "applied" } });
    expect(mock.tables.member_identity[0]).toMatchObject({ muted_until: "2026-10-10T16:00:00.000Z" });
    expect(mock.tables.moderation_log).toEqual([expect.objectContaining({ action: "mute", item_kind: "name", target_id: M, excerpt: "Ash" })]);
    expect(mock.notices).toEqual([["/internal/sanction", { member_id: M, muted_until: "2026-10-10T16:00:00.000Z" }]]);
    const off = await post({ member_id: M, action: "unmute" });
    expect(off.body.moderation).toMatchObject({ action: "unmute", muted_until: null, realtime: "applied" });
    expect(mock.notices.at(-1)).toEqual(["/internal/sanction", { member_id: M, muted_until: null }]);
  });

  it("reset_name and dismiss tell the island nothing", async () => {
    expect((await post({ member_id: M, action: "dismiss" })).body).toEqual({ ok: true, moderation: { action: "dismiss" } });
    expect(mock.notices).toEqual([]);
  });
});
