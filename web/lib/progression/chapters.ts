/**
 * Main quest chapter rules (rows 101, 120, 177-179). Conditions are code;
 * copy, order, regions and the goal a chapter points at are admin content.
 * The server evaluates these from its own reads; clients only request an
 * action and are told whether it was allowed.
 */
import type {
  ChapterRequirement,
  ChapterStepView,
  ChapterView,
  MemberChapterProgress,
  Objective,
  ObjectiveAnchor,
  QuestChapter,
  StepCopy,
} from "./types";

export const STEP_KEYS: Record<ChapterRequirement, readonly string[]> = {
  settle_in: ["claim_plot", "first_catch", "donate_catch", "report_hq"],
  club_goal: ["contribute", "goal_complete"],
  oracle_trial: ["oracle_quiz", "family_trial", "enter_gate"],
};

const STEP_ANCHOR: Record<string, ObjectiveAnchor> = {
  claim_plot: "hq",
  first_catch: "fishing_spot",
  donate_catch: "museum",
  report_hq: "hq",
  contribute: "monument",
  goal_complete: "monument",
  oracle_quiz: "oracle",
  family_trial: "oracle",
  enter_gate: "ruins_gate",
};

const FALLBACK_COPY: Record<string, StepCopy> = {
  claim_plot: { label: "Claim your plot at HQ" },
  first_catch: { label: "Make your first catch" },
  donate_catch: { label: "Donate your catch" },
  report_hq: { label: "Report back to HQ" },
  contribute: { label: "Contribute to the club goal" },
  goal_complete: { label: "Club goal reaches its target" },
  oracle_quiz: { label: "Complete the Oracle quiz" },
  family_trial: { label: "Finish the family trial" },
  enter_gate: { label: "Open the ruins gate" },
};

export const ADVANCE_ACTIONS = ["claim_plot", "donate_catch", "report_hq", "complete", "skip"] as const;
export type AdvanceAction = (typeof ADVANCE_ACTIONS)[number];

/** Facts the server reads before evaluating (never client-supplied). */
export interface ChapterFacts {
  tier: number;
  oracleDone: boolean;
  trialDone: boolean;
  /** Item key of a fish the member has caught (member_collections), if any. */
  firstCatchKey: string | null;
  goals: Record<string, { completed: boolean; myPoints: number }>;
}

function stepDone(key: string, chapter: QuestChapter, progress: MemberChapterProgress | undefined, facts: ChapterFacts): boolean {
  const done = progress?.steps_done ?? {};
  const finished = progress?.status === "completed";
  switch (key) {
    case "claim_plot":
    case "donate_catch":
      return finished || !!done[key];
    case "first_catch":
      return finished || !!done.first_catch || !!done.donate_catch || facts.firstCatchKey !== null;
    case "report_hq":
    case "enter_gate":
      return finished;
    case "contribute":
      return (chapter.goal_slug ? (facts.goals[chapter.goal_slug]?.myPoints ?? 0) : 0) > 0;
    case "goal_complete":
      return !!(chapter.goal_slug && facts.goals[chapter.goal_slug]?.completed);
    case "oracle_quiz":
      return finished || facts.oracleDone;
    case "family_trial":
      return finished || facts.trialDone;
    default:
      return false;
  }
}

/** Steps that must be done before the chapter's final action is allowed. */
function readyToFinish(chapter: QuestChapter, steps: ChapterStepView[]): boolean {
  const need = (k: string) => steps.find((s) => s.key === k)?.done ?? false;
  switch (chapter.requirement) {
    case "settle_in":
      return need("claim_plot") && need("first_catch") && need("donate_catch");
    case "club_goal":
      // Personal contribution is encouraged, not required: the goal is club-wide.
      return need("goal_complete");
    case "oracle_trial":
      return need("oracle_quiz") && need("family_trial");
  }
}

