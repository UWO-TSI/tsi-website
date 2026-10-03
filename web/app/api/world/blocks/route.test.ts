/** /api/world/blocks (multiplayer M2 §6): your blocks, and the realtime server told at once. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryWorldStore } from "@/lib/world/memoryStore";

const mock = vi.hoisted(() => ({ ctx: null as unknown, notices: [] as unknown[][], answer: "applied" as string }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));
vi.mock("@/lib/server/realtimeNotify", () => ({
  notifyRealtime: async (...args: unknown[]) => (mock.notices.push(args), mock.answer),
}));

import { DELETE, GET, POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const C = "00000000-0000-4000-8000-0000000000cc";
let m: ReturnType<typeof memoryWorldStore>;
const as = (userId: string) => (mock.ctx = { userId, tier: 5, now: new Date(), db: null, store: m.store });
const json = async (res: Response) => ({ status: res.status, body: await res.json() });
const post = (body: unknown) => POST(new Request("http://localhost/api/world/blocks", { method: "POST", body: JSON.stringify(body) })).then(json);
const del = (q: string) => DELETE(new Request(`http://localhost/api/world/blocks${q}`, { method: "DELETE" })).then(json);

beforeEach(() => {
  m = memoryWorldStore();
  m.member(A, "Maple");
  m.member(B, "Birch");
  m.member(C, null);
  mock.notices = [];
  mock.answer = "applied";
  as(A);
});

describe("/api/world/blocks", () => {
  it("passes signed-out through", async () => {
    const out = () => (mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }));
    out();
    expect((await GET()).status).toBe(401);
    out();
    expect((await post({ member_id: B })).status).toBe(401);
    out();
    expect((await del(`?member_id=${B}`)).status).toBe(401);
    expect(mock.notices).toEqual([]);
  });

  it("blocks, tells the realtime server, and lists with world names (never real names)", async () => {
    const r = await post({ member_id: B });
    expect(r).toEqual({ status: 200, body: { ok: true, blocks: [{ member_id: B, world_name: "Birch", created_at: expect.any(String) }], realtime: "applied" } });
    expect(mock.notices).toEqual([["/internal/block", { blocker_id: A, blocked_id: B, blocked: true }]]);
    mock.answer = "skipped";
    expect((await post({ member_id: C.toUpperCase() })).body).toMatchObject({ realtime: "skipped" });
    const list = await json(await GET());
    expect(list.body.blocks.map((b: { world_name: string }) => b.world_name)).toEqual(["Islander", "Birch"]);
  });

  it("unblocks by query, tells the realtime server", async () => {
    await post({ member_id: B });
    const r = await del(`?member_id=${B}`);
    expect(r).toEqual({ status: 200, body: { ok: true, blocks: [], realtime: "applied" } });
    expect(mock.notices.at(-1)).toEqual(["/internal/block", { blocker_id: A, blocked_id: B, blocked: false }]);
  });

  it("refuses yourself (400) and unknown players (404) without telling anyone; validates", async () => {
    expect((await post({ member_id: A })).status).toBe(400);
    expect((await post({ member_id: "00000000-0000-4000-8000-0000000000ee" })).status).toBe(404);
    for (const body of [{}, { member_id: "bob" }, { member_id: B, extra: 1 }, null]) expect((await post(body)).status).toBe(400);
    for (const q of ["", "?member_id=bob", "?id=" + B]) expect((await del(q)).status).toBe(400);
    expect(mock.notices).toEqual([]);
  });
});
