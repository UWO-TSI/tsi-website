import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: { id: "member" } as { id: string } | null, failures: new Set<string>(), calls: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mock.user } }) },
  from: (table: string) => {
    mock.calls.push(table);
    const result = { data: [], error: mock.failures.has(table) ? { message: "private database details" } : null };
    const query: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => resolve(result) };
    for (const method of ["select", "neq", "gte", "lte", "eq", "order", "limit"]) query[method] = () => query;
    return query;
  },
}) }));
import { GET as getOnline } from "../../app/api/server/online/route";
import { GET as getGhosts } from "../../app/api/positions/ghosts/route";
beforeEach(() => { mock.user = { id: "member" }; mock.failures.clear(); mock.calls.length = 0; });

describe("presence endpoint failure contracts", () => {
  it.each([getOnline, getGhosts])("returns 401 without querying member data when signed out", async (get) => {
    mock.user = null; const result = await get(); expect(result.status).toBe(401); expect(mock.calls).toEqual([]);
  });
  it.each(["player_positions", "npc_personas", "events"])("reports unavailable rather than empty when %s fails", async (table) => {
    mock.failures.add(table); const result = await getOnline(); expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "Member presence unavailable" });
  });
  it("reports failed ghost queries without leaking database details", async () => {
    mock.failures.add("player_positions"); const result = await getGhosts(); expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "Recent visitors unavailable" });
  });
  it("keeps legitimate empty results successful", async () => {
    const online = await getOnline(); expect(online.status).toBe(200); expect(await online.json()).toEqual({ online: [], recent: [], npcs: [], events: [] });
    const ghosts = await getGhosts(); expect(ghosts.status).toBe(200); expect(await ghosts.json()).toEqual({ ghosts: [] });
  });
});
