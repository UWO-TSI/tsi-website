/**
 * The quest tracker's model (components/game/QuestTracker.tsx): a small to-do list top right of the HUD. Generic: the
 * walk-along's steps today (lib/game/arrival/tutorial.ts tutorialQuest), quests and chapters later; whatever feeds it
 * hands over a TrackedQuest. Pure: which rows show (a window round the step being worked on) and how many are hidden.
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
  /** A short line under the current step ("Press E to talk"), or none. */
  hint?: string | null;
}

export interface TrackerRow extends QuestStep { current: boolean }
/**
 * The rows to show: up to `size` of them round the current step (one step before it for context, then what's next),
 * with how many steps are folded away above (done, as a rule) and how many more wait below.
 */
export function trackerRows(quest: TrackedQuest, size = 5): { rows: TrackerRow[]; above: number; below: number; complete: boolean } {
  const steps = quest.steps;
  const complete = steps.length > 0 && steps.every(s => s.done);
  let at = quest.current ? steps.findIndex(s => s.id === quest.current) : -1;
  if (at < 0) at = steps.findIndex(s => !s.done);
  if (at < 0) at = steps.length; // everything done: show the last few, ticked
  const n = Math.max(1, size);
  const from = Math.max(0, Math.min(at - 1, steps.length - n)), to = Math.min(steps.length, from + n);
  const rows = steps.slice(from, to).map((s, i) => ({ ...s, current: from + i === at }));
  return { rows, above: from, below: steps.length - to, complete };
}

/** How far along (done / all), for the tracker's small count. */
export const questProgress = (q: TrackedQuest) => ({ done: q.steps.filter(s => s.done).length, of: q.steps.length });
