import { describe, expect, it } from "vitest";
import { currentObjective, evaluateChapters, unlockedRegions, validateAdvance, validateChapterDraft, type ChapterFacts } from "./chapters";
import { DEFAULT_CHAPTERS } from "./defaults";
import type { MemberChapterProgress } from "./types";

const now = new Date("2026-09-24T12:00:00Z");
const base: ChapterFacts = { tier: 4, oracleDone: false, trialDone: false, firstCatchKey: null, goals: { "reopen-cafe": { completed: false, myPoints: 0 }, "fund-museum": { completed: false, myPoints: 0 } } };
const [settle, cafe, , ruins] = DEFAULT_CHAPTERS;
const done = (chapter_id: string, status: "completed" | "skipped" = "completed"): MemberChapterProgress => ({ chapter_id, status, steps_done: {}, donated_item_key: null, completed_at: now.toISOString() });

describe("chapter gating", () => {
  it("opens only chapter 1 for a new member", () => {
    const views = evaluateChapters(DEFAULT_CHAPTERS, [], base);
    expect(views.map((v) => v.status)).toEqual(["active", "locked", "locked", "locked"]);
    expect(currentObjective(views, false)).toMatchObject({ chapter_slug: "settle-in", step_key: "claim_plot", anchor: "hq" });
  });
  it("rejects actions on a locked chapter", () => {
    const facts = { ...base, oracleDone: true, trialDone: true };
    const view = evaluateChapters(DEFAULT_CHAPTERS, [], facts)[3];
    expect(validateAdvance("complete", ruins, view, undefined, facts, now)).toMatchObject({ ok: false, status: 409 });
  });
  it("walks settle-in in order: claim, catch, donate, report", () => {
    let progress: MemberChapterProgress[] = [];
    const step = (action: "claim_plot" | "donate_catch" | "report_hq", facts: ChapterFacts) => {
      const view = evaluateChapters(DEFAULT_CHAPTERS, progress, facts)[0];
      const r = validateAdvance(action, settle, view, progress[0], facts, now);
      if (r.ok) progress = [{ chapter_id: settle.id, ...r.next, completed_at: r.completedChapter ? now.toISOString() : null }];
      return r;
    };
    expect(step("report_hq", base)).toMatchObject({ ok: false, status: 409 });
    expect(step("claim_plot", base)).toMatchObject({ ok: true });
    expect(step("claim_plot", base)).toMatchObject({ ok: false, status: 409 });
    expect(step("donate_catch", base)).toMatchObject({ ok: false, error: "Catch a fish first." });
    const caught = { ...base, firstCatchKey: "fish_dace" };
    expect(step("donate_catch", caught)).toMatchObject({ ok: true, next: { donated_item_key: "fish_dace" } });
    expect(evaluateChapters(DEFAULT_CHAPTERS, progress, caught)[0].status).toBe("ready");
    expect(step("report_hq", caught)).toMatchObject({ ok: true, completedChapter: true, next: { status: "completed" } });
    const views = evaluateChapters(DEFAULT_CHAPTERS, progress, caught);
    expect(views[1].status).toBe("active");
    expect(unlockedRegions(views, new Set())).toEqual(["village_core"]);
  });
  it("lets every member skip settle-in in one click (principle 7), honouring the admin flag", () => {
    const t5 = { ...base, tier: 5 };
    const view = evaluateChapters(DEFAULT_CHAPTERS, [], t5)[0];
    expect(view.can_skip).toBe(true);
    expect(validateAdvance("skip", settle, view, undefined, t5, now)).toMatchObject({ ok: true, next: { status: "skipped" } });
    const locked = { ...settle, skippable_max_tier: 3 };
    const t4 = evaluateChapters([locked], [], base)[0];
    expect(validateAdvance("skip", locked, t4, undefined, base, now)).toMatchObject({ ok: false, status: 403 });
  });
  it("finishes a club-goal chapter only after the club goal completes", () => {
    const progress = [done(settle.id)];
    const open = evaluateChapters(DEFAULT_CHAPTERS, progress, base)[1];
    expect(validateAdvance("complete", cafe, open, undefined, base, now)).toMatchObject({ ok: false, error: "The club goal isn't complete yet." });
    expect(validateAdvance("skip", cafe, open, undefined, { ...base, tier: 1 }, now)).toMatchObject({ ok: false, status: 403 });
    const flagged = { ...cafe, skippable_max_tier: 5 };
    expect(evaluateChapters([settle, flagged], [done(settle.id)], { ...base, tier: 1 })[1].can_skip).toBe(false);
    const facts = { ...base, goals: { ...base.goals, "reopen-cafe": { completed: true, myPoints: 0 } } };
    const ready = evaluateChapters(DEFAULT_CHAPTERS, progress, facts)[1];
    expect(ready.status).toBe("ready");
    expect(validateAdvance("complete", cafe, ready, undefined, facts, now)).toMatchObject({ ok: true, completedChapter: true });
  });
  it("opens goal regions for everyone once the goal completes, even with chapter 1 unfinished", () => {
    const views = evaluateChapters(DEFAULT_CHAPTERS, [], base);
    expect(unlockedRegions(views, new Set(["reopen-cafe"]))).toEqual(["cafe", "study_tables"]);
  });
  it("gates the ruins on the Oracle quiz and the family trial", () => {
    const progress = [done(DEFAULT_CHAPTERS[0].id), done(DEFAULT_CHAPTERS[1].id), done(DEFAULT_CHAPTERS[2].id)];
    const quizOnly = { ...base, oracleDone: true };
    const v1 = evaluateChapters(DEFAULT_CHAPTERS, progress, quizOnly)[3];
    expect(validateAdvance("complete", ruins, v1, undefined, quizOnly, now)).toMatchObject({ ok: false, status: 409 });
    expect(currentObjective([v1], false)).toMatchObject({ step_key: "family_trial" });
    const both = { ...quizOnly, trialDone: true };
    const v2 = evaluateChapters(DEFAULT_CHAPTERS, progress, both)[3];
    expect(validateAdvance("complete", ruins, v2, undefined, both, now)).toMatchObject({ ok: true });
  });
  it("hides the objective line when muted", () => {
    expect(currentObjective(evaluateChapters(DEFAULT_CHAPTERS, [], base), true)).toBeNull();
  });
  it("validates chapter drafts against the step keys of their requirement", () => {
    expect(validateChapterDraft({ ...settle })).toEqual([]);
    expect(validateChapterDraft({ ...settle, step_copy: { enter_gate: { label: "x" } } })).toContain("step_copy.enter_gate: not a step of settle_in");
    expect(validateChapterDraft({ ...cafe, goal_slug: null })).toContain("club_goal chapters need a goal");
    expect(validateChapterDraft({ ...cafe, skippable_max_tier: 5 })).toContain("club_goal chapters can't be skippable");
  });
});
