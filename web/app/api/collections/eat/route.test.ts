/** Eating a held snack (specs/game-ui.md §2): the server takes one from the member's stock, fruit only. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";

const mock = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  withStore: async () => mock.ctx,
}));
import { POST } from "./route";

const A = "00000000-0000-4000-8000-0000000000aa";
let m: ReturnType<typeof memoryCollectionsStore>;
const post = async (body: unknown) => {
  const res = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
beforeEach(() => {
  m = memoryCollectionsStore();
  mock.ctx = { userId: A, tier: 4, now: new Date(), db: null, store: m.store };
});

describe("POST /api/collections/eat", () => {
  it("eats one fruit the member has, and says how many are left", async () => {
    await m.store.harvest(A, "n1", "h1", "apple", null, false);
    await m.store.harvest(A, "n2", "h1", "apple", null, false);
    expect(await post({ item: "apple" })).toMatchObject({ status: 200, body: { eaten: { item_key: "apple", count: 1 } } });
    expect(m.countOf(A, "apple")).toBe(1);
    expect((await post({ item: "apple" })).body.eaten.count).toBe(0);
    expect(await post({ item: "apple" })).toMatchObject({ status: 409, body: { code: "none_left" } });
  });

  it("only eats fruit, and never what the member doesn't have", async () => {
    await m.store.harvest(A, "n1", "h1", "rock_stone", null, false);
    expect(await post({ item: "rock_stone" })).toMatchObject({ status: 422, body: { code: "not_edible" } });
    expect(m.countOf(A, "rock_stone")).toBe(1);
    expect(await post({ item: "fruit_pear" })).toMatchObject({ status: 409, body: { code: "none_left" } });
    expect((await post({ item: 42 })).status).toBe(400);
  });
});
