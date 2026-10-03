import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BountyDifficulty } from "./BountyDifficulty";

const html = (level: number) => renderToStaticMarkup(createElement(BountyDifficulty, { level }));

describe("bounty difficulty on the member board (#28)", () => {
  it("shows every level admins approve at, 1 to 5, as that many skulls", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const out = html(level);
      expect(out).toContain(`Difficulty ${level} of 5`);
      expect(out.match(/lucide-skull/g)).toHaveLength(level);
    }
  });
  it("shows nothing for a level outside 1 to 5", () => {
    expect(html(0)).toBe("");
    expect(html(6)).toBe("");
  });
});
