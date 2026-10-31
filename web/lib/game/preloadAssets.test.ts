import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_ASSETS } from "./preloadAssets";

describe("the title page's prefetch list", () => {
  it("names only files that ship, once each (regenerate with specs/perf/entry-trace.mjs MANIFEST=1)", () => {
    expect(GAME_ASSETS.length).toBeGreaterThan(0);
    expect(GAME_ASSETS.filter(p => !existsSync(join(__dirname, "../../public", decodeURIComponent(p))))).toEqual([]);
    expect(new Set(GAME_ASSETS).size).toBe(GAME_ASSETS.length);
  });
});
