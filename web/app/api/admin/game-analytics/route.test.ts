import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { demoSnapshot } from "@/lib/analytics/demo";

const mock = vi.hoisted(() => ({ ctx: null as unknown, calls: [] as unknown[] }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));
import { GET } from "./route";

const NOW = new Date("2026-11-06T18:00:00Z");
const db = { rpc: async (name: string, args: unknown) => (mock.calls.push([name, args]), { data: demoSnapshot(NOW, 30), error: null }) };
const get = (q = "") => GET(new Request(`http://x/api/admin/game-analytics${q}`));

beforeEach(() => { mock.calls = []; });

describe("GET /api/admin/game-analytics", () => {
  it("signed out: 401, and nothing is read", async () => {
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await get()).status).toBe(401);
    expect(mock.calls).toEqual([]);
  });

  it("T3 to T5: 403, and nothing is read", async () => {
    for (const tier of [3, 4, 5]) {
      mock.ctx = { userId: "u", tier, db, now: NOW };
      expect((await get()).status).toBe(403);
    }
    expect(mock.calls).toEqual([]);
  });

  it("T1/T2: the report for the range, world names and numbers only", async () => {
    mock.ctx = { userId: "u", tier: 2, db, now: NOW };
    const res = await get("?days=7");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.report.range).toEqual({ from: "2026-10-31", to: "2026-11-06" });
    expect(mock.calls).toEqual([["game_analytics_snapshot", { p_since: "2026-04-20T18:00:00.000Z" }]]);
    expect(JSON.stringify(body)).not.toContain("demo-");
  });
});
