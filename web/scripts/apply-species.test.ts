import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check, editsOf, loadGame, rewrite, verify } from "./apply-species.mjs";

const SRC = readFileSync(join(__dirname, "../lib/collections/roster.ts"), "utf8");
/** A sample export, as the db lists it: one doc per species, only the fields David changed. */
const SAMPLE = [
  { id: "fish_dace", data: { rarity: "rare", price: 99, hours: [20, 4], months: [11, 9, 10], oneLiner: "Moved \"house\": nights only." } },
  { id: "fish_salmon", data: { months: [], biome: "pond" } },
  { id: "fish_catfish", data: { rainAnyHour: false, hours: null, size: [55.5, 120] } },
  { id: "bug_snail", data: { weather: [], hours: [18, 24] } },
  { id: "apple", data: { price: 10, rarity: "uncommon" } },
  { id: "rock_crystal", data: { price: 45 } },
  { id: "flower_rose", data: { weather: ["rain", "cloudy"], biome: "bush" } },
];

describe("apply-species", () => {
  it("writes a sample export into the roster, and the roster then holds exactly those values", async () => {
    const game = await loadGame(), edits = editsOf(SAMPLE);
    expect(check(edits, game)).toEqual([]);
    const src = rewrite(SRC, edits, game);
    expect(await verify(src, edits, game)).toEqual([]);
    const row = (key: string) => src.split("\n").find((l: string) => l.includes(`["${key}", `))!.trim();
    expect(row("fish_dace")).toBe('["fish_dace", "Dace", "river", "rare", [10, 18], [20, 4], { oneLiner: "Moved \\"house\\": nights only.", months: [9, 10, 11], price: 99 }],');
    expect(row("fish_salmon")).toBe('["fish_salmon", "Salmon", "pond", "uncommon", [50, 80], null, { oneLiner: "Headed upstream, like the rest of us in October." }],');
    expect(row("fish_catfish")).toBe('["fish_catfish", "Catfish", "river", "epic", [55.5, 120], null, { oneLiner: "Whiskers the size of a bookmark." }],');
    expect(row("bug_snail")).toBe('["bug_snail", "Snail", "ground", "common", null, [18, 24]],');
    // a price that is the rarity table's for its (new) rarity is no price of its own: rare minerals sell for 45
    expect(row("apple")).toBe('["apple", "Apple", "trees", "uncommon", null, null, { price: 10 }],');
    expect(row("rock_crystal")).toBe('["rock_crystal", "Crystal", "rocks", "rare", null, null],');
    // nothing else moved
    const others = (s: string) => s.split("\n").filter((l) => !SAMPLE.some((d) => l.includes(`["${d.id}", `)));
    expect(others(src)).toEqual(others(SRC));
  });

  it("refuses values the game can't take, naming each", async () => {
    const game = await loadGame();
    const bad = check(editsOf({
      fish_nope: { rarity: "rare" },
      fish_dace: { rarity: "mythic", price: 0, hours: [25, 3], months: [13], biome: "flowers", colour: "red", weather: ["fog"], rainAnyHour: "yes", size: [10, 5] },
      bug_ladybug: { size: [1, 2], hours: [6, 6], oneLiner: "No — dashes" },
      apple: { price: 2.5, months: [3, 3] },
    }), game);
    expect(bad.map((b: string) => b.slice(0, b.indexOf(":")))).toEqual([
      "fish_nope", "fish_dace.rarity", "fish_dace.price", "fish_dace.hours", "fish_dace.months", "fish_dace.biome", "fish_dace.colour",
      "fish_dace.weather", "fish_dace.rainAnyHour", "fish_dace.size", "bug_ladybug.size", "bug_ladybug.hours", "bug_ladybug.oneLiner",
      "apple.price", "apple.months",
    ]);
  });

  it("takes common to Divine and refuses Contraband", async () => {
    const game = await loadGame();
    expect(check(editsOf({ fish_dace: { rarity: "divine" }, bug_ladybug: { rarity: "legendary" } }), game)).toEqual([]);
    expect(check(editsOf({ fish_dace: { rarity: "contraband" } }), game).map((b: string) => b.slice(0, b.indexOf(":")))).toEqual(["fish_dace.rarity"]);
  });

  it("reads the export as a map or a list", () => {
    expect([...editsOf({ fish_dace: { rarity: "rare" } })]).toEqual([["fish_dace", { rarity: "rare" }]]);
    expect([...editsOf({ docs: [{ id: "fish_dace", rarity: "rare" }] })]).toEqual([["fish_dace", { rarity: "rare" }]]);
  });
});
