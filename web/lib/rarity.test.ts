import { describe, expect, it } from "vitest";
import { RARITIES, RARITY_RANK, mayHoldContraband } from "./rarity";
import { sellPrice } from "./wallet/rules";

describe("the rarity ladder", () => {
  it("runs common to Contraband, in David's order", () => {
    expect(RARITIES).toEqual(["common", "uncommon", "rare", "epic", "legendary", "divine", "contraband"]);
    expect(RARITY_RANK.divine).toBeGreaterThan(RARITY_RANK.legendary);
  });
  it("keeps Contraband shut until the flag opens it, then only for mods and T0/T1", () => {
    expect(mayHoldContraband({ tier: 1, mod: true }, false)).toBe(false);
    expect(mayHoldContraband({ tier: 0 }, true)).toBe(true);
    expect(mayHoldContraband({ tier: 1 }, true)).toBe(true);
    expect(mayHoldContraband({ tier: 2 }, true)).toBe(false);
    expect(mayHoldContraband({ tier: null, mod: true }, true)).toBe(true);
    expect(mayHoldContraband({ tier: null }, true)).toBe(false);
  });
  it("sells Divine above legendary and never buys Contraband", () => {
    expect(sellPrice("fish", "divine")!).toBeGreaterThan(sellPrice("fish", "legendary")!);
    expect(sellPrice("fish", "contraband")).toBeNull();
  });
});
