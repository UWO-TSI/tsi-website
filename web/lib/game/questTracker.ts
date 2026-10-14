/**
 * The quest tracker's model (components/game/QuestTracker.tsx): one compact line left of the minimap, the name of the
 * task being worked on (David, 2026-10-14). Generic: the walk-along's steps today (lib/game/arrival/tutorial.ts
 * tutorialQuest), quests and chapters later; whatever feeds it hands over a TrackedQuest. Pure: which step is current.
 */
export type QuestKind = "tutorial" | "quest" | "chapter";
export interface QuestStep {
  /** Stable within the quest: the tick animation follows it. */
  id: string;
  label: string;
  done: boolean;
}
export interface TrackedQuest {
  /** Its own id (a new quest replaces the list, the same one updates it). */
  id: string;
  title: string;
  kind: QuestKind;
  steps: readonly QuestStep[];
  /** The step being worked on; absent: the first not done. */
  current?: string | null;
  /** A short line about the current step ("Press E to talk"), or none. Carried, not drawn: the HUD line is the name only. */
  hint?: string | null;
}

/**
 * The step being worked on (the explicit `current`, else the first not done), or null once every step is ticked
 * (`complete`): the one task the HUD's line names.
 */
export function currentStep(quest: TrackedQuest): { step: QuestStep | null; complete: boolean } {
  const steps = quest.steps;
  const complete = steps.length > 0 && steps.every(s => s.done);
  const step = (quest.current ? steps.find(s => s.id === quest.current) : undefined) ?? steps.find(s => !s.done) ?? null;
  return { step, complete };
}

/** How far along (done / all), for the tracker's tooltip and its screen-reader name. */
export const questProgress = (q: TrackedQuest) => ({ done: q.steps.filter(s => s.done).length, of: q.steps.length });

/** A chapter as the progression service hands it over (lib/progression/types.ts ChapterView, the fields used here). */
export interface ChapterLike {
  slug: string;
  title: string;
  status: string;
  steps: readonly { key: string; label: string; done: boolean; hint?: string }[];
}
/**
 * The chapter being worked on (active or ready) as a tracked quest for the HUD (the tracker's line left of the
 * minimap): its steps, the first not done current, that step's hint. Null with no chapter on, or while the member has
 * the HUD's quests muted (`shown` false: the objective is empty then).
 */
export function chapterQuest(chapters: readonly ChapterLike[], shown: boolean): TrackedQuest | null {
  if (!shown) return null;
  const chapter = chapters.find(c => c.status === "active" || c.status === "ready");
  if (!chapter || !chapter.steps.length) return null;
  const next = chapter.steps.find(s => !s.done);
  return { id: `chapter:${chapter.slug}`, title: chapter.title, kind: "chapter", steps: chapter.steps.map(s => ({ id: s.key, label: s.label, done: s.done })), hint: next?.hint ?? null };
}
