import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({
  user: { id: "member" } as { id: string } | null,
  clientFails: false, failTable: "", profileMissing: false,
  reads: [] as string[],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => {
  if (mock.clientFails) throw new Error("private config detail");
  return {
    auth: { getUser: async () => ({ data: { user: mock.user } }) },
    from: (table: string) => {
      mock.reads.push(table);
      const query = {
        select: () => query, eq: () => query, order: () => query, limit: () => query, single: () => query,
        then: (resolve: (value: unknown) => void) => resolve({
          error: table === mock.failTable ? { message: "private query detail" } : null,
          data: table === "profiles" ? mock.profileMissing ? null : { tethos_coins: 0, xp: 20, level: 1 } : [],
        }),
      };
      return query;
    },
  };
} }));
import { GET as shop } from "../../app/api/shop/route";
import { GET as economy } from "../../app/api/economy/route";
const request = () => new NextRequest("http://localhost/api/shop");
beforeEach(() => { mock.user = { id: "member" }; mock.clientFails = false; mock.failTable = ""; mock.profileMissing = false; mock.reads.length = 0; });

describe("shop and balance GET failures", () => {
  it("requires authentication before reading catalogue or balances", async () => {
    mock.user = null;
    expect((await shop(request())).status).toBe(401); expect((await economy(request())).status).toBe(401);
    expect(mock.reads).toEqual([]);
  });
  it("returns a real empty catalogue and confirmed zero balance on successful reads", async () => {
    expect(await (await shop(request())).json()).toEqual({ products: [] });
    expect(await (await economy(request())).json()).toEqual({ balance: 0, xp: 20, level: 1, transactions: [] });
  });
  it.each(["marketplace_items", "avatar_items", "shop_items"])("does not disguise a failed catalogue source as empty: %s", async (table) => {
    mock.failTable = table; const response = await shop(request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Shop catalogue unavailable" });
  });
  it("does not disguise a client setup failure as an empty catalogue", async () => {
    mock.clientFails = true; const response = await shop(request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Shop catalogue unavailable" });
  });
  it.each(["profiles", "tc_transactions"])("reports failed account reads without database details: %s", async (table) => {
    mock.failTable = table; const response = await economy(request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Account balance unavailable" });
  });
  it("does not invent a balance when the profile is missing", async () => {
    mock.profileMissing = true; const response = await economy(request()); expect(response.status).toBe(503);
  });
});
