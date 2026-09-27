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
}));

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
  "app/api/guestbook/[id]/moderate/route.ts",
  "app/api/npc/conversations/[id]/resolve/route.ts",
];
// Pre-2026-09-16 portal routes with an inline check: the legacy Gem award inside /api/economy,
// bounty approval, and the directory's staff view (a filter, not a gate). specs/admin-pass-questions.md.
const LEGACY_INLINE = ["app/api/economy/route.ts", "app/api/bounties/[id]/route.ts", "app/api/directory/route.ts"];

// Any read of the service-role client fails the test: the gate must answer first.
const db = new Proxy({}, { get: (_t, key) => { throw new Error(`database touched (${String(key)}) before the gate`); } });
const as = (tier: number) => ({ userId: "00000000-0000-4000-8000-0000000000aa", tier, now: new Date(), db });
const ID = "00000000-0000-4000-8000-0000000000bb";
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

describe("admin routes share the T1/T2 gate", () => {
  it("finds the admin routes", () => {
    expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(17);
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

  it("no other route carries its own T1/T2 check", () => {
    const inline = routesIn("app/api")
      .filter((f) => !ADMIN_ROUTES.includes(f) && !LEGACY_INLINE.includes(f))
      .filter((f) => /isAdminTier|\btier\s*>\s*2\b|tier !== 1 && [^\n]*tier !== 2|\[1, 2\]\.includes/.test(readFileSync(join(WEB, f), "utf8")));
    expect(inline.map((f) => relative(WEB, join(WEB, f)))).toEqual([]);
  });
});
