/**
 * The village plays exactly as it did before the main quest (lane main-quest; the coordinator, 2026-10-28). Prod runs the
 * village by default; everything the main quest adds is the new world's (NEXT_PUBLIC_GAME_WORLD=new) or world-aware data
 * whose village rows are unchanged. VILLAGE_BASE is the village at 80816727, generated from that commit's modules.
 * Pure checks name their world; the ones that read a module-level world (ROSTER, TOOL_LINES, SWEEPER_LINES) run in the
 * village only (vitest without NEXT_PUBLIC_GAME_WORLD).
 */
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { currentObjective, evaluateChapters, normalizeChapter, validateAdvance, type ChapterFacts } from "@/lib/progression/chapters";
import { DEFAULT_CHAPTERS } from "@/lib/progression/defaults";
import type { MemberChapterProgress } from "@/lib/progression/types";
import { dropFlags, releasedChapters } from "./drops";
import { villageNodes } from "./islandNodes";
import { village } from "./villageMap";
import { BURIED_FINDS, ROSTER, inWorld, toolOf } from "@/lib/collections/roster";
import { PROPOSED_RESIDENTS, RESIDENT_TALK, residentsHere } from "@/lib/content/residentRoster";
import { HQ_TRACKER, TOOL_LINES, WREN_LINES } from "./arrival/hq/lines";
import { SWEEPER_LINES } from "./cafe";
import { GAME_WORLD } from "./world/active";
import QuestTracker from "@/components/game/QuestTracker";
import { VILLAGE_BASE } from "./villagePinned.fixture";

const VILLAGE = GAME_WORLD === "village";
/** 80816727's rock yield (lib/collections/roster.ts): every mineral, struck with the shovel. */
const VILLAGE_BASE_MINERALS = ["rock_stone", "rock_clay", "rock_iron_nugget", "rock_gold_nugget", "rock_crystal"];
const now = new Date("2026-10-28T12:00:00Z");
const goals = { "reopen-cafe": { completed: false, myPoints: 0 }, "fund-museum": { completed: false, myPoints: 0 } };
/** The server's facts: the fish counts come from the same rows as the first catch (lib/progression/facts.ts). */
const facts = (firstCatchKey: string | null): ChapterFacts => ({ tier: 4, firstCatchKey, lastFishAt: null, counts: firstCatchKey ? { fish: 1 } : {}, goals });
/** The database's chapter rows after the migration: 80816727's, with settle-in marked the village's, read by the server. */
const ROWS = VILLAGE_BASE.CHAPTERS.map((c) => normalizeChapter({ ...structuredClone(c), world: c.slug === "settle-in" ? "village" : null } as Record<string, unknown>));
/** What the village's server lists in v1 (the home island's drop is later, so claiming the plot is hidden). */
const v1 = releasedChapters(ROWS, dropFlags(1), "village");
const SETTLE = ROWS[0];
const row = (status: MemberChapterProgress["status"], steps: Record<string, string>, completed_at: string | null = null): MemberChapterProgress[] =>
  [{ chapter_id: SETTLE.id, status, steps_done: steps, donated_item_key: steps.donate_catch ? "fish_dace" : null, completed_at }];
const steps = (views: ReturnType<typeof evaluateChapters>) => views.map((v) => [v.slug, v.position, v.status, v.steps.map((s) => `${s.key}:${s.done ? "done" : "open"}`).join(" ")]);

