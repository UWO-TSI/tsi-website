import { describe, expect, it } from "vitest";
import { evaluateChapters, type ChapterFacts } from "@/lib/progression/chapters";
import { DEFAULT_CHAPTERS } from "@/lib/progression/defaults";
import type { MemberChapterProgress } from "@/lib/progression/types";
import { mainQuest, museumLine, questPosts, questTalk, scriptAction } from "./mainQuest";
import { currentStep } from "./questTracker";

const facts = (counts: ChapterFacts["counts"] = {}, firstCatchKey: string | null = null): ChapterFacts => ({ tier: 4, firstCatchKey, lastFishAt: null, counts, goals: {} });
const finished = (upTo: number): MemberChapterProgress[] => DEFAULT_CHAPTERS.filter(c => c.position < upTo).map(c => ({ chapter_id: c.id, status: "completed", steps_done: {}, donated_item_key: null, completed_at: "2026-10-27T00:00:00Z" }));
const museum = { fish: 4, bugs: 2, finds: 0 };

describe("the main quest on the island", () => {
  it("is the personal chapter's steps with their tallies, the next one current", () => {
    const q = mainQuest(evaluateChapters(DEFAULT_CHAPTERS, finished(2), facts({ net: 1, bugs: 1 })), true)!;
    expect(q).toMatchObject({ id: "chapter:odiles-net", title: "Odile's net", kind: "chapter" });
    expect(q.steps.map(s => [s.label, s.done])).toEqual([["Ask Odile at the museum for a net", true], ["Catch 3 bugs 1/3", false], ["Show Odile your bugs at the museum", false]]);
    expect(currentStep(q).step?.id).toBe("catch_bugs");
  });
  it("is nothing while the quests are muted, or once only club goals are left", () => {
    expect(mainQuest(evaluateChapters(DEFAULT_CHAPTERS, [], facts()), false)).toBeNull();
    expect(mainQuest(evaluateChapters(DEFAULT_CHAPTERS, finished(7), facts()), true)).toBeNull();
  });
  it("keeps the chapter's people at its places for the whole chapter (x-teachers)", () => {
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, [], facts()))).toEqual({ docent: "museum" });
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, finished(2), facts({ net: 1 })))).toEqual({ curator: "museum" });
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, finished(3), facts()))).toEqual({ crafter: "beach" });
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, finished(4), facts()))).toEqual({ "wharf-keeper": "wharf" });
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, finished(6), facts()))).toEqual({ mayor: "plaza" });
    expect(questPosts(evaluateChapters(DEFAULT_CHAPTERS, finished(7), facts()))).toEqual({});
  });
  it("has the person finish the chapter when it's ready, and nudge while it runs", () => {
    const fresh = evaluateChapters(DEFAULT_CHAPTERS, [], facts());
    expect(questTalk(fresh, "docent", museum)?.script).toBe("quest:settle-in:nudge");
    const plot: MemberChapterProgress[] = [{ chapter_id: DEFAULT_CHAPTERS[0].id, status: "active", steps_done: { claim_plot: "2026-10-27T00:00:00Z" }, donated_item_key: null, completed_at: null }];
    const caught = evaluateChapters(DEFAULT_CHAPTERS, plot, facts({ fish: 1 }, "fish_dace"));
    const t = questTalk(caught, "docent", museum)!;
    expect(t.script).toBe("quest:settle-in:donate_catch");
    expect(scriptAction(t.script)).toEqual({ chapter: "settle-in", action: "donate_catch" });
    expect(scriptAction("quest:settle-in:nudge")).toBeNull();
    expect(questTalk(caught, "curator", museum)).toBeNull();
    // Asking for the net is Odile's teacher talk, not the quest's; once you have it she nudges.
    expect(questTalk(evaluateChapters(DEFAULT_CHAPTERS, finished(2), facts()), "curator", museum)).toBeNull();
    expect(questTalk(evaluateChapters(DEFAULT_CHAPTERS, finished(2), facts({ net: 1, bugs: 2 })), "curator", museum)?.lines[0]).toMatch(/^2 of 3 so far/);
  });
  it("words the club's museum", () => {
    expect(museumLine(museum)).toBe("The club's museum so far: 4 of 10 fish, 2 of 5 bugs, 0 of 3 buried finds. It opens once it's full.");
    expect(museumLine({ fish: 12, bugs: 5, finds: 3 })).toMatch(/10 of 10 fish.*opens with the next launch/);
  });
});
