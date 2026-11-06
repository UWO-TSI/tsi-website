import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ ctx: null as unknown, rows: [] as Record<string, unknown>[], recent: 0 }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));
import { POST, PER_MINUTE } from "./route";

const ME = "00000000-0000-4000-8000-0000000000e1";
const SESSION = "00000000-0000-4000-8000-00000000a5e1";
const NOW = new Date("2026-11-06T18:00:00Z");
const db = {
  from: () => ({
    select: () => ({ eq: () => ({ gte: async () => ({ count: mock.recent, error: null }) }) }),
    insert: async (rows: Record<string, unknown>[]) => (mock.rows.push(...rows), { error: null }),
  }),
};
const post = (body: unknown) => POST(new Request("http://x/api/analytics/events", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => { mock.ctx = { userId: ME, tier: 4, db, now: NOW }; mock.rows = []; mock.recent = 0; });

describe("POST /api/analytics/events", () => {
  it("signed out: nothing kept", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await post({ session: SESSION, events: [{ kind: "heartbeat", ago: 0 }] })).status).toBe(401);
    expect(mock.rows).toEqual([]);
  });

  it("keeps a batch as the member's, dated by the server less the time it waited", async () => {
    const res = await post({ session: SESSION, events: [
      { kind: "session_start", screen: "opening", ago: 60_000 },
      { kind: "step", step: "creator", screen: "opening", ago: 1000 },
      { kind: "feature", step: "fishing", ago: 0 },
    ] });
    expect(res.status).toBe(200);
    expect(mock.rows).toEqual([
      { member_id: ME, session_id: SESSION, kind: "session_start", step: null, screen: "opening", at: "2026-11-06T17:59:00.000Z" },
      { member_id: ME, session_id: SESSION, kind: "step", step: "creator", screen: "opening", at: "2026-11-06T17:59:59.000Z" },
      { member_id: ME, session_id: SESSION, kind: "feature", step: "fishing", screen: null, at: "2026-11-06T18:00:00.000Z" },
    ]);
  });

  it("ids from the list only: free text, unknown steps, a step on a heartbeat, a made-up screen, an old time", async () => {
    for (const e of [
      { kind: "step", step: "my name is Sam", ago: 0 },
      { kind: "step", step: "day_7", ago: 0 }, // the tables' step: never from the tab
      { kind: "feature", step: "creator", ago: 0 },
      { kind: "heartbeat", step: "creator", ago: 0 },
      { kind: "heartbeat", screen: "inbox", ago: 0 },
      { kind: "heartbeat", ago: 3_600_000 },
      { kind: "page_view", ago: 0 },
    ]) expect((await post({ session: SESSION, events: [e] })).status, JSON.stringify(e)).toBe(400);
    expect((await post({ session: "not-a-uuid", events: [{ kind: "heartbeat", ago: 0 }] })).status).toBe(400);
    expect((await post({ session: SESSION, events: Array(26).fill({ kind: "heartbeat", ago: 0 }) })).status).toBe(400);
    expect(mock.rows).toEqual([]);
  });

  it("rate-limited per member: a minute's room, then 429", async () => {
    mock.recent = PER_MINUTE - 2;
    const res = await post({ session: SESSION, events: Array(5).fill({ kind: "heartbeat", ago: 0 }) });
    expect(await res.json()).toMatchObject({ ok: true, kept: 2 });
    mock.recent = PER_MINUTE;
    expect((await post({ session: SESSION, events: [{ kind: "heartbeat", ago: 0 }] })).status).toBe(429);
  });
});
