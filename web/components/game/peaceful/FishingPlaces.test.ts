import { describe, expect, it } from "vitest";
import { lessSold } from "./FishingPlaces";
import type { SellEntry } from "@/lib/wallet/service";

const row = (item_key: string, count: number): SellEntry => ({ item_key, name: item_key, category: "fish", rarity: "common", count, price_each: 8, locked: false });

describe("quick sell, before the server answers", () => {
  it("counts the pending sales off each row and drops a row sold out", () => {
    const rows = [row("fish_dace", 3), row("fish_black_bass", 1)];
    expect(lessSold(rows, { fish_dace: 2, fish_black_bass: 1 })).toEqual([row("fish_dace", 1)]);
  });
  it("leaves the rows alone with nothing pending", () => {
    const rows = [row("fish_dace", 3)];
    expect(lessSold(rows, {})).toEqual(rows);
    expect(lessSold(rows, { fish_dace: 0 })).toEqual(rows);
  });
});
