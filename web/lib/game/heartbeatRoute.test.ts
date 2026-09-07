import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({
  user: { id: "member" } as { id: string } | null,
  positionError: false, profileError: false, profileThrows: false, profileExecutions: 0,
  tables: [] as string[], positions: [] as Record<string, unknown>[], profiles: [] as Record<string, unknown>[], filters: [] as unknown[][],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mock.user } }) },
  from: (table: string) => {
    mock.tables.push(table);
    if (table === "player_positions") return { upsert: async (value: Record<string, unknown>) => {
      mock.positions.push(value); return { error: mock.positionError ? { message: "private database details" } : null };
    } };
    return { update: (value: Record<string, unknown>) => {
      mock.profiles.push(value);
      return { eq: (...filter: unknown[]) => {
        mock.filters.push(filter);
        return { then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
          mock.profileExecutions++;
          if (mock.profileThrows) reject(new Error("private database details"));
          else resolve({ error: mock.profileError ? { message: "private database details" } : null });
        } };
      } };
    } };
  },
}) }));
vi.mock("@/lib/game/presencePosition", () => import("./presencePosition"));
import { POST } from "../../app/api/positions/heartbeat/route";
const request = (body: unknown) => new NextRequest("http://localhost/api/positions/heartbeat", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  mock.user = { id: "member" }; mock.positionError = false; mock.profileError = false; mock.profileThrows = false; mock.profileExecutions = 0;
  mock.tables.length = 0; mock.positions.length = 0; mock.profiles.length = 0; mock.filters.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("heartbeat route writes", () => {
  it("requires authentication before writing anything", async () => {
    mock.user = null;
    expect((await POST(request({ world_x: 0, world_z: 0 }))).status).toBe(401);
    expect(mock.tables).toEqual([]);
  });

  it("accepts the existing islet and executes the authenticated member's last-seen update", async () => {
    const response = await POST(request({ world_x: -24, world_z: 72, user_id: "someone-else" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(mock.positions).toEqual([{ user_id: "member", world_x: -24, world_z: 72, recorded_at: expect.any(String) }]);
    expect(mock.profiles).toEqual([{ last_seen_at: mock.positions[0].recorded_at }]);
    expect(mock.filters).toEqual([["id", "member"]]); expect(mock.profileExecutions).toBe(1);
  });

  it.each([null, {}, { world_x: "0", world_z: 0 }, { world_x: 80.01, world_z: 0 }, { world_x: 0, world_z: -80.01 }])("rejects invalid coordinates without writes: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400); expect(mock.tables).toEqual([]);
  });

  it("rejects numeric overflow in otherwise valid JSON", async () => {
    const req = new NextRequest("http://localhost/api/positions/heartbeat", { method: "POST", body: '{"world_x":1e309,"world_z":0}' });
    expect((await POST(req)).status).toBe(400); expect(mock.tables).toEqual([]);
  });

  it("reports position write failure without leaking database details or touching the profile", async () => {
    mock.positionError = true; const response = await POST(request({ world_x: 0, world_z: 0 }));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Presence update unavailable" });
    expect(mock.tables).toEqual(["player_positions"]);
  });

  it.each(["profileError", "profileThrows"] as const)("keeps a saved position acknowledged when optional metadata fails: %s", async (failure) => {
    mock[failure] = true;
    expect((await POST(request({ world_x: 0, world_z: 0 }))).status).toBe(200);
    expect(mock.profileExecutions).toBe(1); expect(console.warn).toHaveBeenCalledExactlyOnceWith("[positions/heartbeat] Last-seen metadata update failed");
  });
});
