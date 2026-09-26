import { describe, expect, it } from "vitest";
import { DEFAULT_OUTFIT, WARDROBE_STUB, parseOutfit } from "./wardrobe";

describe("wardrobe", () => {
  it("keeps valid picks per slot and falls back for anything else", () => {
    expect(parseOutfit(null)).toEqual(DEFAULT_OUTFIT);
    expect(parseOutfit({ hair: "hair-bun", top: "hair-bowl", bottom: 3 })).toEqual({ ...DEFAULT_OUTFIT, hair: "hair-bun" });
  });
  it("offers every slot and the defaults exist", () => {
    for (const slot of ["hair", "top", "bottom", "accessory"] as const) {
      expect(WARDROBE_STUB.some(i => i.slot === slot)).toBe(true);
      expect(WARDROBE_STUB.find(i => i.id === DEFAULT_OUTFIT[slot])?.slot).toBe(slot);
    }
  });
});
