import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

type Row = { tier: number; is_active: boolean; is_alumni: boolean };
const mock = vi.hoisted(() => ({ ctx: null as unknown, rows: new Map<string, Row>() }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));

import { PATCH } from "./route";

const T1 = "00000000-0000-4000-8000-0000000000a1";
const T2 = "00000000-0000-4000-8000-0000000000a2";
const M = "00000000-0000-4000-8000-0000000000aa";
// The service-role client, over an in-memory profiles table.
const db = {
  from: () => ({
    select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: mock.rows.get(id) ?? null, error: null }) }) }),
    update: (patch: Partial<Row>) => ({ eq: async (_c: string, id: string) => (mock.rows.set(id, { ...mock.rows.get(id)!, ...patch }), { error: null }) }),
  }),
};
const as = (userId: string, tier: number) => ({ userId, tier, now: new Date(), db });
const call = (body: unknown, id = M) =>
  PATCH(new Request("http://localhost/api", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  mock.rows = new Map([
    [T1, { tier: 1, is_active: true, is_alumni: false }],
    [T2, { tier: 2, is_active: true, is_alumni: false }],
    [M, { tier: 4, is_active: true, is_alumni: false }],
  ]);
  mock.ctx = as(T1, 1);
});

describe("PATCH /api/admin/members/:id (tier, active, alumni)", () => {
  it("passes auth failures through", async () => {
    mock.ctx = NextResponse.json({ ok: false }, { status: 401 });
    expect((await call({ tier: 3 })).status).toBe(401);
  });
  it("refuses T3 and lower", async () => {
    for (const tier of [3, 4, 5]) {
      mock.ctx = as(M, tier);
      expect((await call({ tier: 3 })).status).toBe(403);
    }
    expect(mock.rows.get(M)!.tier).toBe(4);
  });
  it("persists a T1 change of tier, active and alumni", async () => {
    const res = await call({ tier: 3, is_active: false, is_alumni: true });
    expect(res.status).toBe(200);
    expect(mock.rows.get(M)).toEqual({ tier: 3, is_active: false, is_alumni: true });
  });
  it("validates before touching the database", async () => {
    for (const [body, id] of [[{}, M], [{ tier: 6 }, M], [{ tier: 2, xp: 9 }, M], [{ is_active: "no" }, M], [{ tier: 3 }, "nope"]] as const) {
      expect((await call(body, id)).status).toBe(400);
    }
    expect(mock.rows.get(M)!.tier).toBe(4);
  });
  it("refuses changing your own tier", async () => {
    expect((await call({ tier: 2 }, T1)).status).toBe(409);
    expect(mock.rows.get(T1)!.tier).toBe(1);
  });
  it("keeps T1 in T1's hands", async () => {
    mock.ctx = as(T2, 2);
    expect((await call({ tier: 1 })).status).toBe(403);
    expect((await call({ is_active: false }, T1)).status).toBe(403);
    expect((await call({ tier: 3 })).status).toBe(200);
    expect(mock.rows.get(M)!.tier).toBe(3);
  });
  it("answers 404 for an unknown account", async () => {
    expect((await call({ tier: 3 }, "00000000-0000-4000-8000-000000000999")).status).toBe(404);
  });
});
