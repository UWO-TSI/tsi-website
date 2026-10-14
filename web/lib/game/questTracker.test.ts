import { describe, expect, it } from "vitest";
import { questProgress, trackerRows, type TrackedQuest } from "./questTracker";

const quest = (done: number, n = 10, current?: string): TrackedQuest => ({
  id: "q", title: "Walk with Bram", kind: "tutorial", current,
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, label: `Step ${i}`, done: i < done })),
});

describe("the quest tracker's rows", () => {
  it("lists from the start while nothing is done, the first step current, the rest counted", () => {
    const r = trackerRows(quest(0));
    expect(r.rows.map(x => x.id)).toEqual(["s0", "s1", "s2", "s3", "s4"]);
    expect(r.rows.filter(x => x.current).map(x => x.id)).toEqual(["s0"]);
    expect([r.above, r.below, r.complete]).toEqual([0, 5, false]);
  });
  it("keeps one done step above the current one and folds the earlier ones", () => {
    const r = trackerRows(quest(4));
    expect(r.rows.map(x => [x.id, x.done, x.current])).toEqual([["s3", true, false], ["s4", false, true], ["s5", false, false], ["s6", false, false], ["s7", false, false]]);
    expect([r.above, r.below]).toEqual([3, 2]);
  });
  it("follows an explicit current step, and near the end shows the last rows", () => {
    expect(trackerRows(quest(2, 10, "s6")).rows.find(x => x.current)?.id).toBe("s6");
    const end = trackerRows(quest(9));
    expect(end.rows.map(x => x.id)).toEqual(["s5", "s6", "s7", "s8", "s9"]);
    expect(end.below).toBe(0);
  });
  it("is complete when every step is ticked, none current", () => {
    const r = trackerRows(quest(10));
    expect(r.complete).toBe(true);
    expect(r.rows.some(x => x.current)).toBe(false);
    expect(questProgress(quest(10))).toEqual({ done: 10, of: 10 });
  });
  it("takes a smaller window (a phone) and short quests whole", () => {
    expect(trackerRows(quest(1), 2).rows.map(x => x.id)).toEqual(["s0", "s1"]);
    expect(trackerRows(quest(0, 3)).rows.length).toBe(3);
  });
});