export function evaluateChapters(
  chapters: QuestChapter[],
  progressRows: MemberChapterProgress[],
  facts: ChapterFacts,
): ChapterView[] {
  const byChapter = new Map(progressRows.map((p) => [p.chapter_id, p]));
  const ordered = chapters.filter((c) => c.active).sort((a, b) => a.position - b.position);
  let previousDone = true;
  return ordered.map((chapter) => {
    const progress = byChapter.get(chapter.id);
    const steps: ChapterStepView[] = STEP_KEYS[chapter.requirement].map((key) => {
      const copy = chapter.step_copy[key] ?? FALLBACK_COPY[key];
      return { key, label: copy.label, hint: copy.hint, done: stepDone(key, chapter, progress, facts), anchor: STEP_ANCHOR[key] ?? "hq" };
    });
    let status: ChapterView["status"];
    if (progress?.status === "completed") status = "completed";
    else if (progress?.status === "skipped") status = "skipped";
    else if (!previousDone) status = "locked";
    else status = readyToFinish(chapter, steps) ? "ready" : "active";
    previousDone = status === "completed" || status === "skipped";
    // Club-goal chapters are never skippable: the club goal is shared (coordinator ruling 2026-09-24).
    const canSkip = (status === "active" || status === "ready") && chapter.requirement !== "club_goal" && chapter.skippable_max_tier > 0 && facts.tier <= chapter.skippable_max_tier;
    return {
      slug: chapter.slug,
      position: chapter.position,
      title: chapter.title,
      summary: chapter.summary,
      requirement: chapter.requirement,
      goal_slug: chapter.goal_slug,
      status,
      steps,
      unlocks_regions: chapter.unlocks_regions,
      can_skip: canSkip,
      completed_at: progress?.completed_at ?? null,
    };
  });
}

export type AdvanceResult =
  | {
      ok: true;
      /** New stored state for (member, chapter). */
      next: { status: "active" | "completed" | "skipped"; steps_done: Record<string, string>; donated_item_key: string | null };
      completedChapter: boolean;
    }
  | { ok: false; status: 403 | 409 | 422; error: string };

/**
 * Server-side gate for one requested action on one chapter. `view` must come
 * from evaluateChapters() over server-read facts.
 */
export function validateAdvance(
  action: AdvanceAction,
  chapter: QuestChapter,
  view: ChapterView,
  progress: MemberChapterProgress | undefined,
  facts: ChapterFacts,
  now: Date,
): AdvanceResult {
  if (view.status === "locked") return { ok: false, status: 409, error: "Finish the previous chapter first." };
  if (view.status === "completed" || view.status === "skipped") return { ok: false, status: 409, error: "Chapter already finished." };
  const at = now.toISOString();
  const steps = { ...(progress?.steps_done ?? {}) };
  const donated = progress?.donated_item_key ?? null;
  const settle = chapter.requirement === "settle_in";

  switch (action) {
    case "skip":
      if (!view.can_skip) return { ok: false, status: 403, error: "This chapter can't be skipped." };
      return { ok: true, next: { status: "skipped", steps_done: steps, donated_item_key: donated }, completedChapter: true };
    case "claim_plot":
      if (!settle) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (steps.claim_plot) return { ok: false, status: 409, error: "Plot already claimed." };
      steps.claim_plot = at;
      return { ok: true, next: { status: "active", steps_done: steps, donated_item_key: donated }, completedChapter: false };
    case "donate_catch":
      if (!settle) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (steps.donate_catch) return { ok: false, status: 409, error: "Already donated." };
      if (!facts.firstCatchKey) return { ok: false, status: 409, error: "Catch a fish first." };
      steps.first_catch = steps.first_catch ?? at;
      steps.donate_catch = at;
      return { ok: true, next: { status: "active", steps_done: steps, donated_item_key: facts.firstCatchKey }, completedChapter: false };
    case "report_hq":
      if (!settle) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (view.status !== "ready") return { ok: false, status: 409, error: "Claim your plot and donate a catch first." };
      steps.report_hq = at;
      return { ok: true, next: { status: "completed", steps_done: steps, donated_item_key: donated }, completedChapter: true };
    case "complete":
      if (settle) return { ok: false, status: 422, error: "Report to HQ to finish this chapter." };
      if (view.status !== "ready") {
        return { ok: false, status: 409, error: chapter.requirement === "club_goal" ? "The club goal isn't complete yet." : "Oracle quiz and family trial come first." };
      }
      steps[chapter.requirement === "club_goal" ? "goal_complete" : "enter_gate"] = at;
      return { ok: true, next: { status: "completed", steps_done: steps, donated_item_key: donated }, completedChapter: true };
  }
}

