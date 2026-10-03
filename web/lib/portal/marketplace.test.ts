import { describe, expect, it } from "vitest";
import { balanceAfterPurchase, canAfford, loadMarketplace, ORDER_TONES } from "./marketplace";
import { fakeDb } from "./testDb";

const ME = "00000000-0000-4000-8000-0000000000aa";
const TOTE = { id: "item-tote", name: "Club tote", description: null, image_url: null, price_tc: 120, stock: 4, category: "merch", status: "available", theme_id: null, created_at: "2026-09-01T12:00:00Z" };
const rows = () => ({
  profiles: [{ id: ME, tethos_coins: 100 }],
  marketplace_items: [TOTE, { ...TOTE, id: "item-hidden", name: "Old pin", status: "hidden" }],
  marketplace_orders: [
    { id: "order-1", user_id: ME, item_id: "item-tote", quantity: 1, total_tc: 120, status: "pending_pickup", created_at: "2026-09-02T12:00:00Z", fulfilled_at: null, item: { name: "Club tote", category: "merch" } },
    { id: "order-2", user_id: "someone-else", item_id: "item-tote", quantity: 1, total_tc: 120, status: "fulfilled", created_at: "2026-09-03T12:00:00Z", fulfilled_at: null, item: { name: "Club tote", category: "merch" } },
  ],
});

describe("the marketplace's reads (#20)", () => {
  it("prices items from price_tc", async () => {
    const m = await loadMarketplace(fakeDb(rows()).db);
    expect(m?.items).toHaveLength(1);
    expect(m?.items[0].price_tc).toBe(120);
  });
  it("lists my orders from the real columns, total_tc", async () => {
    const m = await loadMarketplace(fakeDb(rows()).db);
    expect(m?.orders.map((o) => [o.id, o.total_tc, o.status])).toEqual([["order-1", 120, "pending_pickup"]]);
  });
  it("tags an order waiting for pickup as waiting", () => {
    expect(ORDER_TONES.pending_pickup).toBe("warn");
    expect(ORDER_TONES.fulfilled).toBe("success");
  });
  it("says when you can't afford it", () => {
    expect(canAfford(100, TOTE)).toBe(false);
    expect(canAfford(120, TOTE)).toBe(true);
  });
  it("keeps the balance a number after a purchase: the server's balance", () => {
    expect(balanceAfterPurchase({ success: true, balance: 30 }, 150)).toBe(30);
    expect(balanceAfterPurchase({ success: true }, 150)).toBe(150);
  });
  it("answers null signed out and throws a failed read instead of showing an empty shop", async () => {
    expect(await loadMarketplace(fakeDb(rows(), { userId: null }).db)).toBeNull();
    await expect(loadMarketplace(fakeDb(rows(), { down: ["marketplace_orders"] }).db)).rejects.toThrow();
  });
});
