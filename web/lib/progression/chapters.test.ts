import { describe, expect, it } from "vitest";
import { currentObjective, evaluateChapters, finishWith, personalChapter, unlockedRegions, validateAdvance, validateChapterDraft, type AdvanceAction, type ChapterFacts } from "./chapters";
import { DEFAULT_CHAPTERS } from "./defaults";
import type { MemberChapterProgress, QuestChapter } from "./types";

const now = new Date("2026-09-24T12:00:00Z");
const base: ChapterFacts = { tier: 4, firstCatchKey: null, lastFishAt: null, counts: {}, goals: { "reopen-cafe": { completed: false, myPoints: 0 }, "fund-museum": { completed: false, myPoints: 0 } } };
const bySlug = (slug: string) => DEFAULT_CHAPTERS.find((c) => c.slug === slug)!;
/** Each world's chapters, as the server lists them (drops.ts releasedChapters: a chapter's world, null for both). */
const VILLAGE = DEFAULT_CHAPTERS.filter((c) => c.world !== "new");
const NEW = DEFAULT_CHAPTERS.filter((c) => c.world !== "village");
const settle = bySlug("settle-in"), first = bySlug("first-find"), net = bySlug("odiles-net"), rod = bySlug("brams-challenge"), cafe = bySlug("reopen-cafe"), ruins = bySlug("ruins-gate");
const done = (chapter_id: string, status: "completed" | "skipped" = "completed"): MemberChapterProgress => ({ chapter_id, status, steps_done: {}, donated_item_key: null, completed_at: now.toISOString() });
/** Every chapter before `slug` in that world's order, finished. */
const before = (slug: string, list = NEW) => {
  const order = evaluateChapters(list, [], base).map((v) => v.slug);
  return order.slice(0, order.indexOf(slug)).map((s) => done(bySlug(s).id));
};
const view = (c: QuestChapter, progress: MemberChapterProgress[], facts: ChapterFacts, list = NEW) => evaluateChapters(list, progress, facts).find((v) => v.slug === c.slug)!;

describe("chapter gating, the village (as it has always played)", () => {
  it("opens only chapter 1 for a new member", () => {
    const views = evaluateChapters(VILLAGE, [], base);
    expect(views.map((v) => [v.slug, v.position, v.status])).toEqual([["settle-in", 1, "active"], ["reopen-cafe", 2, "locked"], ["fund-museum", 3, "locked"], ["ruins-gate", 4, "locked"]]);
    expect(currentObjective(views, false)).toMatchObject({ chapter_slug: "settle-in", step_key: "claim_plot", anchor: "hq" });
  });
  it("walks settle-in in order: claim, catch, donate, report", () => {
    let progress: MemberChapterProgress[] = [];
    const step = (action: AdvanceAction, facts: ChapterFacts) => {
      const r = validateAdvance(action, settle, view(settle, progress, facts, VILLAGE), progress[0], facts, now);
      if (r.ok) progress = [{ chapter_id: settle.id, ...r.next, completed_at: r.completedChapter ? now.toISOString() : null }];
      return r;
    };
    expect(step("report_hq", base)).toMatchObject({ ok: false, status: 409 });
    expect(step("claim_plot", base)).toMatchObject({ ok: true });
    expect(step("claim_plot", base)).toMatchObject({ ok: false, status: 409 });
    expect(step("donate_catch", base)).toMatchObject({ ok: false, error: "Catch a fish first." });
    const caught = { ...base, firstCatchKey: "fish_dace", counts: { fish: 1 } };
    expect(view(settle, progress, caught, VILLAGE).status).toBe("active");
    expect(step("complete", caught)).toMatchObject({ ok: false, status: 422, error: "Report to HQ to finish this chapter." });
    expect(step("donate_catch", caught)).toMatchObject({ ok: true, completedChapter: false, next: { donated_item_key: "fish_dace" } });
    expect(view(settle, progress, caught, VILLAGE).status).toBe("ready");
    expect(finishWith(evaluateChapters(VILLAGE, progress, caught), "docent")).toBeNull();
    expect(step("report_hq", caught)).toMatchObject({ ok: true, completedChapter: true, next: { status: "completed" } });
    const views = evaluateChapters(VILLAGE, progress, caught);
    expect(views[1].status).toBe("active");
    expect(unlockedRegions(views, new Set())).toEqual(["village_core"]);
  });
  it("never offers the new world's chapters", () => {
    expect(VILLAGE.map((c) => c.slug)).toEqual(["settle-in", "reopen-cafe", "fund-museum", "ruins-gate"]);
  });
});

