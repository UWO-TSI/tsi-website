import { describe, expect, it } from "vitest";
import { levelUnlocks } from "./levelUp";
import { evaluateChapters } from "@/lib/progression/chapters";
import { DEFAULT_CHAPTERS } from "@/lib/progression/defaults";
import { releasedChapters, dropFlags } from "./drops";

const facts = { tier: 5, firstCatchKey: "fish_dace", lastFishAt: null, counts: {}, goals: {} };

describe("what a level up opens (only what's real)", () => {
  const chapters = releasedChapters(DEFAULT_CHAPTERS, dropFlags(1), "new");
  const first = chapters.find(c => c.slug === "first-find")!;
  const views = evaluateChapters(chapters, [{ chapter_id: first.id, status: "completed", steps_done: {}, donated_item_key: "fish_dace", completed_at: "2026-10-28T00:00:00Z" } as never], facts);

  it("after chapter 1: Odile's net, the next quest, and no stat points while the Path sheet is out", () => {
    expect(levelUnlocks(views, false)).toEqual([{ kind: "quest", title: "New quest: Odile's net", detail: expect.stringContaining("Odile") }]);
  });
  it("with the classes out, the level's stat points too", () => {
    expect(levelUnlocks(views, true).map(u => u.kind)).toEqual(["quest", "points"]);
  });
  it("chapter 1 pays exactly a level's XP", async () => {
    const { xpForLevel } = await import("@/lib/combat/progression");
    expect(first.reward_xp).toBe(xpForLevel(2));
  });
});
