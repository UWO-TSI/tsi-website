import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("residents' frame loop", () => {
  it("keeps React state out of it: the overhead UI is toggled through refs", () => {
    const src = readFileSync(new URL("./NPC.tsx", import.meta.url), "utf8");
    expect(src).not.toMatch(/\buseState\s*[(<]/);
  });
});