/** One quiet HUD line (row 180): first open step of the first open chapter. */
export function currentObjective(views: ChapterView[], muted: boolean): Objective | null {
  if (muted) return null;
  const chapter = views.find((v) => v.status === "active" || v.status === "ready");
  if (!chapter) return null;
  const step = chapter.steps.find((s) => !s.done);
  if (!step) return null;
  return { chapter_slug: chapter.slug, step_key: step.key, text: step.label, anchor: step.anchor };
}

/**
 * Regions open to this member: personal chapters open theirs on completion
 * or skip; club-goal chapters open theirs for everyone when the goal is done
 * (rows 177/178), whatever this member's own chapter state is.
 */
export function unlockedRegions(views: ChapterView[], completedGoalSlugs: Set<string>): string[] {
  const out = new Set<string>();
  for (const v of views) {
    const personalDone = v.status === "completed" || v.status === "skipped";
    const goalDone = v.requirement === "club_goal" && !!v.goal_slug && completedGoalSlugs.has(v.goal_slug);
    if (personalDone || goalDone) for (const r of v.unlocks_regions) out.add(r);
  }
  return [...out];
}

export function normalizeChapter(row: Record<string, unknown>): QuestChapter {
  const req = row.requirement;
  const requirement: ChapterRequirement = req === "club_goal" || req === "oracle_trial" ? req : "settle_in";
  const rawCopy = row.step_copy && typeof row.step_copy === "object" ? (row.step_copy as Record<string, unknown>) : {};
  const step_copy: Record<string, StepCopy> = {};
  for (const key of STEP_KEYS[requirement]) {
    const c = rawCopy[key] as Record<string, unknown> | undefined;
    if (c && typeof c.label === "string" && c.label.trim()) {
      step_copy[key] = { label: c.label, hint: typeof c.hint === "string" && c.hint.trim() ? c.hint : undefined };
    }
  }
  return {
    id: String(row.id),
    slug: String(row.slug),
    position: Number(row.position) || 0,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    requirement,
    goal_slug: typeof row.goal_slug === "string" ? row.goal_slug : null,
    step_copy,
    unlocks_regions: Array.isArray(row.unlocks_regions) ? row.unlocks_regions.map(String) : [],
    completion_letter: String(row.completion_letter ?? ""),
    skippable_max_tier: Number.isInteger(row.skippable_max_tier) ? (row.skippable_max_tier as number) : 0,
    reward_coins: Number.isInteger(row.reward_coins) ? Math.max(0, row.reward_coins as number) : 0,
    active: row.active !== false,
  };
}

export function validateChapterDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.position !== "number" || !Number.isInteger(d.position) || d.position < 1 || d.position > 50) errors.push("position: 1-50");
  if (typeof d.title !== "string" || !d.title.trim() || d.title.length > 80) errors.push("title: 1-80 characters");
  if (d.requirement !== "settle_in" && d.requirement !== "club_goal" && d.requirement !== "oracle_trial") errors.push("requirement: settle_in, club_goal or oracle_trial");
  if (d.requirement === "club_goal" && (typeof d.goal_slug !== "string" || !d.goal_slug)) errors.push("club_goal chapters need a goal");
  if (typeof d.skippable_max_tier !== "number" || d.skippable_max_tier < 0 || d.skippable_max_tier > 5) errors.push("skippable_max_tier: 0-5");
  if (d.requirement === "club_goal" && d.skippable_max_tier !== 0) errors.push("club_goal chapters can't be skippable");
  if (d.reward_coins !== undefined && (typeof d.reward_coins !== "number" || !Number.isInteger(d.reward_coins) || d.reward_coins < 0 || d.reward_coins > 5000)) errors.push("reward_coins: 0-5000");
  if (!Array.isArray(d.unlocks_regions)) errors.push("unlocks_regions: list");
  const copy = d.step_copy as Record<string, unknown> | undefined;
  if (!copy || typeof copy !== "object") errors.push("step_copy: object");
  else if (typeof d.requirement === "string" && d.requirement in STEP_KEYS) {
    for (const key of Object.keys(copy)) {
      if (!STEP_KEYS[d.requirement as ChapterRequirement].includes(key)) errors.push(`step_copy.${key}: not a step of ${d.requirement}`);
    }
  }
  return errors;
}
