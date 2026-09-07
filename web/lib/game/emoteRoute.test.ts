import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  user: { id: "member" } as { id: string } | null, error: false,
  tables: [] as string[], writes: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mock.user } }) },
  from: (table: string) => {
    mock.tables.push(table);
    return { insert: async (value: Record<string, unknown>) => {
      mock.writes.push(value); return { error: mock.error ? { message: "private database detail" } : null };
    } };
  },
}) }));
vi.mock("@/lib/game/presencePosition", () => import("./presencePosition"));
import { POST } from "../../app/api/emotes/log/route";
const id = "12345678-1234-1234-1234-123456789abc";
const body = { emote_type_id: id, world_x: -24, world_z: 72 };
const request = (value: unknown) => new Request("http://localhost/api/emotes/log", { method: "POST", body: JSON.stringify(value) });
beforeEach(() => { mock.user = { id: "member" }; mock.error = false; mock.tables.length = 0; mock.writes.length = 0; });

describe("emote log route", () => {
  it("accepts existing outer-island coordinates and assigns the authenticated user", async () => {
    const response = await POST(request({ ...body, user_id: "someone-else" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(mock.tables).toEqual(["emote_logs"]); expect(mock.writes).toEqual([{ ...body, user_id: "member" }]);
  });
  it("does not write for signed-out visitors", async () => {
    mock.user = null; expect((await POST(request(body))).status).toBe(401); expect(mock.writes).toEqual([]);
  });
  it.each([null, [], "hello", {}, { ...body, emote_type_id: "bad" }, { ...body, world_x: "0" }, { ...body, world_z: 80.01 }])("rejects invalid JSON values without writing: %j", async (value) => {
    expect((await POST(request(value))).status).toBe(400); expect(mock.tables).toEqual([]);
  });
  it("rejects malformed JSON", async () => {
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mock.writes).toEqual([]);
  });
  it("returns a generic failure when the insert fails", async () => {
    mock.error = true; const response = await POST(request(body));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, error: "Emote sharing unavailable" });
  });
});
