import { describe, expect, it } from "vitest";
import { previewState } from "./client";
import { applyGoalOverride, parseGoalOverride } from "./devOverride";
import { toWorldProgression } from "./worldBridge";

const resolve = (a: string) => (a === "hq" ? ([0, 6.3] as [number, number]) : null);

describe("?goal= dev override", () => {
  it("parses fraction and slug forms, and is off in production", () => {
    expect(parseGoalOverride("?goal=0.6", false)).toEqual({ slug: null, fraction: 0.6 });
    expect(parseGoalOverride("?goal=fund-museum:1.4", false)).toEqual({ slug: "fund-museum", fraction: 1 });
    expect(parseGoalOverride("?goal=abc", false)).toBeNull();
    expect(parseGoalOverride("?goal=0.6", true)).toBeNull();
  });
  it("sets the active goal's points, percent and monument stage", () => {
    const s = applyGoalOverride(previewState(), { slug: null, fraction: 0.6 });
    expect(s.goals[0]).toMatchObject({ slug: "reopen-cafe", points: 9000, percent: 60, stage: 2, completed: false });
  });
});

describe("world bridge contract", () => {
  it("maps state into the island's WorldProgression shape", () => {
    const w = toWorldProgression(previewState(), resolve);
    expect(w.activeGoal).toEqual({ id: "cafe", label: "Reopen the cafe", progress: 0, completed: false });
    expect(w.objective).toEqual({ text: "Claim your plot at HQ", target: [0, 6.3], anchor: "hq" });
    expect(w.completedGoals).toEqual([]);
  });
  it("keeps a just-completed goal on the monument so the ceremony can play", () => {
    const done = applyGoalOverride(previewState(), { slug: "reopen-cafe", fraction: 1 });
    const w = toWorldProgression({ ...done, goals: done.goals.map((g) => (g.slug === "fund-museum" ? { ...g, open: false } : g)) }, resolve);
    expect(w.activeGoal).toMatchObject({ id: "cafe", progress: 1, completed: true });
    expect(w.completedGoals).toEqual(["cafe"]);
    expect(w.recentlyCompleted).toMatchObject({ id: "cafe", completed: true });
  });
});
