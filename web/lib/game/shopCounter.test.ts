import { describe, expect, it } from "vitest";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { memoryEconomyTransport } from "@/lib/wallet/memoryTransport";
import { buyAtCounter, coinSteps, sellAtCounter } from "./shopCounter";

const ME = "00000000-0000-4000-8000-000000000001";
function counter() {
  const m = memoryEconomyStore();
  m.fund(ME, 500);
  m.give(ME, "apple", 6);
  m.give(ME, "fish_black_bass", 1);
  m.give(ME, "rock_iron_nugget", 3);
  m.lock(ME, "rock_iron_nugget", true);
  return { m, t: memoryEconomyTransport(ME, m) };
}

describe("the shop's counter", () => {
  it("sells over the counter: the coins it paid, the balance it counts up from and to, and the keeper's thanks", async () => {
    const { m, t } = counter();
    const apple = (await t.sellable()).find(e => e.item_key === "apple")!;
    const r = await sellAtCounter(t, apple, 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.paid).toBe(apple.price_each * 4);
    expect(r.to).toBe(500 + r.paid);
    expect(r.from).toBe(500);
    expect(r.line).toMatch(/coins/);
    expect(m.coinsOf(ME)).toBe(r.to);
    expect((await t.sellable()).find(e => e.item_key === "apple")!.count).toBe(2);
  });

  it("never sells what's locked in the bag, and says so", async () => {
    const { m, t } = counter();
    const iron = (await t.sellable()).find(e => e.item_key === "rock_iron_nugget")!;
    expect(iron.locked).toBe(true);
    const r = await sellAtCounter(t, iron, 1);
    expect(r.ok).toBe(false);
    expect(m.coinsOf(ME)).toBe(500);
  });

  it("buys over the counter: the coins it cost, the balance after, the thing in your inventory", async () => {
    const { m, t } = counter();
    const shop = await t.shop();
    const item = shop.tabs.tools.find(e => e.can_buy && e.currency === "coins" && e.price <= 500)!;
    const r = await buyAtCounter(t, item);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.to).toBe(500 - item.price);
    expect(m.coinsOf(ME)).toBe(r.to);
    expect(r.line).toMatch(new RegExp(item.name, "i"));
  });

  it("refuses what you can't afford and leaves the coins be", async () => {
    const { m, t } = counter();
    m.fund(ME, 5);
    const item = (await t.shop()).tabs.tools.find(e => e.currency === "coins" && e.price > 5)!;
    const r = await buyAtCounter(t, item);
    expect(r.ok).toBe(false);
    expect(m.coinsOf(ME)).toBe(5);
  });

  it("counts the coins up in a few clinks, ending exactly on the new balance", () => {
    const steps = coinSteps(500, 620);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.length).toBeLessThanOrEqual(10);
    expect(steps.at(-1)).toEqual({ value: 620, at: expect.any(Number) });
    for (let i = 1; i < steps.length; i++) { expect(steps[i].value).toBeGreaterThan(steps[i - 1].value); expect(steps[i].at).toBeGreaterThan(steps[i - 1].at); }
    expect(coinSteps(500, 500)).toEqual([]);
  });
});
