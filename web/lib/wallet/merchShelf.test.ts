import { describe, expect, it } from "vitest";
import { CATALOGUE, PENDING_MERCH } from "./catalogue";
import { MERCH_TAGS, merchFilters, merchKind, merchTag } from "./merchShelf";

describe("the club merch shelf (David's merch grid reference)", () => {
  it("files each item under a kind by its name", () => {
    expect(merchKind({ slug: "merch-sticker-pack", name: "TSI sticker pack" })).toBe("stickers");
    expect(merchKind({ slug: "merch-tote", name: "TSI tote bag" })).toBe("accessories");
    expect(merchKind({ slug: "merch-hoodie", name: "TSI hoodie" })).toBe("apparel");
    expect(merchKind({ slug: "merch-tee-black", name: "Black tee" })).toBe("apparel");
    expect(merchKind({ slug: "merch-mug", name: "Club mug" })).toBe("home");
    expect(merchKind({ slug: "merch-lanyard", name: "Lanyard" })).toBe("accessories");
    expect(merchKind({ slug: "merch-mystery", name: "Something new" })).toBe("accessories");
    expect(merchKind({ slug: "merch-tsi-keycap-keychain", name: "TSI keycap keychain" })).toBe("accessories");
  });

  it("shows 'all' and then only the kinds that have something, in a fixed order", () => {
    const merch = CATALOGUE.filter(c => c.category === "merch").map(c => ({ slug: c.slug, name: c.display_name }));
    expect(merchFilters(merch)).toEqual(["all", "accessories", "stickers"]);
    expect(merchFilters([{ slug: "merch-mug", name: "Mug" }, { slug: "merch-hoodie", name: "Hoodie" }])).toEqual(["all", "apparel", "home"]);
    expect(merchFilters([])).toEqual(["all"]);
  });

  it("tags only real merch rows", () => {
    const slugs = new Set([...CATALOGUE, ...PENDING_MERCH].filter(c => c.category === "merch").map(c => c.slug));
    for (const slug of Object.keys(MERCH_TAGS)) expect(slugs.has(slug), slug).toBe(true);
    expect(merchTag("merch-tote")).toBe("staff pick");
    expect(merchTag("merch-sticker-pack")).toBeNull();
  });
});
