import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The people button's count (UI audit 2026-10 item 14): the kit's Counter through IconButton's badge, not an 11 px badge of its own. */
const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("the people button's count", () => {
  it("is IconButton's badge", () => {
    const src = source("./NetHud.tsx");
    expect(src).toMatch(/<IconButton[^>]*\bbadge=\{n\}/);
    expect(src).not.toMatch(/className=\{s\.count\}/);
  });
  it("has no 11 px count of its own left in the stylesheet", () => {
    expect(source("./net.module.css")).not.toMatch(/^\.count\b/m);
  });
});
