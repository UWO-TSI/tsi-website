import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { fakeDb } from "@/lib/portal/testDb";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));

import { GET, POST } from "./route";

const ME = "00000000-0000-4000-8000-0000000000aa";
const E = "00000000-0000-4000-8000-0000000000e1";
const CODE = "00000000-0000-4000-8000-0000000000c1";
const event = (extra = {}) => ({ id: E, title: "Fall social", event_type: "social", start_time: "2026-10-08T22:00:00Z", status: "approved", is_irl: true, qr_check_in_code: CODE, ...extra });
let f: ReturnType<typeof fakeDb>;
const as = (tier: number, userId = ME) => { mock.ctx = { userId, tier, db: f.db, now: new Date() }; };
const post = (body: unknown, id = E) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const attendance = () => f.tables.event_attendance ?? [];

beforeEach(() => {
  f = fakeDb({ events: [event()], event_attendance: [] }, { unique: { event_attendance: ["event_id", "user_id"] } });
  as(4);
});

describe("POST /api/events/:id/check-in (#26)", () => {
  it("passes auth failures through, and is for members only", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await post({ code: CODE })).status).toBe(401);
    as(5);
    expect((await post({ code: CODE })).status).toBe(403);
    expect(attendance()).toHaveLength(0);
  });
  it("checks a member in once, as attended (the attendance triggers pay the XP and coins)", async () => {
    const res = await post({ code: CODE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, event: { id: E, title: "Fall social", is_irl: true }, already: false });
    expect(attendance()).toEqual([expect.objectContaining({ event_id: E, user_id: ME, status: "attended" })]);
    const again = await post({ code: CODE });
    expect(await again.json()).toMatchObject({ ok: true, already: true });
    expect(f.writes.filter((w) => w.table === "event_attendance")).toHaveLength(1);
  });
  it("turns an RSVP into attendance", async () => {
    f.tables.event_attendance.push({ id: "rsvp-1", event_id: E, user_id: ME, status: "registered" });
    expect(await (await post({ code: CODE })).json()).toMatchObject({ ok: true, already: false });
    expect(attendance()).toEqual([expect.objectContaining({ id: "rsvp-1", status: "attended" })]);
  });
  it("refuses a wrong code, an unknown or cancelled event, and a malformed link, writing nothing", async () => {
    expect((await post({ code: "00000000-0000-4000-8000-0000000000c2" })).status).toBe(403);
    expect((await post({ code: CODE }, "00000000-0000-4000-8000-0000000000e9")).status).toBe(404);
    f.tables.events[0].status = "cancelled";
    expect((await post({ code: CODE })).status).toBe(404);
    expect((await post({ code: "nope" })).status).toBe(400);
    expect((await post({ code: CODE }, "nope")).status).toBe(400);
    expect(attendance()).toHaveLength(0);
  });
  it("treats a check-in that lost a race as already checked in", async () => {
    f.tables.event_attendance.push({ id: "other-tab", event_id: E, user_id: ME, status: "attended" });
    const from = f.db.from.bind(f.db);
    let hide = true; // the read misses the row the other tab is inserting
    (f.db as unknown as { from: unknown }).from = (table: string) => {
      const q = from(table) as unknown as Record<string, unknown>;
      if (table === "event_attendance" && hide) {
        hide = false;
        q.maybeSingle = () => ({ then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok) });
      }
      return q;
    };
    expect(await (await post({ code: CODE })).json()).toMatchObject({ ok: true, already: true });
  });
});

describe("GET /api/events/:id/check-in (#26): the QR link for admins", () => {
  it("gives T1/T2 the event's check-in link and no one else", async () => {
    as(1);
    const res = await GET(new Request("http://localhost/api"), { params: Promise.resolve({ id: E }) });
    expect(await res.json()).toEqual({ ok: true, code: CODE, url: `https://play.tethos.ca/student/check-in?event=${E}&code=${CODE}` });
    as(3);
    expect((await GET(new Request("http://localhost/api"), { params: Promise.resolve({ id: E }) })).status).toBe(403);
  });
});
