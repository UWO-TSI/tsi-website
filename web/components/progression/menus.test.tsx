import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoalProgressView, LetterView } from "@/lib/progression/types";
import { DEFAULT_GOALS } from "@/lib/progression/defaults";
import { previewState } from "@/lib/progression/client";
import ClubGoal, { UpNextGoal, goalKind, isUpNext } from "./ClubGoal";
import { JournalBody } from "./JournalSheet";
import { fromLine } from "./LettersSheet";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const state = previewState();
const goal = (over: Partial<GoalProgressView> = {}): GoalProgressView => ({ ...state.goals[0], points: 9350, target_points: 15000, percent: 62, contributors: 5, my_points: 350, open: true, ...over });

// The cleaner cream menus (specs/polish/flat-ui.md round 2, step 7).
describe("a club goal", () => {
  it("shows one bar with its points and percent, who chipped in, and Contribute while it's open", () => {
    const out = html(h(ClubGoal, { goal: goal(), onContribute: () => {} }));
    expect(out.match(/role="progressbar"/g)).toHaveLength(1);
    expect(out).toContain("9,350</b> of 15,000 pts");
    expect(out).toContain("<b>62%</b>");
    expect(out).toContain("5 members chipped in");
    expect(out).toContain(">Contribute<");
  });
  it("is a pinned paper notice on the board, and plain on the journal's page", () => {
    expect(html(h(ClubGoal, { goal: goal(), look: "notice" }))).toMatch(/data-pinned="true"/);
    expect(html(h(ClubGoal, { goal: goal() }))).not.toContain("data-pinned");
  });
  it("has no Contribute once it's complete", () => {
    expect(html(h(ClubGoal, { goal: goal({ completed: true, open: false, percent: 100 }), onContribute: () => {} }))).not.toContain(">Contribute<");
  });
  it("is one line while it waits on another goal", () => {
    const next = goal({ open: false, locked_by: DEFAULT_GOALS[0].slug });
    expect(isUpNext(next)).toBe(true);
    expect(isUpNext(goal())).toBe(false);
    expect(html(h(UpNextGoal, { goal: next, waitingOnTitle: "Reopen the cafe" }))).toContain("opens when Reopen the cafe is complete.");
  });
  it("says what kind of goal it is", () => {
    expect(goalKind({ goal_type: "story", cycle: 1 })).toBe("Club goal");
    expect(goalKind({ goal_type: "seasonal", cycle: 2 })).toBe("Seasonal goal · 2");
  });
});

describe("the journal's quests", () => {
  it("opens the chapter under way, with its steps and its one action; locked chapters don't open", () => {
    const out = html(h(JournalBody));
    expect(out.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(out).toContain('data-state="locked"');
    const current = state.chapters.find((c) => c.status === "active" || c.status === "ready")!;
    expect(out).toContain(current.steps[0].label);
  });
});

describe("a letter's sender line", () => {
  const letter = (over: Partial<LetterView>): LetterView => ({ id: "1", kind: "note", sender_id: "a", sender_name: "Wren", recipient_id: "b", recipient_name: "Bo", subject: "", body: "", created_at: "2026-10-18T00:00:00Z", read_at: null, reported: false, outgoing: false, ...over });
  it("is who wrote it, HQ for HQ's, and who you wrote to for yours", () => {
    expect(fromLine(letter({}))).toBe("Wren");
    expect(fromLine(letter({ kind: "system", sender_name: "Someone" }))).toBe("HQ");
    expect(fromLine(letter({ outgoing: true }))).toBe("To Bo");
  });
});
