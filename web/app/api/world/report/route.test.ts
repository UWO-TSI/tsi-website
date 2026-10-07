/** POST /api/world/report (multiplayer M2 §6): any signed-in account reports a chat line or a player. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryWorldStore } from "@/lib/world/memoryStore";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));

import { POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const LINE = "00000000-0000-4000-8000-0000000001a1";
const now = new Date("2026-10-03T16:00:00Z");
let m: ReturnType<typeof memoryWorldStore>;
const as = (userId: string, tier = 5) => (mock.ctx = { userId, tier, now, db: null, store: m.store });
const post = async (body: unknown) => {
  const res = await POST(new Request("http://localhost/api/world/report", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  m = memoryWorldStore(() => now);
  m.member(A, "Maple");
  m.member(B, "Birch");
  m.say({ id: LINE, member_id: B, body: "rude thing", created_at: "2026-10-03T15:59:00Z", room_id: "Ab3_x9" });
  as(A);
});

describe("POST /api/world/report", () => {
  it("passes signed-out through", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await post({ line_id: LINE, reason: "rude" })).status).toBe(401);
  });

  it("reports a line (a public account too), with the room's context", async () => {
    as(A, 5);
    const r = await post({ line_id: LINE.toUpperCase(), reason: "  harassment  " });
    expect(r).toEqual({ status: 200, body: { ok: true, report: { id: expect.any(String) } } });
    expect(m.reports[0]).toMatchObject({ reporter_id: A, target_id: B, line_id: LINE, room_id: "Ab3_x9", reason: "harassment" });
    expect(m.reports[0].context.map((c) => c.body)).toEqual(["rude thing"]);
  });

  it("reports a player from the roster with your room", async () => {
    const r = await post({ member_id: B, room_id: "Ab3_x9", reason: "their name" });
    expect(r.status).toBe(200);
    expect(m.reports[0]).toMatchObject({ target_id: B, line_id: null, room_id: "Ab3_x9" });
  });

  it("validates before touching anything", async () => {
    for (const body of [
      {}, { reason: "x" }, { line_id: LINE, member_id: B, reason: "x" }, { line_id: "line-1", reason: "x" }, { member_id: B, reason: "" },
      { member_id: B, reason: "   " }, { member_id: B, reason: "x".repeat(201) }, { member_id: B, reason: "x", room_id: "a room" }, { member_id: B, reason: "x", extra: 1 }, null,
    ]) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect(m.reports).toEqual([]);
  });

  it("maps refusals: yourself 400, unknown 404, the hourly cap 429", async () => {
    expect((await post({ member_id: A, reason: "x" })).status).toBe(400);
    expect((await post({ line_id: "00000000-0000-4000-8000-0000000001ff", reason: "x" })).body).toMatchObject({ ok: false, code: "not_found" });
    for (let i = 0; i < 5; i++) expect((await post({ member_id: B, reason: `r${i}` })).status).toBe(200);
    expect((await post({ member_id: B, reason: "again" }))).toMatchObject({ status: 429, body: { ok: false, code: "rate_limited" } });
  });
});
