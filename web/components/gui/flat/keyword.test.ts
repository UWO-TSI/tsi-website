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
    expect(kinds("Fish sell at the fish market. Borrow my fishing rod.")).toEqual([["Fish", "fish"], ["fish market", "market"], ["fishing rod", "rod"]]);
    expect(kinds("The shipwright's boats, the Café, HQ's mail.")).toEqual([["shipwright", "ship"], ["boats", "ship"], ["Café", "cafe"], ["HQ", "hq"], ["mail", "mail"]]);
    expect(kinds("Selfish shopping, a friendship, I'd say.")).toEqual([]);
    expect(keywordParts("No keywords here.")).toEqual([{ text: "No keywords here.", at: 0 }]);
  });
  it("names the shop's real merch, the café's study and the gems", () => {
    const kinds = (line: string) => keywordParts(line).filter(p => p.kind).map(p => p.kind);
    expect(kinds("The shop sells real merch, for gems.")).toEqual(["shop", "merch", "gem"]);
    expect(kinds("Study at the café with friends.")).toEqual(["study", "cafe"]);
  });
});
