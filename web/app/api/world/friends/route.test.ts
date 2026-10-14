/** /api/world/friends (v1, specs/v1-drop.md §3): your code, requests and friends, and the realtime server told at once. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { memoryFriendStore } from "@/lib/world/friendsMemory";
import { devUid } from "@/lib/world/devWorld";

const mock = vi.hoisted(() => ({ ctx: null as unknown, notices: [] as unknown[][], answer: "applied" as string }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));
vi.mock("@/lib/server/realtimeNotify", () => ({
  notifyRealtime: async (...args: unknown[]) => (mock.notices.push(args), mock.answer),
}));

import { DELETE, GET, PATCH, POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa", B = "00000000-0000-4000-8000-0000000000bb";
let m: ReturnType<typeof memoryFriendStore>;
const as = (userId: string) => (mock.ctx = { userId, tier: 5, now: new Date(), db: null, store: m.store });
const json = async (res: Response) => ({ status: res.status, body: await res.json() });
const req = (method: string, body?: unknown, q = "", headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/world/friends${q}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  m = memoryFriendStore();
  m.member(A, "Maple");
  m.member(B, "Birch");
  mock.notices = [];
  mock.answer = "applied";
  as(A);
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/world/friends", () => {
  it("passes signed-out through", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    for (const res of [await GET(req("GET")), await POST(req("POST", { member_id: B })), await PATCH(req("PATCH", { member_id: B, accept: true })), await DELETE(req("DELETE", undefined, `?member_id=${B}`))])
      expect(res.status).toBe(401);
    expect(mock.notices).toEqual([]);
  });

  it("GET: your code and lists, world names only", async () => {
    const r = await json(await GET(req("GET")));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, friends: { code: expect.stringMatching(/^[2-9A-HJKMNP-Z]{8}$/), friends: [], incoming: [], outgoing: [] } });
  });

  it("POST asks (by id or code); the accept tells the realtime server; nothing told for a plain request", async () => {
    as(B);
    const bobCode = (await json(await GET(req("GET")))).body.friends.code;
    as(A);
    const r = await json(await POST(req("POST", { code: bobCode })));
    expect(r).toMatchObject({ status: 200, body: { ok: true, status: "requested", member_id: B } });
    expect(mock.notices).toEqual([]);
    as(B);
    const back = await json(await POST(req("POST", { member_id: A.toUpperCase() })));
    expect(back.body).toMatchObject({ ok: true, status: "friends", realtime: "applied" });
    expect(mock.notices).toEqual([["/internal/friend", { a_id: B, b_id: A, friends: true }]]);
  });

  it("PATCH accepts or declines; DELETE unfriends (told) or cancels (not told)", async () => {
    await POST(req("POST", { member_id: B }));
    as(B);
    expect((await json(await PATCH(req("PATCH", { member_id: A, accept: false })))).body).toMatchObject({ ok: true, status: "declined" });
    as(A);
    await POST(req("POST", { member_id: B }));
    as(B);
    expect((await json(await PATCH(req("PATCH", { member_id: A, accept: true })))).body).toMatchObject({ ok: true, status: "friends", realtime: "applied" });
    expect(mock.notices.at(-1)).toEqual(["/internal/friend", { a_id: B, b_id: A, friends: true }]);
    const gone = await json(await DELETE(req("DELETE", undefined, `?member_id=${A}`)));
    expect(gone.body).toMatchObject({ ok: true, was: true, realtime: "applied" });
    expect(mock.notices.at(-1)).toEqual(["/internal/friend", { a_id: B, b_id: A, friends: false }]);
    const n = mock.notices.length;
    as(A);
    await POST(req("POST", { member_id: B }));
    expect((await json(await DELETE(req("DELETE", undefined, `?member_id=${B}`)))).body).toMatchObject({ ok: true, was: false });
    expect(mock.notices).toHaveLength(n);
  });

  it("validates", async () => {
    for (const body of [{}, { member_id: "bob" }, { code: 3 }, { member_id: B, code: "ABCD2345" }, { member_id: B, extra: 1 }, null]) expect((await POST(req("POST", body))).status, JSON.stringify(body)).toBe(400);
    for (const body of [{ member_id: B }, { member_id: "bob", accept: true }, { accept: true }]) expect((await PATCH(req("PATCH", body))).status).toBe(400);
    for (const q of ["", "?member_id=bob"]) expect((await DELETE(req("DELETE", undefined, q))).status).toBe(400);
  });

  it("dev tokens on a local bench (no service key, not production) use an in-memory island; production never does", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const alice = await json(await GET(req("GET", undefined, "", { "x-dev-as": "Alice" })));
    expect(alice.status).toBe(200);
    const bob = await json(await GET(req("GET", undefined, "", { "x-dev-as": "Bob" })));
    const asked = await json(await POST(req("POST", { code: bob.body.friends.code }, "", { "x-dev-as": "Alice" })));
    expect(asked.body).toMatchObject({ ok: true, status: "requested", member_id: devUid("Bob") });
    const back = await json(await POST(req("POST", { member_id: devUid("Alice") }, "", { "x-dev-as": "Bob" })));
    expect(back.body).toMatchObject({ ok: true, status: "friends" });
    expect(back.body.friends.friends).toEqual([{ member_id: devUid("Alice"), world_name: "Alice", since: expect.any(String) }]);
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET(req("GET", undefined, "", { "x-dev-as": "Alice" }))).status).toBe(401);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "a-real-key");
    expect((await GET(req("GET", undefined, "", { "x-dev-as": "Alice" }))).status).toBe(401);
  });
});
