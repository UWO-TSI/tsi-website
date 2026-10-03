import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/portal/testDb";
import { loadAdminShopItems, shopPrice } from "./adminShop";

const item = (slug: string, extra = {}) => ({
  id: `id-${slug}`, slug, display_name: slug, category: "tool", sprite_url: null, description: "", tc_price: null, price_coins: 100, rarity: null, stock: null,
  active: true, released_at: "2026-09-26T12:00:00Z", retired_at: null, position: 0, tier: "basic", slot: null, special_pool: false, stackable: false, catalogue_ref: null, ...extra,
});

describe("the admin shop list's loader (#29)", () => {
  const rows = () => ({ shop_items: [item("rod-basic", { position: 1 }), item("old-hat", { active: false, retired_at: "2026-09-30T12:00:00Z", position: 3 }), item("merch-tote", { tc_price: 400, price_coins: null, category: "merch", position: 2 })] });
  it("lists every item, retired ones too, in catalogue order", async () => {
    expect((await loadAdminShopItems(fakeDb(rows()).db)).map((i) => [i.slug, i.active])).toEqual([["rod-basic", true], ["merch-tote", true], ["old-hat", false]]);
  });
  it("prices coin items in coins and Gem items in Gems", async () => {
    const [rod, tote] = await loadAdminShopItems(fakeDb(rows()).db);
    expect(shopPrice(rod)).toEqual({ n: 100, currency: "coins" });
    expect(shopPrice(tote)).toEqual({ n: 400, currency: "gems" });
  });
  it("throws a failed read rather than showing an empty or default list", async () => {
    await expect(loadAdminShopItems(fakeDb(rows(), { down: ["shop_items"] }).db)).rejects.toThrow();
  });
});