describe("chapter gating, the new world", () => {
  it("opens only chapter 1 for a new member, the personal chapters in order before the club's", () => {
    const views = evaluateChapters(NEW, [], base);
    expect(views.map((v) => v.status)).toEqual(["active", ...Array(8).fill("locked")]);
    expect(views.map((v) => v.requirement)).toEqual(["first_find", "bug_net", "dig", "rod_challenge", "museum_collab", "pickaxe", "club_goal", "club_goal", "oracle_trial"]);
    expect(currentObjective(views, false)).toMatchObject({ chapter_slug: "first-find", step_key: "claim_plot", anchor: "hq" });
  });
  it("rejects actions on a locked chapter", () => {
    const facts = { ...base, counts: { oracle: 1, trial: 1 } };
    expect(validateAdvance("complete", ruins, view(ruins, [], facts), undefined, facts, now)).toMatchObject({ ok: false, status: 409 });
  });
  it("m1: catch, then hand it to the museum's guide, which finishes the chapter (no report to Alice)", () => {
    let progress: MemberChapterProgress[] = [];
    const step = (action: AdvanceAction, facts: ChapterFacts) => {
      const r = validateAdvance(action, first, view(first, progress, facts), progress[0], facts, now);
      if (r.ok) progress = [{ chapter_id: first.id, ...r.next, completed_at: r.completedChapter ? now.toISOString() : null }];
      return r;
    };
    expect(step("claim_plot", base)).toMatchObject({ ok: true });
    expect(step("claim_plot", base)).toMatchObject({ ok: false, status: 409 });
    expect(step("donate_catch", base)).toMatchObject({ ok: false, error: "Catch a fish first." });
    expect(step("report_hq", base)).toMatchObject({ ok: false, status: 422 });
    const caught = { ...base, firstCatchKey: "fish_dace", counts: { fish: 1 } };
    expect(view(first, progress, caught).status).toBe("ready");
    expect(finishWith(evaluateChapters(NEW, progress, caught), "docent")).toEqual({ chapter: "first-find", action: "donate_catch" });
    expect(finishWith(evaluateChapters(NEW, progress, caught), "wren")).toBeNull();
    expect(step("donate_catch", caught)).toMatchObject({ ok: true, completedChapter: true, next: { status: "completed", donated_item_key: "fish_dace" } });
    const views = evaluateChapters(NEW, progress, caught);
    expect(views[1].status).toBe("active");
    expect(unlockedRegions(views, new Set())).toEqual(["village_core"]);
  });
  it("m2: the net's steps count from the server's tallies, and only Odile finishes it", () => {
    const progress = before("odiles-net");
    const v0 = view(net, progress, base);
    expect(v0.steps.map((s) => [s.key, s.done, s.npc ?? null])).toEqual([["get_net", false, "curator"], ["catch_bugs", false, null], ["show_odile", false, "curator"]]);
    expect(v0.steps[1].count).toEqual({ have: 0, need: 3 });
    const two = { ...base, counts: { net: 1, bugs: 2 } };
    expect(view(net, progress, two).steps[1].count).toEqual({ have: 2, need: 3 });
    expect(validateAdvance("complete", net, view(net, progress, two), undefined, two, now)).toMatchObject({ ok: false, error: "Catch 3 bugs first." });
    const three = { ...base, counts: { net: 1, bugs: 5 } };
    const ready = view(net, progress, three);
    expect(ready.status).toBe("ready");
    expect(finishWith(evaluateChapters(NEW, progress, three), "curator")).toEqual({ chapter: "odiles-net", action: "complete" });
    expect(validateAdvance("complete", net, ready, undefined, three, now)).toMatchObject({ ok: true, completedChapter: true, next: { steps_done: { show_odile: now.toISOString() } } });
  });
  it("m4: the dawn-or-dusk catch counts only fresh, and only at dawn or dusk on the island", () => {
    const progress = before("brams-challenge");
    const facts = { ...base, counts: { fish_kinds: 5 }, lastFishAt: "2026-09-24T22:58:30Z" };
    const dusk = new Date("2026-09-24T23:00:00Z"); // 7 pm in Toronto, near sunset in late September
    const noon = new Date("2026-09-24T16:00:00Z");
    const v = view(rod, progress, facts);
    expect(v.status).toBe("active");
    expect(validateAdvance("twilight_catch", rod, v, undefined, { ...facts, lastFishAt: "2026-09-24T15:59:00Z" }, noon)).toMatchObject({ ok: false });
    expect(validateAdvance("twilight_catch", rod, v, undefined, { ...facts, lastFishAt: "2026-09-24T22:40:00Z" }, dusk)).toMatchObject({ ok: false });
    const r = validateAdvance("twilight_catch", rod, v, undefined, facts, dusk);
    expect(r).toMatchObject({ ok: true, completedChapter: false });
    expect(validateAdvance("twilight_catch", net, view(net, before("odiles-net"), base), undefined, facts, dusk)).toMatchObject({ ok: false, status: 422 });
    const stored: MemberChapterProgress[] = [...progress, { ...(r.ok ? r.next : done(rod.id)), chapter_id: rod.id, completed_at: null }];
    expect(view(rod, stored, facts).status).toBe("ready");
    expect(finishWith(evaluateChapters(NEW, stored, facts), "wharf-keeper")).toEqual({ chapter: "brams-challenge", action: "complete" });
  });
  it("the dropdown's chapter is the personal one, never a club goal", () => {
    const views = evaluateChapters(NEW, before("reopen-cafe"), base);
    expect(views.find((v) => v.slug === "reopen-cafe")!.status).toBe("active");
    expect(personalChapter(views)).toBeNull();
    expect(personalChapter(evaluateChapters(NEW, [], base))!.slug).toBe("first-find");
  });
  it("lets every member skip a personal chapter in one click (principle 7), honouring the admin flag", () => {
    const t5 = { ...base, tier: 5 };
    const v = view(settle, [], t5, VILLAGE);
    expect(view(first, [], t5).can_skip).toBe(true);
    expect(v.can_skip).toBe(true);
    expect(validateAdvance("skip", settle, v, undefined, t5, now)).toMatchObject({ ok: true, next: { status: "skipped" } });
    const locked = { ...settle, skippable_max_tier: 3 };
    const t4 = evaluateChapters([locked], [], base)[0];
    expect(validateAdvance("skip", locked, t4, undefined, base, now)).toMatchObject({ ok: false, status: 403 });
  });
  it("finishes a club-goal chapter only after the club goal completes", () => {
    const progress = before("reopen-cafe");
    const open = view(cafe, progress, base);
    expect(validateAdvance("complete", cafe, open, undefined, base, now)).toMatchObject({ ok: false, error: "The club goal isn't complete yet." });
    expect(validateAdvance("skip", cafe, open, undefined, { ...base, tier: 1 }, now)).toMatchObject({ ok: false, status: 403 });
    const facts = { ...base, goals: { ...base.goals, "reopen-cafe": { completed: true, myPoints: 0 } } };
    const ready = view(cafe, progress, facts);
    expect(ready.status).toBe("ready");
    expect(validateAdvance("complete", cafe, ready, undefined, facts, now)).toMatchObject({ ok: true, completedChapter: true });
  });
  it("opens goal regions for everyone once the goal completes, even with chapter 1 unfinished", () => {
    expect(unlockedRegions(evaluateChapters(NEW, [], base), new Set(["reopen-cafe"]))).toEqual(["cafe", "study_tables"]);
  });
  it("gates the ruins on the Oracle quiz and the subclass", () => {
    const progress = before("ruins-gate");
    const quizOnly = { ...base, counts: { oracle: 1 } };
    const v1 = view(ruins, progress, quizOnly);
    expect(validateAdvance("complete", ruins, v1, undefined, quizOnly, now)).toMatchObject({ ok: false, status: 409 });
    expect(currentObjective([v1], false)).toMatchObject({ step_key: "family_trial" });
    const both = { ...base, counts: { oracle: 1, trial: 1 } };
    expect(validateAdvance("complete", ruins, view(ruins, progress, both), undefined, both, now)).toMatchObject({ ok: true });
  });
  it("hides the objective line when muted", () => {
    expect(currentObjective(evaluateChapters(VILLAGE, [], base), true)).toBeNull();
  });
  it("validates chapter drafts against the step keys of their requirement", () => {
    expect(validateChapterDraft({ ...settle })).toEqual([]);
    expect(validateChapterDraft({ ...first })).toEqual([]);
    expect(validateChapterDraft({ ...rod })).toEqual([]);
    expect(validateChapterDraft({ ...settle, step_copy: { enter_gate: { label: "x" } } })).toContain("step_copy.enter_gate: not a step of settle_in");
    expect(validateChapterDraft({ ...rod, reward_item: "Cedar Rod!" })).toContain("reward_item: a shop item slug");
    expect(validateChapterDraft({ ...cafe, goal_slug: null })).toContain("club_goal chapters need a goal");
    expect(validateChapterDraft({ ...cafe, skippable_max_tier: 5 })).toContain("club_goal chapters can't be skippable");
  });
});
