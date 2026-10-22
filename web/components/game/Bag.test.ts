import { describe, expect, it } from "vitest";
import { bagKind } from "./Bag";

// The bag's rail filters (specs/polish/flat-ui.md round 2: "side tab icon for bag filter for fish adn bug and furnature").
describe("which filter a pocket item is under", () => {
  it("files fish and sea creatures, bugs, forage and fruit, and materials", () => {
    expect(bagKind("fish_black_bass")).toBe("fish");
    expect(bagKind("sea_scallop")).toBe("fish");
    expect(bagKind("bug_common_butterfly")).toBe("bugs");
    expect(bagKind("apple")).toBe("forage");
    expect(bagKind("shell_scallop")).toBe("forage");
    expect(bagKind("wood_branch")).toBe("materials");
  });
  it("leaves a key the roster doesn't know under everything only", () => {
    expect(bagKind("no-such-thing")).toBe("other");
  });
});
