import { describe, expect, it } from "vitest";
import { DROP_FEATURES, dropFlags, featureOn, parseDrop, releasedChapters, releasedGoals, resolveDrop } from "./drops";
import { DEFAULT_CHAPTERS, DEFAULT_GOALS } from "@/lib/progression/defaults";
import { currentObjective, evaluateChapters, validateAdvance } from "@/lib/progression/chapters";
import { GAME_WORLD } from "./world/active";

describe("drops (specs/v1-drop.md, the roadmap)", () => {
  it("v1 Arrival: the café is closed, the mountain sealed, combat and the home island hidden", () => {
    const v1 = dropFlags(1);
    expect(v1.cafe).toBe(false);
    expect(v1.mountain).toBe(false);
    expect(v1.oracle).toBe(false);
    expect(v1.combat).toBe(false);
    expect(v1.classes).toBe(false);
    expect(v1.weapons).toBe(false);
    expect(v1.ruins).toBe(false);
    expect(v1.forest).toBe(false);
    expect(v1.homeIsland).toBe(false);
    expect(v1.northIsland).toBe(false);
  });

  it("each later drop switches its own things on and keeps the earlier ones", () => {
    expect(dropFlags(2)).toMatchObject({ cafe: true, mountain: true, oracle: true, combat: false, homeIsland: false });
    expect(dropFlags(3)).toMatchObject({ cafe: true, mountain: true, combat: true, classes: true, weapons: true, ruins: true, forest: true, homeIsland: false });
    expect(dropFlags(4)).toMatchObject({ cafe: true, combat: true, homeIsland: true });
  });

  it("the north island waits for David's call: no drop builds its bridge yet", () => {
    expect(DROP_FEATURES.northIsland).toBeNull();
    for (const d of [1, 2, 3, 4] as const) expect(featureOn("northIsland", d)).toBe(false);
  });

  it("every feature is on from its drop onward and never before", () => {
    for (const [feature, at] of Object.entries(DROP_FEATURES) as [keyof typeof DROP_FEATURES, number | null][]) {
      for (const d of [1, 2, 3, 4] as const) expect(featureOn(feature, d)).toBe(at !== null && d >= at);
    }
  });

  it("reads the drop from NEXT_PUBLIC_GAME_DROP, defaulting to v1", () => {
    expect(parseDrop("2")).toBe(2);
    expect(parseDrop("v3")).toBe(3);
    expect(parseDrop("5")).toBeNull();
    expect(parseDrop("")).toBeNull();
    expect(parseDrop(undefined)).toBeNull();
    expect(resolveDrop({ env: undefined, search: "", production: true })).toBe(1);
    expect(resolveDrop({ env: "4", search: "", production: true })).toBe(4);
    expect(resolveDrop({ env: "nonsense", search: "", production: true })).toBe(1);
  });

  it("offers only the goals and chapters whose regions are out: no café fund or ruins chapter in v1", () => {
    const goals = DEFAULT_GOALS.filter(g => g.goal_type === "story");
    expect(goals.map(g => g.slug)).toEqual(["reopen-cafe", "fund-museum"]);
    expect(releasedGoals(goals, dropFlags(1)).map(g => g.slug)).toEqual(["fund-museum"]);
    expect(releasedGoals(goals, dropFlags(2)).map(g => g.slug)).toEqual(["reopen-cafe", "fund-museum"]);
    // Seasonal goals open no region: always offered.
    expect(releasedGoals(DEFAULT_GOALS, dropFlags(1)).filter(g => g.goal_type === "seasonal")).toHaveLength(DEFAULT_GOALS.filter(g => g.goal_type === "seasonal").length);
    // Each world's chapters: the village keeps its settle-in, the new world has the main quest (a chapter's world).
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), "village").map(c => c.slug)).toEqual(["settle-in", "fund-museum"]);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(3), "village").map(c => c.slug)).toEqual(["settle-in", "reopen-cafe", "fund-museum", "ruins-gate"]);
    const errands = ["first-find", "odiles-net", "pims-shovel", "brams-challenge", "the-museum", "elizas-pickaxe"];
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), "new").map(c => c.slug)).toEqual([...errands, "fund-museum"]);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(3), "new").map(c => c.slug)).toEqual([...errands, "reopen-cafe", "fund-museum", "ruins-gate"]);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(1))).toEqual(releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), GAME_WORLD));
  });

  it("village: hides claiming your plot until the home island's drop, and the chapter can still finish", () => {
    const [settle] = releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), "village");
    expect(settle.slug).toBe("settle-in");
    expect(settle.hidden_steps).toEqual(["claim_plot"]);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(4), "village")[0].hidden_steps).toBeUndefined();
    const facts = { tier: 5, firstCatchKey: "fish_bass", lastFishAt: null, counts: { fish: 1 }, goals: {} };
    const [view] = evaluateChapters([settle], [{ chapter_id: settle.id, status: "active", steps_done: { donate_catch: "2026-10-30T00:00:00Z" }, donated_item_key: "fish_bass", completed_at: null }], facts);
    expect(view.steps.map(s => s.key)).toEqual(["first_catch", "donate_catch", "report_hq"]);
    expect(view.status).toBe("ready");
    expect(currentObjective(evaluateChapters([settle], [], facts), false)?.step_key).toBe("donate_catch");
    const fresh = evaluateChapters([settle], [], { ...facts, firstCatchKey: null, counts: {} });
    expect(currentObjective(fresh, false)?.text).not.toMatch(/plot/i);
    expect(validateAdvance("claim_plot", settle, fresh[0], undefined, facts, new Date()).ok).toBe(false);
  });

  it("new world: hides claiming your plot until the home island's drop, and the chapter can still finish", () => {
    const [settle] = releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), "new");
    expect(settle.slug).toBe("first-find");
    expect(settle.hidden_steps).toEqual(["claim_plot"]);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(4), "new")[0].hidden_steps).toBeUndefined();
    const facts = { tier: 5, firstCatchKey: "fish_bass", lastFishAt: null, counts: { fish: 1 }, goals: {} };
    const [view] = evaluateChapters([settle], [], facts);
    expect(view.steps.map(s => s.key)).toEqual(["first_catch", "donate_catch"]);
    expect(view.status).toBe("ready");
    expect(currentObjective(evaluateChapters([settle], [], facts), false)?.step_key).toBe("donate_catch");
    const fresh = evaluateChapters([settle], [], { ...facts, firstCatchKey: null, counts: {} });
    expect(currentObjective(fresh, false)?.text).not.toMatch(/plot/i);
    expect(validateAdvance("claim_plot", settle, fresh[0], undefined, facts, new Date()).ok).toBe(false);
  });

  it("the dev preview ?drop= overrides, never in production", () => {
    expect(resolveDrop({ env: "1", search: "?drop=3", production: false })).toBe(3);
    expect(resolveDrop({ env: "1", search: "?drop=3", production: true })).toBe(1);
    expect(resolveDrop({ env: "2", search: "?drop=junk", production: false })).toBe(2);
  });
});
