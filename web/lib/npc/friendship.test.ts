import { describe, expect, it } from "vitest";
import { FRIEND_MAX, friendLetter, friendNote } from "./friendship";

describe("resident friendship", () => {
  it("brings a letter on odd levels and none on the gift levels", () => {
    expect([1, 2, 3, 4, 5].map(l => !!friendLetter(l, "Odile"))).toEqual([true, false, true, false, true]);
    expect(friendLetter(1, "Odile")!.body).toMatch(/Odile$/);
    expect(friendLetter(FRIEND_MAX + 1, "Odile")).toBeNull();
  });
  it("says what a level brought", () => {
    expect(friendNote({ level: 2, coins: 50 }, "Bram")).toBe("Bram gave you 50 coins, a little thank you for the chats. Friendship 2 of 5.");
    expect(friendNote({ level: 3, coins: 0 }, "Bram")).toMatch(/sent you a letter/);
    expect(friendNote({ level: 5, coins: 0 }, "Bram")).toMatch(/best friends/);
  });
  it("never uses an em dash", () => {
    const all = [1, 3, 5].flatMap(l => Object.values(friendLetter(l, "N")!)).join(" ") + friendNote({ level: 2, coins: 1 }, "N");
    expect(all).not.toMatch(/—/);
  });
});
