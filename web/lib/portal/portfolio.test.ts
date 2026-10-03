import { describe, expect, it } from "vitest";
import { loadPortfolio } from "./portfolio";
import { fakeDb } from "./testDb";

const ME = "00000000-0000-4000-8000-0000000000aa";
const item = (id: string, position: number) => ({ id, portfolio_id: "p1", type: "project", title: id, description: null, image_url: null, link: null, tech_stack: null, is_visible: true, position, reference_id: null, created_at: "2026-10-01T12:00:00Z" });

describe("the portfolio's read (#24)", () => {
  it("loads the items in their order (position; sort_order was never a column)", async () => {
    const f = fakeDb({ profiles: [{ id: ME, display_name: "Maya" }], portfolios: [{ id: "p1", user_id: ME, slug: "maya", bio: null, is_public: false }], portfolio_items: [item("b", 1), item("a", 0)] });
    const r = await loadPortfolio(f.db);
    expect(r?.displayName).toBe("Maya");
    expect(r?.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
  it("is empty before you make one, null signed out, and throws when the read fails", async () => {
    expect(await loadPortfolio(fakeDb({ profiles: [{ id: ME, display_name: "Maya" }], portfolios: [] }).db)).toMatchObject({ portfolio: null, items: [] });
    expect(await loadPortfolio(fakeDb({}, { userId: null }).db)).toBeNull();
    await expect(loadPortfolio(fakeDb({ profiles: [{ id: ME, display_name: "Maya" }] }, { down: ["portfolios"] }).db)).rejects.toThrow();
  });
});
