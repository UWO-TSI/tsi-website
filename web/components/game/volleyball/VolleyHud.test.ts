import { describe, expect, it } from "vitest";
import { shownStance } from "./VolleyHud";

describe("the action bar's row (round 3: it switches the instant you leave or touch the sand)", () => {
  it("follows your stance at once, both ways", () => {
    expect(shownStance("ground", "air")).toBe("air");
    expect(shownStance("air", "ground")).toBe("ground");
    expect(shownStance("ground", "serve")).toBe("serve");
  });
  it("keeps the last row up between points", () => {
    expect(shownStance("ground", "idle")).toBe("ground");
  });
});
