import { describe, expect, it } from "vitest";
import { CATALOGUE, OWNERSHIP_ITEMS, onSale } from "@/lib/wallet/catalogue";
import { SHOP_PICKS, SPECIALS_SLOTS, nearestDisplay, shopDisplay, todaysSpecials } from "./shopDisplay";
import { SHOP_SLOTS, SHOP_TAG_RANGE, type ItemKind } from "./shopLayout";

const ON_SALE = new Map([...CATALOGUE, ...OWNERSHIP_ITEMS].filter(onSale).map(e => [e.slug, e]));
/** The shop categories each kind of display may show. */
const KIND_CATEGORIES: Record<ItemKind, string[]> = {
  seasonal: ["tool", "outfit", "hair", "accessory", "furniture", "wallpaper", "flooring"],
  clothes: ["outfit"], accessories: ["accessory"], tools: ["tool"], dyes: ["hair"], furniture: ["furniture"], finishes: ["wallpaper", "flooring"],
  "merch-wear": ["merch"], "merch-bags": ["merch"], "merch-small": ["merch"], "merch-prints": ["merch"], "merch-featured": ["merch"],
};

describe("what the shop shows (specs/interiors/shop.md, phase 2)", () => {
  it("picks only things on sale, each for a slot of its kind", () => {
    for (const [slot, slug] of Object.entries(SHOP_PICKS)) {
      const s = SHOP_SLOTS.find(x => x.id === slot);
      expect(s, slot).toBeDefined();
      const e = ON_SALE.get(slug);
      expect(e, `${slot}: ${slug}`).toBeDefined();
      expect(KIND_CATEGORIES[s!.kind], `${slot}: ${slug} is ${e!.category}`).toContain(e!.category);
    }
  });

  it("fills every in-game slot, with a name, an icon and a model to show", () => {
    const shown = shopDisplay(new Date("2026-10-17T15:00:00Z"));
    const bySlot = new Map(shown.map(d => [d.slot, d]));
    for (const s of SHOP_SLOTS.filter(x => x.level === 0)) {
      const d = bySlot.get(s.id);
      expect(d, s.id).toBeDefined();
      expect(d!.name.length).toBeGreaterThan(1);
      expect(d!.icon).toMatch(/^\/assets\/icons\/.+\.webp$/);
      expect(d!.spec.url).toMatch(/\.(glb|png)$/);
    }
    // Upstairs, every merch slot shows one of the three real items, never the placeholder tote or sticker pack
    // (David, 2026-10-22: "Take both off sale").
    const merch = shown.filter(d => d.slot.startsWith("merch-"));
    expect(merch).toHaveLength(12);   // the wall, the counter, the plinths and the three real items' own spots
    expect(new Set(merch.map(d => d.slug))).toEqual(new Set(["merch-tsi-keycap-keychain", "merch-tsi-lanyard", "merch-genesis-sticker"]));
  });

  it("puts today's three specials on the front plinths: the same each time on one day, a new set on another", () => {
    const a = todaysSpecials("2026-10-17"), b = todaysSpecials("2026-10-17"), c = todaysSpecials("2026-10-18");
    expect(a.map(e => e.slug)).toEqual(b.map(e => e.slug));
    expect(a).toHaveLength(SPECIALS_SLOTS.length);
    expect(a.map(e => e.slug)).not.toEqual(c.map(e => e.slug));
    const shown = shopDisplay(new Date("2026-10-17T15:00:00Z")).filter(d => d.special);
    expect(shown.map(d => d.slug)).toEqual(a.map(e => e.slug));
  });

  it("tags the nearest item on your floor within range, and nothing from the stair", () => {
    const shown = shopDisplay(new Date("2026-10-17T15:00:00Z"));
    const rod = SHOP_SLOTS.find(s => s.id === "tools-1")!;
    // In front of the tools table: the nearest tool, not the dyes on the wall.
    const near = nearestDisplay(shown, rod.at[0], rod.at[2] - 0.6, 0);
    expect(near?.slot.startsWith("tools-")).toBe(true);
    // Out of range: nothing. On the stair: nothing. Upstairs over the same spot: only upstairs items.
    expect(nearestDisplay(shown, 0, -3.2, 0)).toBeNull();
    expect(nearestDisplay(shown, rod.at[0], rod.at[2] - 0.6, null)).toBeNull();
    const up = nearestDisplay(shown, 0, 3.6, 1);
    expect(up && SHOP_SLOTS.find(s => s.id === up.slot)!.level).toBe(1);
    for (const item of shown) {
      const s = SHOP_SLOTS.find(x => x.id === item.slot)!;
      expect(nearestDisplay(shown, s.at[0], s.at[2], s.level, SHOP_TAG_RANGE)?.slot).toBe(item.slot);
    }
  });
});
