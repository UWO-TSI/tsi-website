import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryStore } from "./memoryStore";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));

import { POST as contributeRoute } from "../../app/api/progression/contribute/route";
import { POST as advanceRoute } from "../../app/api/progression/chapters/advance/route";
import { POST as creditRoute } from "../../app/api/progression/goals/[slug]/credit/route";

const A = "00000000-0000-4000-8000-0000000000aa";
const req = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
let m: ReturnType<typeof memoryStore>;

beforeEach(() => {
  m = memoryStore();
  m.addMember(A, {}, 1000);
  mock.ctx = { userId: A, tier: 4, store: m.store, now: new Date("2026-09-24T12:00:00Z") };
});

describe("progression routes", () => {
  it("passes through auth failures", async () => {
    mock.ctx = NextResponse.json({ ok: false }, { status: 401 });
    expect((await contributeRoute(req({}))).status).toBe(401);
  });
  it("validates delivery bodies before touching the store", async () => {
    for (const body of [{}, { goal_slug: "reopen-cafe", kind: "gems", amount: 1, idempotency_key: "abcdefgh" }, { goal_slug: "reopen-cafe", kind: "coins", amount: 1, idempotency_key: "short" }]) {
      expect((await contributeRoute(req(body))).status).toBe(400);
    }
    expect(m.contributions).toHaveLength(0);
  });
  it("ignores client-sent weights and credits with the goal's weight", async () => {
    const res = await contributeRoute(req({ goal_slug: "reopen-cafe", kind: "coins", amount: 10, weight: 999, idempotency_key: "abcdefgh1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).contribution.credited_points).toBe(10);
    expect(m.contributions[0]).toMatchObject({ weight: 1, idempotencyKey: "delivery:abcdefgh1" });
  });
  it("rejects a chapter action the server conditions don't allow", async () => {
    const res = await advanceRoute(req({ chapter_slug: "settle-in", action: "report_hq" }));
    expect(res.status).toBe(409);
  });
  it("keeps admin credit to T1/T2", async () => {
    const body = { member_id: A, points: 100, idempotency_key: "abcdefgh" };
    const params = { params: Promise.resolve({ slug: "reopen-cafe" }) };
    expect((await creditRoute(req(body), params)).status).toBe(403);
    mock.ctx = { ...(mock.ctx as object), tier: 1 };
    expect((await creditRoute(req(body), params)).status).toBe(200);
  });
});
