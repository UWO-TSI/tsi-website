import { describe, expect, it } from "vitest";
import { FRIEND_MAX, FRIEND_HALVES, TASTE_HALVES, friendLetter, friendNote, giftTaste, heartsReached, tasteLine } from "./friendship";
import { RESIDENT_GIFTS } from "@/lib/content/residentRoster";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";

describe("resident friendship, in half hearts", () => {
  it("moves by taste: loved +1 heart, liked +1/2, neither 0, hated -1 (David 2026-10-28)", () => {
    expect(FRIEND_HALVES).toBe(10);
    expect(TASTE_HALVES).toEqual({ love: 2, like: 1, meh: 0, hate: -2 });
  });
  it("judges a gift by the item first, then its category", () => {
    const tastes = { odile: { loves: ["bug"], likes: ["fish"], hates: ["fruit", "fish_dace"] } };
    expect(giftTaste("odile", "bug_ladybug", "bug", tastes)).toBe("love");
    expect(giftTaste("odile", "fish_carp", "fish", tastes)).toBe("like");
    expect(giftTaste("odile", "fish_dace", "fish", tastes)).toBe("hate");
    expect(giftTaste("odile", "rock_stone", "mineral", tastes)).toBe("meh");
    expect(giftTaste("nobody", "bug_ladybug", "bug", tastes)).toBe("meh");
  });
  it("gives every resident a love, a like and a hate", () => {
    for (const r of PROPOSED_RESIDENTS) {
      const t = RESIDENT_GIFTS[r.slug];
      expect(t, r.slug).toBeDefined();
      expect(t.loves.length && t.likes.length && t.hates.length, r.slug).toBeTruthy();
    }
  });
  it("counts the whole hearts a move newly reaches", () => {
    expect(heartsReached(0, 1)).toEqual([]);
    expect(heartsReached(1, 3)).toEqual([1]);
    expect(heartsReached(3, 8)).toEqual([2, 3, 4]);
    expect(heartsReached(4, 2)).toEqual([]);
  });
  it("brings a letter on odd hearts and none on the coin hearts", () => {
    expect([1, 2, 3, 4, 5].map(h => !!friendLetter(h, "Odile"))).toEqual([true, false, true, false, true]);
    expect(friendLetter(1, "Odile")!.body).toMatch(/Odile$/);
    expect(friendLetter(FRIEND_MAX + 1, "Odile")).toBeNull();
  });
  it("says what a heart brought, and nothing for half a heart", () => {
    expect(friendNote({ was: 3, level: 4, coins: 50 }, "Bram")).toBe("Bram gave you 50 coins. 2 hearts!");
    expect(friendNote({ was: 1, level: 2, coins: 0 }, "Bram")).toBe("Bram sent you a letter. 1 heart!");
    expect(friendNote({ was: 9, level: 10, coins: 0 }, "Bram")).toMatch(/best friends/);
    expect(friendNote({ was: 2, level: 3, coins: 0 }, "Bram")).toBeNull();
  });
  it("never uses an em dash", () => {
    const all = [1, 3, 5].flatMap(h => Object.values(friendLetter(h, "N")!)).join(" ") + (["love", "like", "meh", "hate"] as const).map(tasteLine).join(" ");
    expect(all).not.toMatch(/—/);
  });
});
