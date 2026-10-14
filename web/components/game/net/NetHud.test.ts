import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

/** Playtest round 1 (decision 3): the people and friends buttons left the HUD for the Esc Menu's Friends and mail. */
describe("the people and friends buttons", () => {
  it("are gone from the HUD; the Menu opens their sheets through the store", () => {
    const src = source("./NetHud.tsx");
    expect(src).not.toMatch(/label="People on the island"|label="Friends"/);
    expect(src).toMatch(/open=\{sheet === "people"\}/);
    expect(src).toMatch(/open=\{sheet === "friends"\}/);
  });
  it("leave no 11 px count of their own in the stylesheet (UI audit 2026-10 item 14)", () => {
    expect(source("./net.module.css")).not.toMatch(/^\.count\b/m);
  });
});
