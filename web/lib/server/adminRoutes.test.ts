/**
 * Every admin route goes through adminContext (rows 215, 221): signed-out
 * callers get 401, T3-T5 get 403, and neither reaches the database.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
  withStore: async (make: (db: unknown) => unknown) => (mock.ctx instanceof NextResponse ? mock.ctx : { ...(mock.ctx as object), store: make((mock.ctx as { db: unknown }).db) }),
}));
// The directory reads through the caller's own client: record its filters.
const directory = vi.hoisted(() => ({ filters: [] as [string, unknown][] }));
vi.mock("@/lib/supabase/server", () => {
  const q: Record<string, unknown> = {};
  for (const k of ["select", "order", "ilike"]) q[k] = () => q;
  q.eq = (c: string, v: unknown) => (directory.filters.push([c, v]), q);
  q.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { createClient: async () => ({ from: () => q }) };
});

const WEB = join(__dirname, "../..");
const routesIn = (dir: string) =>
  (readdirSync(join(WEB, dir), { recursive: true }) as string[]).filter((f) => f.endsWith("route.ts")).map((f) => join(dir, f));
const ADMIN_ROUTES = [
  // /api/admin/me only tells the nav whether the session is signed in and on the recruitment admin list.
  ...routesIn("app/api/admin").filter((f) => !f.endsWith("admin/me/route.ts")),
  ...routesIn("app/api/content"),
  ...routesIn("app/api/economy/admin"),
  "app/api/identity/moderate/route.ts",
  "app/api/progression/goals/sync/route.ts",
  "app/api/progression/goals/[slug]/credit/route.ts",
  "app/api/npc/conversations/[id]/resolve/route.ts",
  "app/api/npc/spend/route.ts",
];
// Portal routes where only some calls are admin: deleting a bounty, and wiping another member's NPC memory.
const ADMIN_CALLS: [file: string, method: (typeof METHODS)[number], body: unknown][] = [
  ["app/api/bounties/[id]/route.ts", "DELETE", {}],
  ["app/api/npc/memories/wipe/route.ts", "POST", { npc_id: "00000000-0000-4000-8000-0000000000cc", user_id: "00000000-0000-4000-8000-0000000000dd" }],
];

const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
// Any read of the service-role client fails the test: the gate must answer first.
const db = new Proxy({}, { get: (_t, key) => { throw new Error(`database touched (${String(key)}) before the gate`); } });
const as = (tier: number) => ({ userId: "00000000-0000-4000-8000-0000000000aa", tier, now: new Date(), db });
const ID = "00000000-0000-4000-8000-0000000000bb";
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

describe("admin routes share the T1/T2 gate", () => {
  it("finds the admin routes", () => {
    expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(15);
  });

  it.each(ADMIN_ROUTES)("%s: 401 signed out, 403 for T3-T5, no database", async (file) => {
    const mod = (await import(join(WEB, file))) as Partial<Record<(typeof METHODS)[number], Handler>>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);
    for (const method of handlers) {
      const call = () =>
        mod[method]!(new Request("http://localhost/api", { method, ...(method === "GET" ? {} : { body: "{}" }) }), { params: Promise.resolve({ id: ID, slug: "goal" }) });
      mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      expect((await call()).status, `${method} signed out`).toBe(401);
      for (const tier of [3, 4, 5]) {
        mock.ctx = as(tier);
        expect((await call()).status, `${method} as T${tier}`).toBe(403);
      }
    }
  });

  it.each(ADMIN_CALLS)("%s %s: 401 signed out, 403 for T3-T5, no database", async (file, method, body) => {
    const mod = (await import(join(WEB, file))) as Partial<Record<(typeof METHODS)[number], Handler>>;
    const call = () => mod[method]!(new Request("http://localhost/api", { method, body: JSON.stringify(body) }), { params: Promise.resolve({ id: ID }) });
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await call()).status).toBe(401);
    for (const tier of [3, 4, 5]) {
      mock.ctx = as(tier);
      expect((await call()).status, `T${tier}`).toBe(403);
    }
  });

  it("the directory's staff view (inactive members too) comes from the same gate", async () => {
    const { GET } = await import(join(WEB, "app/api/directory/route.ts"));
    const view = async (tier: number) => {
      directory.filters = [];
      mock.ctx = as(tier);
      expect((await GET(new Request("http://localhost/api/directory"))).status).toBe(200);
      return directory.filters.some(([c, v]) => c === "is_active" && v === true);
    };
    expect([await view(1), await view(2)]).toEqual([false, false]);
    expect([await view(3), await view(4), await view(5)]).toEqual([true, true, true]);
  });

  it("no other route carries its own T1/T2 or T1-only check", () => {
    const inline = routesIn("app/api")
      .filter((f) => !ADMIN_ROUTES.includes(f))
      .filter((f) => /isAdminTier|\btier\s*>\s*2\b|tier !== 1\b|tier === 1\b|\[1, 2\]\.includes/.test(readFileSync(join(WEB, f), "utf8")));
    expect(inline.map((f) => relative(WEB, join(WEB, f)))).toEqual([]);
  });
});
