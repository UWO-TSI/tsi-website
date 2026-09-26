import { describe, expect, it } from "vitest";
import { bugReaction, curatorLine, fishPoolFor, fleeRadius, hasClue, hourKey, nodeAvailable, oneLinerFor, rollFishFor, rollNode, NET_REACH, SNEAK_SPEED } from "./peaceful";
import { rodByTier } from "./rods";
import { ROSTER } from "@/lib/collections/roster";

const noon = { hour: 12, weather: "clear" };
const moment = { hour: 12, month: 9, weather: "clear" as const };

describe("fish pools", () => {
  it("keeps pond species in ponds and sea species at sea", () => {
    const biome = (k: string) => ROSTER.find(s => s.key === k)?.biome;
    const pond = fishPoolFor("pond", 0, rodByTier(1), noon).map(e => e.fish.key);
    const river = fishPoolFor("river", 0, rodByTier(1), noon).map(e => e.fish.key);
    expect(pond.length).toBeGreaterThan(0);
    expect(pond.every(k => biome(k) === "pond")).toBe(true);
    expect(river.some(k => biome(k) === "pond")).toBe(false);
    expect(fishPoolFor("sea", 0, rodByTier(1), noon).every(e => (e.fish.zone ?? "river") === "sea")).toBe(true);
  });
  it("only lets top rods hook legendaries and rolls deterministically with a fixed random", () => {
    const has = (tier: number) => fishPoolFor("sea", 0, rodByTier(tier), noon).some(e => e.fish.rarity === "legendary" || e.fish.rarity === "seaking");
    expect(has(1)).toBe(false);
    expect(has(5)).toBe(true);
    expect(rollFishFor("river", 0, rodByTier(2), noon, () => 0).key).toBe(fishPoolFor("river", 0, rodByTier(2), noon)[0].fish.key);
    expect(oneLinerFor("fish_dace")).toMatch(/river fish/);
  });
});

describe("bug sneak-and-swing", () => {
  it("flees when you rush in, waits when you sneak, and is netted up close", () => {
    expect(bugReaction(5, 7, "common")).toBe("idle");
    expect(bugReaction(2, 7.4, "common")).toBe("wary");
    expect(bugReaction(2, 13.7, "common")).toBe("flee");
    expect(bugReaction(2, 7.4, "rare")).toBe("flee");
    expect(bugReaction(2, SNEAK_SPEED - 0.1, "rare")).toBe("wary");
    expect(bugReaction(NET_REACH, 1, "common")).toBe("catchable");
    expect(fleeRadius("epic")).toBeGreaterThan(fleeRadius("common"));
    expect(bugReaction(3.5, 4, "epic")).toBe("flee");
    expect(bugReaction(3.5, 4, "common")).toBe("idle");
  });
});

describe("hourly personal respawn", () => {
  const a = new Date("2026-09-24T18:10:00Z"); // 14:10 Toronto
  const b = new Date("2026-09-24T18:55:00Z"); // 14:55
  const c = new Date("2026-09-24T19:00:00Z"); // 15:00
  it("returns a harvested node at the next real hour", () => {
    expect(hourKey(a)).toBe("2026-09-24T14");
    expect(nodeAvailable(null, a)).toBe(true);
    expect(nodeAvailable(hourKey(a), b)).toBe(false);
    expect(nodeAvailable(hourKey(a), c)).toBe(true);
  });
  it("rolls a random rarity per member, node and hour, stable within the hour", () => {
    const one = rollNode("me", "shell-1", hourKey(a), ["beach"], moment);
    expect(one?.biome).toBe("beach");
    expect(rollNode("me", "shell-1", hourKey(b), ["beach"], moment)).toEqual(one);
    const picks = new Set(Array.from({ length: 60 }, (_, i) => rollNode(`m${i}`, "shell-1", hourKey(a), ["beach"], moment)?.key));
    expect(picks.size).toBeGreaterThan(2);
    expect(rollNode("me", "x", hourKey(a), ["rocks"], moment)?.category).toBe("mineral");
    expect(rollNode("me", "t", hourKey(a), ["trees"], moment, ["fruit"])?.category).toBe("fruit");
    expect(rollNode("me", "t", hourKey(a), ["trees"], { ...moment, hour: 2 }, ["bug"])?.key ?? "none").not.toMatch(/butterfly/);
    expect(hasClue(ROSTER.find(s => s.key === "shell_whelk")!)).toBe(true);
    expect(hasClue(ROSTER.find(s => s.key === "shell_asari")!)).toBe(false);
  });
});

describe("curator", () => {
  it("refuses duplicates with the curator's line and names the donor", () => {
    expect(curatorLine({ ok: false, code: "already_donated", error: "Already on display, donated by Maya." })).toMatch(/already have one.*Maya/);
    expect(curatorLine({ ok: true, name: "Dace" })).toMatch(/Dace/);
    expect(curatorLine({ ok: false, code: "not_owned" })).toMatch(/pockets/);
  });
});