describe("the village's chapters, read from the migrated rows", () => {
  it("keeps 80816727's rows: the village lists settle-in and the club's chapters at their positions, never the new world's", () => {
    expect(ROWS.map((c) => [c.slug, c.position, c.world])).toEqual([["settle-in", 1, "village"], ["reopen-cafe", 2, null], ["fund-museum", 3, null], ["ruins-gate", 4, null]]);
    expect(v1.map((c) => [c.slug, c.position])).toEqual([["settle-in", 1], ["fund-museum", 3]]);
    // Today's defaults are those rows, plus the new world's (which the village never lists).
    const village = DEFAULT_CHAPTERS.filter((c) => c.world !== "new");
    expect(village.map((c) => c.reward_item)).toEqual([null, null, null, null]);
    expect(village.map((c) => { const { world, reward_item, ...rest } = c; void world; void reward_item; return rest; })).toEqual(VILLAGE_BASE.CHAPTERS);
    expect(releasedChapters(DEFAULT_CHAPTERS, dropFlags(3), "village").map((c) => c.slug)).toEqual(["settle-in", "reopen-cafe", "fund-museum", "ruins-gate"]);
  });

  it("reads a player's settle-in in progress, donation stored, exactly as before: ready, and Alice finishes it", () => {
    // Donated, and the fish sold since: the first catch still shows done (row 101).
    const progress = row("active", { first_catch: "t", donate_catch: "t" });
    const views = evaluateChapters(v1, progress, facts(null));
    expect(steps(views)).toEqual([["settle-in", 1, "ready", "first_catch:done donate_catch:done report_hq:open"], ["fund-museum", 3, "locked", "contribute:open goal_complete:open"]]);
    expect(currentObjective(views, false)).toEqual({ chapter_slug: "settle-in", step_key: "report_hq", text: "Report back to Alice at HQ", anchor: "hq" });
    expect(views[0].can_skip).toBe(true);
    expect(validateAdvance("donate_catch", v1[0], views[0], progress[0], facts("fish_dace"), now)).toEqual({ ok: false, status: 409, error: "Already donated." });
    expect(validateAdvance("complete", v1[0], views[0], progress[0], facts(null), now)).toEqual({ ok: false, status: 422, error: "Report to HQ to finish this chapter." });
    expect(validateAdvance("report_hq", v1[0], views[0], progress[0], facts(null), now)).toEqual({
      ok: true, completedChapter: true, next: { status: "completed", steps_done: { first_catch: "t", donate_catch: "t", report_hq: now.toISOString() }, donated_item_key: "fish_dace" },
    });
  });

  it("reads a player's settle-in in progress, plot claimed, exactly as before: the donation next", () => {
    const progress = row("active", { claim_plot: "t" });
    const all = releasedChapters(ROWS, dropFlags(4), "village");
    const views = evaluateChapters(all, progress, facts("fish_dace"));
    expect(steps(views)[0]).toEqual(["settle-in", 1, "active", "claim_plot:done first_catch:done donate_catch:open report_hq:open"]);
    expect(currentObjective(views, false)).toEqual({ chapter_slug: "settle-in", step_key: "donate_catch", text: "Donate your catch to the museum shell", anchor: "museum" });
    expect(validateAdvance("report_hq", all[0], views[0], progress[0], facts("fish_dace"), now)).toEqual({ ok: false, status: 409, error: "Claim your plot and donate a catch first." });
    expect(validateAdvance("donate_catch", all[0], views[0], progress[0], facts("fish_dace"), now)).toEqual({
      ok: true, completedChapter: false, next: { status: "active", steps_done: { claim_plot: "t", first_catch: now.toISOString(), donate_catch: now.toISOString() }, donated_item_key: "fish_dace" },
    });
  });

  it("reads a player's finished settle-in exactly as before: done, and the museum fund is next", () => {
    const progress = row("completed", { claim_plot: "t", first_catch: "t", donate_catch: "t", report_hq: "t" }, "2026-10-20T00:00:00Z");
    const views = evaluateChapters(v1, progress, facts("fish_dace"));
    expect(steps(views)).toEqual([["settle-in", 1, "completed", "first_catch:done donate_catch:done report_hq:done"], ["fund-museum", 3, "active", "contribute:open goal_complete:open"]]);
    expect(views[0]).toMatchObject({ can_skip: false, completed_at: "2026-10-20T00:00:00Z" });
    expect(currentObjective(views, false)).toEqual({ chapter_slug: "fund-museum", step_key: "contribute", text: "Contribute to the museum fund", anchor: "monument" });
    expect(validateAdvance("report_hq", v1[0], views[0], progress[0], facts("fish_dace"), now)).toMatchObject({ ok: false, status: 409 });
    // A skipped one reads as skipped, and the next chapter opens.
    expect(steps(evaluateChapters(v1, row("skipped", {}, "2026-10-20T00:00:00Z"), facts(null))).map((v) => v[2])).toEqual(["skipped", "active"]);
  });
});

