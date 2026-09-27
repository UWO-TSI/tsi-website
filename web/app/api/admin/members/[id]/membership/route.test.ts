import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ ctx: null as unknown, calls: [] as unknown[], result: { data: [{ membership: "member", tier: 4 }], error: null } as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));

import { POST } from "./route";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const M = "00000000-0000-4000-8000-0000000000aa";
const call = (body: unknown, id = M) =>
  POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const withTier = (tier: number) => ({
  userId: ADMIN,
  tier,
  now: new Date(),
  db: { rpc: async (fn: string, args: unknown) => (mock.calls.push([fn, args]), mock.result) },
});

beforeEach(() => {
  mock.calls = [];
  mock.ctx = withTier(1);
  mock.result = { data: [{ membership: "member", tier: 4 }], error: null };
});

describe("POST /api/admin/members/:id/membership", () => {
  it("passes auth failures through", async () => {
    mock.ctx = NextResponse.json({ ok: false }, { status: 401 });
    expect((await call({ membership: "member" })).status).toBe(401);
  });
  it("is T1/T2 only", async () => {
    for (const tier of [3, 4, 5]) {
      mock.ctx = withTier(tier);
      expect((await call({ membership: "member" })).status).toBe(403);
    }
    expect(mock.calls).toHaveLength(0);
  });
  it("validates the body and id before touching the database", async () => {
    for (const [body, id] of [[{}, M], [{ membership: "admin" }, M], [{ membership: "member" }, "not-a-uuid"]] as const) {
      expect((await call(body, id)).status).toBe(400);
    }
    expect(mock.calls).toHaveLength(0);
  });
  it("marks a member through admin_set_membership with the caller as actor", async () => {
    const res = await call({ membership: "member" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, member: { id: M, membership: "member", tier: 4 } });
    expect(mock.calls).toEqual([["admin_set_membership", { p_actor_id: ADMIN, p_member_id: M, p_membership: "member" }]]);
  });
  it("maps the function's refusals", async () => {
    for (const [message, status] of [["not_found", 404], ["staff", 409], ["forbidden", 403], ["boom", 500]] as const) {
      mock.result = { data: null, error: { message } };
      expect((await call({ membership: "public" })).status).toBe(status);
    }
  });
});
