import { describe, expect, it } from "vitest";
import type { ShopEntry } from "./service";
import { itemLine, shelfItems, shopShelves } from "./shopShelves";
import { itemModel, itemSpec } from "@/lib/icons/itemModel";
import { CATALOGUE, OWNERSHIP_ITEMS, onSale } from "./catalogue";

const entry = (slug: string, name: string, category: string, extra: Partial<ShopEntry> = {}): ShopEntry => ({
  id: slug, slug, name, category, description: "", tier: null, currency: category === "merch" ? "gems" : "coins", price: 100, base_price: 100,
  special: false, stock: null, owned: 0, can_buy: true, sprite_url: null, catalogue_ref: null, ...extra,
});
const view = {
  tabs: {
    tools: [entry("rod-cedar", "Cedar rod", "tool", { tier: "mid" })], outfits: [entry("wear-top-cardigan", "Cardigan", "outfit")],
    furniture: [entry("furn-lounge-sofa", "Sofa", "furniture")], specials: [],
    merch: [entry("merch-sticker-pack", "TSI sticker pack", "merch"), entry("merch-tote", "TSI tote bag", "merch")],
  },
};

describe("the shop overlay's sidebar (specs/interiors/shop.md, the shop overlay)", () => {
  it("shows the in-game shelves, the merch's kinds, or both, and Sell only at the counter", () => {
    expect(shopShelves(view, "items")).toEqual(["tools", "outfits", "furniture", "specials"]);
    expect(shopShelves(view, "items", true)).toEqual(["tools", "outfits", "furniture", "specials", "sell"]);
    expect(shopShelves(view, "merch", true)).toEqual(["merch", "merch:accessories", "merch:stickers"]);
    expect(shopShelves(view)).toEqual(["tools", "outfits", "furniture", "specials", "merch"]);
  });

  it("puts each item on its shelf, and the merch's kinds split the merch", () => {
    expect(shelfItems(view, "tools").map(e => e.slug)).toEqual(["rod-cedar"]);
    expect(shelfItems(view, "merch")).toHaveLength(2);
    expect(shelfItems(view, "merch:stickers").map(e => e.slug)).toEqual(["merch-sticker-pack"]);
    expect(shelfItems(view, "sell")).toEqual([]);
  });

  it("gives every item a short line: its own description, else one for its kind", () => {
    expect(itemLine({ description: "Canvas tote.", category: "merch", tier: null })).toBe("Canvas tote.");
    expect(itemLine({ description: "", category: "tool", tier: "mid" })).toBe("A mid tool for the island.");
    expect(itemLine({ description: " ", category: "outfit", tier: null })).toBe("Something new to wear.");
    expect(itemLine({ description: "", category: "mystery", tier: null })).toBe("From the Tethos shop.");
  });

  it("finds a 3D model for the detail view where an item has one, and none for a finish", () => {
    for (const c of [...CATALOGUE, ...OWNERSHIP_ITEMS].filter(onSale)) {
      const spec = itemSpec(c);
      expect(spec, c.slug).not.toBeNull();
      if (c.category === "wallpaper" || c.category === "flooring") expect(itemModel(c), c.slug).toBeNull();
      else expect(itemModel(c)?.url, c.slug).toMatch(/\.glb$/);
    }
  });
});
