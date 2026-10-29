import { describe, expect, it } from "vitest";
import { keywordParts, plainLine } from "./keyword";

describe("a line's keywords (the kit's Keyword)", () => {
  it("splits starred words out with their kind and where each part starts in the line as written", () => {
    const line = "Bring Odile a *fish* or a *bug*, for *coins*.";
    expect(keywordParts(line)).toEqual([
      { text: "Bring Odile a ", at: 0 }, { text: "fish", at: 15, kind: "fish" }, { text: " or a ", at: 20 }, { text: "bug", at: 27, kind: "bug" },
      { text: ", for ", at: 31 }, { text: "coins", at: 38, kind: "coin" }, { text: ".", at: 44 },
    ]);
    // Each part's start is its first letter in the written line (what the typing counts).
    for (const p of keywordParts(line)) expect(line.slice(p.at, p.at + p.text.length)).toBe(p.text);
  });
  it("keeps a starred word it has no icon for as plain text, and reads every line without its stars", () => {
    expect(keywordParts("A *boat*.")).toEqual([{ text: "A ", at: 0 }, { text: "boat", at: 3 }, { text: ".", at: 8 }]);
    expect(plainLine("A *fish* and *bugs*.")).toBe("A fish and bugs.");
    expect(keywordParts("No marks.")).toEqual([{ text: "No marks.", at: 0 }]);
  });
});
