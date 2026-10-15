import { describe, expect, it } from "vitest";
import { chapterQuest, currentStep, questProgress, type TrackedQuest } from "./questTracker";

const quest = (done: number, n = 10, current?: string): TrackedQuest => ({
  id: "q", title: "Walk with Bram", kind: "tutorial", current,
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, label: `Step ${i}`, done: i < done })),
});

describe("the quest tracker's one line: the task being worked on", () => {
  it("is the first step not done, the first one while nothing is done", () => {
    expect(currentStep(quest(0))).toEqual({ step: { id: "s0", label: "Step 0", done: false }, complete: false });
    expect(currentStep(quest(4)).step?.id).toBe("s4");
  });
  it("follows an explicit current step", () => {
    expect(currentStep(quest(2, 10, "s6")).step?.id).toBe("s6");
    expect(currentStep(quest(2, 10, "gone")).step?.id).toBe("s2");
  });
  it("is nothing once every step is ticked: the quest is complete", () => {
    expect(currentStep(quest(10))).toEqual({ step: null, complete: true });
    expect(questProgress(quest(10))).toEqual({ done: 10, of: 10 });
    expect(currentStep(quest(0, 0))).toEqual({ step: null, complete: false });
  });
});

describe("the chapter being worked on, as the HUD's tracker shows it", () => {
  const steps = [{ key: "claim_plot", label: "Claim your plot", done: true }, { key: "first_catch", label: "Catch a fish", done: false, hint: "Take out your rod" }, { key: "report_hq", label: "Report to HQ", done: false }];
  const chapters = [{ slug: "arrival", title: "Arrival", status: "completed", steps: [] }, { slug: "settle_in", title: "Settle in", status: "active", steps }];
  it("is the active (or ready) chapter's steps, with the next step's hint", () => {
    const q = chapterQuest(chapters, true)!;
    expect(q).toMatchObject({ id: "chapter:settle_in", title: "Settle in", kind: "chapter", hint: "Take out your rod" });
    expect(q.steps.map(s => [s.id, s.done])).toEqual([["claim_plot", true], ["first_catch", false], ["report_hq", false]]);
    expect(currentStep(q).step?.label).toBe("Catch a fish");
    expect(chapterQuest([{ ...chapters[1], status: "ready" }], true)?.id).toBe("chapter:settle_in");
  });
  it("is nothing with no chapter on, or with the quests muted", () => {
    expect(chapterQuest([chapters[0]], true)).toBeNull();
    expect(chapterQuest(chapters, false)).toBeNull();
  });
});
