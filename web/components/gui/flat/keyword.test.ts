import { describe, expect, it } from "vitest";
import { keywordParts } from "./keyword";

describe("a line's keywords (the kit's Keyword, the default for every talk line)", () => {
  it("finds the dictionary's words in a plain line, with their kind and where each part starts", () => {
    const line = "Bring Odile a fish or a bug, for coins.";
    expect(keywordParts(line)).toEqual([
      { text: "Bring Odile a ", at: 0 }, { text: "fish", at: 14, kind: "fish" }, { text: " or a ", at: 18 }, { text: "bug", at: 24, kind: "bug" },
      { text: ", for ", at: 27 }, { text: "coins", at: 33, kind: "coin" }, { text: ".", at: 38 },
    ]);
    for (const p of keywordParts(line)) expect(line.slice(p.at, p.at + p.text.length)).toBe(p.text);
  });
  it("takes the longest phrase first, any case, and never a word inside another", () => {
    const kinds = (line: string) => keywordParts(line).filter(p => p.kind).map(p => [p.text, p.kind]);
    expect(kinds("Fish sell at the fish market. Borrow my fishing rod.")).toEqual([["Fish", "fish"], ["sell", "sell"], ["fish market", "market"], ["fishing rod", "rod"]]);
    expect(kinds("The shipwright's boats, the Café, HQ's mail.")).toEqual([["shipwright", "ship"], ["boats", "ship"], ["Café", "cafe"], ["HQ", "hq"], ["mail", "mail"]]);
    expect(kinds("Selfish shopping, a hidden castle, I'd say.")).toEqual([]);
    expect(keywordParts("No keywords here.")).toEqual([{ text: "No keywords here.", at: 0 }]);
  });
  it("names the shop's real merch, the café's study and the gems", () => {
    const kinds = (line: string) => keywordParts(line).filter(p => p.kind).map(p => p.kind);
    expect(kinds("The shop sells real merch, for gems.")).toEqual(["shop", "sell", "merch", "gem"]);
    expect(kinds("Study at the café with friends.")).toEqual(["study", "cafe", "friend"]);
  });
  it("covers the island's creatures, things, places, roles and what you do (the library, v5-sights)", () => {
    const kinds = (line: string) => keywordParts(line).filter(p => p.kind).map(p => p.kind);
    expect(kinds("Dig up a fossil on the beach, then donate it to the curator.")).toEqual(["dig", "fossil", "beach", "donate", "curator"]);
    expect(kinds("Swing the bug net at a butterfly; put a seashell in your backpack.")).toEqual(["net", "bug", "shell", "bag"]);
    expect(kinds("The shipwright's yard, where you'll build a boat of your own one day.")).toEqual(["ship", "ship"]);
    expect(kinds("Hop that box, then dash. The water's deep off the dock.")).toEqual(["jump", "dash", "sea", "wharf"]);
    expect(kinds("Easy now. That's solid ground under you.")).toEqual([]);
  });
  it("grows to the game's UI words (round 7): menus, the world's weather, its places, gear and what you do", () => {
    const kinds = (line: string) => keywordParts(line).filter(p => p.kind).map(p => p.kind);
    expect(kinds("Your wallet, the collection, the settings and the chest.")).toEqual(["wallet", "collection", "settings", "chest"]);
    expect(kinds("Rain at dawn; snow at night by the campfire in the plaza.")).toEqual(["rain", "dawn", "snow", "night", "campfire", "monument"]);
    expect(kinds("Claim your plot, decorate it, plant a sapling by the river.")).toEqual(["plot", "decorate", "seed", "river"]);
    expect(kinds("Take a photo with your glider, then glide to the library.")).toEqual(["photo", "glider", "glide", "library"]);
    expect(kinds("Swords and a shield for the monsters at the ruins; fight, then unlock the gate.")).toEqual(["weapon", "shield", "monster", "ruins", "fight", "unlock"]);
    expect(kinds("Deliver it to the notice board? The job board has bounties.")).toEqual(["deliver", "board", "board", "board"]);
  });
  it("draws each kind's icon on its own in the UI, in its tone (KeywordIcon), and every kind has one", async () => {
    const { KEYWORD_LIBRARY, keywordIcon } = await import("./keyword");
    for (const e of KEYWORD_LIBRARY) expect(keywordIcon(e.kind)).toBeTruthy();
  });
  it("names every word once, in one kind", async () => {
    const { KEYWORD_LIBRARY } = await import("./keyword");
    const all = KEYWORD_LIBRARY.flatMap(e => e.words.map(w => w.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });
});