describe("the village's rocks, digging and finds", () => {
  const nodes = villageNodes(village(), "village");
  it("strikes rocks with the shovel for every mineral, as before", () => {
    const rocks = nodes.forage.filter((n) => n.id.startsWith("rock-"));
    expect(rocks.length).toBeGreaterThan(0);
    for (const n of rocks) expect(n.only, n.id).toBeUndefined();
    for (const sp of ROSTER.filter((s) => VILLAGE_BASE_MINERALS.includes(s.key))) expect(toolOf(sp, "village"), sp.key).toBe("shovel");
  });
  it("has no dig spots and no buried finds, in the world or the database's roster", () => {
    expect(nodes.forage.some((n) => n.id.startsWith("dig-"))).toBe(false);
    for (const sp of BURIED_FINDS) expect(inWorld(sp, "village"), sp.key).toBe(false);
  });
  it.runIf(VILLAGE)("keeps the finds out of the village's ROSTER", () => {
    expect(ROSTER.some((s) => s.biome === "dig_sand" || s.biome === "dig_soil")).toBe(false);
    expect(ROSTER.filter((s) => s.biome === "rocks").map((s) => s.key)).toEqual(VILLAGE_BASE_MINERALS);
  });
});

describe("the village's people", () => {
  it("has no Juno, and everyone else as they were", () => {
    const here = residentsHere(PROPOSED_RESIDENTS, "village");
    expect(here.some((r) => r.slug === "docent")).toBe(false);
    expect(residentsHere(PROPOSED_RESIDENTS, "new").some((r) => r.slug === "docent")).toBe(true);
    const lines = Object.fromEntries(here.map((r) => [r.slug, { talk: r.talk ?? null, canned_dialogue: r.canned_dialogue ?? null }]));
    expect(lines).toEqual(VILLAGE_BASE.RESIDENT_LINES);
    expect(Object.fromEntries(Object.entries(RESIDENT_TALK).filter(([slug]) => slug !== "docent"))).toEqual(VILLAGE_BASE.RESIDENT_TALK);
  });
  it.runIf(VILLAGE)("says the village's words: the tool teachers, Alice (her farewell too), Rosa out front", () => {
    expect(TOOL_LINES).toEqual(VILLAGE_BASE.TOOL_LINES);
    expect(WREN_LINES).toEqual(VILLAGE_BASE.WREN_LINES);
    expect(HQ_TRACKER).toEqual(VILLAGE_BASE.HQ_TRACKER);
    expect(SWEEPER_LINES).toEqual(VILLAGE_BASE.SWEEPER_LINES);
  });
});

describe("the village's quest tracker", () => {
  it("is the one line that opens the journal, with no dropdown", () => {
    const quest = { id: "chapter:settle-in", title: "Settle in", kind: "chapter" as const, steps: [{ id: "first_catch", label: "Make your first catch", done: true }, { id: "donate_catch", label: "Donate your catch to the museum shell", done: false }] };
    const markup = renderToStaticMarkup(h(QuestTracker, { quests: [quest], onOpen: () => {}, dropdown: false })).replace(/ class="[^"]*"/g, "");
    // 80816727's markup for the same quest, class names aside.
    expect(markup).toBe('<aside data-kind="chapter" aria-label="Chapter: Settle in" data-testid="quest-tracker"><button type="button" title="Settle in · 1/2. Open Quests and journal"><span aria-hidden="true">◆</span><span>Donate your catch to the museum shell</span><span> (Settle in, 1 of 2 done)</span></button><p role="status" aria-live="polite">Next: Donate your catch to the museum shell</p></aside>');
  });
});
