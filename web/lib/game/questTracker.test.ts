import { describe, expect, it } from "vitest";
import { currentStep, questProgress, type TrackedQuest } from "./questTracker";

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
