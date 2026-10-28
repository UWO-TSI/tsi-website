/**
 * Main quest chapter rules (rows 101, 120, 177-179; specs/launch/v1-gameplay.md m1 to m6). Conditions are code;
 * copy, order, regions, rewards and the goal a chapter points at are admin content. The server evaluates these from
 * its own reads; clients only request an action and are told whether it was allowed.
 *
 * A personal chapter is a short errand with a person and a place: get the tool from them, use it, come back and show
 * them (their talk finishes the chapter). Steps are counted from server facts (`count`), stored by an action
 * (`action`), or the chapter's finish (`finish`).
 */
import { islandPhase } from "@/lib/game/islandTime";
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

/** Server-read tallies a step can count (never client-supplied). */
export type FactCount = "fish" | "fish_kinds" | "bugs" | "digs" | "stone" | "iron" | "donations" | "net" | "shovel" | "pickaxe" | "oracle" | "trial";

interface StepRule {
  key: string;
  anchor: ObjectiveAnchor;
  /** The resident this step sends you to (a roster slug): they stand at `anchor` while it's yours (x-teachers). */
  npc?: string;
  /** Done once the member's tally reaches the number. */
  count?: [FactCount, number];
  /** Done once an advance action stored it. */
  action?: true;
  /** The chapter's last step: done when the chapter is. */
  finish?: true;
}

/** The museum's guide (m1): she takes your first catch. */
const MUSEUM_GUIDE = "docent";

export const STEP_RULES: Record<ChapterRequirement, readonly StepRule[]> = {
  // The village's chapter 1 (row 101), as it has always played: claim, catch, donate at the museum, report to Alice.
  settle_in: [
    { key: "claim_plot", anchor: "hq", action: true },
    { key: "first_catch", anchor: "fishing_spot", count: ["fish", 1] },
    { key: "donate_catch", anchor: "museum", action: true },
    { key: "report_hq", anchor: "hq", finish: true },
  ],
  // m1, the new world's chapter 1: first catch, donated to the museum's guide, who pays and writes (no report to Alice).
  first_find: [
    { key: "claim_plot", anchor: "hq", action: true },
    { key: "first_catch", anchor: "fishing_spot", count: ["fish", 1] },
    { key: "donate_catch", anchor: "museum", npc: MUSEUM_GUIDE, finish: true },
  ],
  // m2: Odile's net.
  bug_net: [
    { key: "get_net", anchor: "museum", npc: "curator", count: ["net", 1] },
    { key: "catch_bugs", anchor: "bugs", count: ["bugs", 3] },
    { key: "show_odile", anchor: "museum", npc: "curator", finish: true },
  ],
  // m3: Pim's shovel.
  dig: [
    { key: "get_shovel", anchor: "beach", npc: "crafter", count: ["shovel", 1] },
    { key: "dig_up", anchor: "dig_spots", count: ["digs", 3] },
    { key: "show_pim", anchor: "beach", npc: "crafter", finish: true },
  ],
  // m4: Bram's rod challenge (the Cedar rod is the chapter's reward_item).
  rod_challenge: [
    { key: "fish_kinds", anchor: "fishing_spot", count: ["fish_kinds", 5] },
    { key: "twilight_catch", anchor: "fishing_spot", action: true },
    { key: "show_bram", anchor: "wharf", npc: "wharf-keeper", finish: true },
  ],
  // m5: the museum as a club collaboration (your part; the club's tally is museumCollab()).
  museum_collab: [
    { key: "donate_new", anchor: "museum", npc: "curator", count: ["donations", 3] },
    { key: "tell_odile", anchor: "museum", npc: "curator", finish: true },
  ],
  // m6: the pickaxe. Rocks give stone and sometimes iron.
  pickaxe: [
    { key: "get_pickaxe", anchor: "plaza", npc: "mayor", count: ["pickaxe", 1] },
    { key: "mine_stone", anchor: "rocks", count: ["stone", 3] },
    { key: "mine_iron", anchor: "rocks", count: ["iron", 1] },
    { key: "show_eliza", anchor: "plaza", npc: "mayor", finish: true },
  ],
  club_goal: [
    { key: "contribute", anchor: "monument" },
    { key: "goal_complete", anchor: "monument" },
  ],
  oracle_trial: [
    { key: "oracle_quiz", anchor: "oracle", count: ["oracle", 1] },
    { key: "family_trial", anchor: "oracle", count: ["trial", 1] },
    { key: "enter_gate", anchor: "ruins_gate", finish: true },
  ],
};
export const REQUIREMENTS = Object.keys(STEP_RULES) as ChapterRequirement[];
export const STEP_KEYS = Object.fromEntries(REQUIREMENTS.map((r) => [r, STEP_RULES[r].map((s) => s.key)])) as unknown as Record<ChapterRequirement, readonly string[]>;

const FALLBACK_COPY: Record<string, StepCopy> = {
  claim_plot: { label: "Claim your plot at HQ" },
  first_catch: { label: "Make your first catch" },
  donate_catch: { label: "Donate your catch" },
  report_hq: { label: "Report back to Alice at HQ" },
  get_net: { label: "Ask Odile at the museum for a net" },
  catch_bugs: { label: "Catch 3 bugs" },
  show_odile: { label: "Show Odile your bugs" },
  get_shovel: { label: "Ask Pim on the beach for a shovel" },
  dig_up: { label: "Dig up 3 buried things" },
  show_pim: { label: "Show Pim your finds" },
  fish_kinds: { label: "Catch 5 different fish" },
  twilight_catch: { label: "Catch a fish at dawn or dusk" },
  show_bram: { label: "Show Bram at the wharf" },
  donate_new: { label: "Donate 3 new finds to the museum" },
  tell_odile: { label: "Tell Odile at the museum" },
  get_pickaxe: { label: "Ask Mayor Eliza at the plaza for a pickaxe" },
  mine_stone: { label: "Break rocks for 3 stone" },
  mine_iron: { label: "Find a lump of iron" },
  show_eliza: { label: "Bring your stone to Mayor Eliza" },
  contribute: { label: "Contribute to the club goal" },
  goal_complete: { label: "Club goal reaches its target" },
  oracle_quiz: { label: "Complete the Oracle quiz" },
  family_trial: { label: "Reach level 10 and choose your subclass" },
  enter_gate: { label: "Open the ruins gate" },
};

export const ADVANCE_ACTIONS = ["claim_plot", "donate_catch", "report_hq", "twilight_catch", "complete", "skip"] as const;
export type AdvanceAction = (typeof ADVANCE_ACTIONS)[number];

/** A catch counts for the dawn-or-dusk step when it was landed this recently and the island is at dawn or dusk now. */
export const TWILIGHT_CATCH_MS = 3 * 60_000;

/** Facts the server reads before evaluating (never client-supplied). */
export interface ChapterFacts {
  tier: number;
  /** Item key of a fish the member has caught (member_collections), if any. */
  firstCatchKey: string | null;
  /** When the member last landed a fish (its member_collections row's updated_at). */
  lastFishAt: string | null;
  counts: Partial<Record<FactCount, number>>;
  goals: Record<string, { completed: boolean; myPoints: number }>;
}

const isPersonal = (r: ChapterRequirement) => r !== "club_goal" && r !== "oracle_trial";

function stepDone(rule: StepRule, chapter: QuestChapter, progress: MemberChapterProgress | undefined, facts: ChapterFacts): boolean {
  if (progress?.status === "completed") return true;
  if (rule.finish) return false;
  if (rule.action) return !!progress?.steps_done?.[rule.key];
  // The first catch also counts once a catch was donated (row 101: a fish sold since still shows the step done).
  if (rule.key === "first_catch" && (facts.firstCatchKey !== null || !!progress?.steps_done?.first_catch || !!progress?.steps_done?.donate_catch)) return true;
  if (rule.count) return (facts.counts[rule.count[0]] ?? 0) >= rule.count[1];
  if (rule.key === "contribute") return (chapter.goal_slug ? (facts.goals[chapter.goal_slug]?.myPoints ?? 0) : 0) > 0;
  if (rule.key === "goal_complete") return !!(chapter.goal_slug && facts.goals[chapter.goal_slug]?.completed);
  return false;
}

/** Every step before the finish is done (a step this drop hides counts as done). Club goals: only the goal itself. */
function readyToFinish(chapter: QuestChapter, steps: ChapterStepView[]): boolean {
  const need = (k: string) => steps.find((s) => s.key === k)?.done ?? !!chapter.hidden_steps?.includes(k);
  // Personal contribution is encouraged, not required: the goal is club-wide.
  if (chapter.requirement === "club_goal") return need("goal_complete");
  return STEP_RULES[chapter.requirement].filter((r) => !r.finish).every((r) => need(r.key));
}

export function evaluateChapters(
  chapters: QuestChapter[],
  progressRows: MemberChapterProgress[],
  facts: ChapterFacts,
): ChapterView[] {
  const byChapter = new Map(progressRows.map((p) => [p.chapter_id, p]));
  // Personal chapters come before the club's (the new world's errands sit after the club rows' positions, 2 to 4).
  const ordered = chapters.filter((c) => c.active).sort((a, b) => Number(isPersonal(b.requirement)) - Number(isPersonal(a.requirement)) || a.position - b.position);
  let previousDone = true;
  return ordered.map((chapter) => {
    const progress = byChapter.get(chapter.id);
    const steps: ChapterStepView[] = STEP_RULES[chapter.requirement].filter((r) => !chapter.hidden_steps?.includes(r.key)).map((rule) => {
      const copy = chapter.step_copy[rule.key] ?? FALLBACK_COPY[rule.key];
      const done = stepDone(rule, chapter, progress, facts);
      const view: ChapterStepView = { key: rule.key, label: copy.label, hint: copy.hint, done, anchor: rule.anchor };
      if (rule.npc) view.npc = rule.npc;
      // A tally of more than one shows how far along it is ("Catch 3 bugs 1/3").
      if (rule.count && rule.count[1] > 1) view.count = { have: done ? rule.count[1] : Math.min(rule.count[1], facts.counts[rule.count[0]] ?? 0), need: rule.count[1] };
      return view;
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

/** What the chapter still waits on, said plainly. */
const waitingOn = (view: ChapterView) => {
  const open = view.steps.find((s) => !s.done);
  return open ? `${open.label} first.` : "Not yet.";
};

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
  const settle = chapter.requirement === "settle_in", first = chapter.requirement === "first_find";
  const done = (next: Record<string, string>, item = donated): AdvanceResult => ({ ok: true, next: { status: "completed", steps_done: next, donated_item_key: item }, completedChapter: true });

  switch (action) {
    case "skip":
      if (!view.can_skip) return { ok: false, status: 403, error: "This chapter can't be skipped." };
      return { ok: true, next: { status: "skipped", steps_done: steps, donated_item_key: donated }, completedChapter: true };
    case "claim_plot":
      if (!settle && !first) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (chapter.hidden_steps?.includes("claim_plot")) return { ok: false, status: 422, error: "That isn't open yet." };
      if (steps.claim_plot) return { ok: false, status: 409, error: "Plot already claimed." };
      steps.claim_plot = at;
      return { ok: true, next: { status: "active", steps_done: steps, donated_item_key: donated }, completedChapter: false };
    case "donate_catch":
      if (!settle && !first) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (settle) {
        // The village: the donation is a step; reporting to Alice at HQ finishes the chapter.
        if (steps.donate_catch) return { ok: false, status: 409, error: "Already donated." };
        if (!facts.firstCatchKey) return { ok: false, status: 409, error: "Catch a fish first." };
        steps.first_catch = steps.first_catch ?? at;
        steps.donate_catch = at;
        return { ok: true, next: { status: "active", steps_done: steps, donated_item_key: facts.firstCatchKey }, completedChapter: false };
      }
      // m1: handing the museum's guide your first catch finishes the chapter (her reward and letter come with it).
      if (!facts.firstCatchKey) return { ok: false, status: 409, error: "Catch a fish first." };
      if (view.status !== "ready") return { ok: false, status: 409, error: waitingOn(view) };
      steps.first_catch = steps.first_catch ?? at;
      steps.donate_catch = at;
      return done(steps, facts.firstCatchKey);
    case "report_hq":
      if (!settle) return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (view.status !== "ready") return { ok: false, status: 409, error: chapter.hidden_steps?.includes("claim_plot") ? "Donate a catch first." : "Claim your plot and donate a catch first." };
      steps.report_hq = at;
      return done(steps);
    case "twilight_catch": {
      if (chapter.requirement !== "rod_challenge") return { ok: false, status: 422, error: "Not a step of this chapter." };
      if (steps.twilight_catch) return { ok: false, status: 409, error: "Already done." };
      const phase = islandPhase(now);
      const fresh = facts.lastFishAt !== null && now.getTime() - Date.parse(facts.lastFishAt) <= TWILIGHT_CATCH_MS;
      if (!fresh || (phase !== "dawn" && phase !== "evening")) return { ok: false, status: 409, error: "Catch one at dawn or dusk." };
      steps.twilight_catch = at;
      return { ok: true, next: { status: "active", steps_done: steps, donated_item_key: donated }, completedChapter: false };
    }
    case "complete":
      if (settle) return { ok: false, status: 422, error: "Report to HQ to finish this chapter." };
      if (first) return { ok: false, status: 422, error: "Donate your catch at the museum to finish this chapter." };
      if (view.status !== "ready") {
        if (chapter.requirement === "club_goal") return { ok: false, status: 409, error: "The club goal isn't complete yet." };
        if (chapter.requirement === "oracle_trial") return { ok: false, status: 409, error: "The Oracle quiz, level 10 and your subclass come first." };
        return { ok: false, status: 409, error: waitingOn(view) };
      }
      steps[chapter.requirement === "club_goal" ? "goal_complete" : STEP_RULES[chapter.requirement].find((r) => r.finish)!.key] = at;
      return done(steps);
  }
}

/** The step being worked on: the first open step of the first open chapter. */
export function currentObjective(views: ChapterView[], muted: boolean): Objective | null {
  if (muted) return null;
  const chapter = views.find((v) => v.status === "active" || v.status === "ready");
  if (!chapter) return null;
  const step = chapter.steps.find((s) => !s.done);
  if (!step) return null;
  return { chapter_slug: chapter.slug, step_key: step.key, text: step.label, anchor: step.anchor };
}

/**
 * The member's own main quest (the quest dropdown, t-next): the first open personal chapter, never a club goal.
 */
export const personalChapter = (views: readonly ChapterView[]) =>
  views.find((v) => (v.status === "active" || v.status === "ready") && isPersonal(v.requirement)) ?? null;

/**
 * The step a resident's talk finishes (the finish step whose person they are), when the member's personal chapter
 * is ready for it: the action to send and the chapter. Null: nothing for them.
 */
export function finishWith(views: readonly ChapterView[], npc: string): { chapter: string; action: AdvanceAction } | null {
  const c = personalChapter(views);
  if (!c || c.status !== "ready") return null;
  const rule = STEP_RULES[c.requirement].find((r) => r.finish);
  if (!rule || rule.npc !== npc) return null;
  return { chapter: c.slug, action: c.requirement === "first_find" ? "donate_catch" : "complete" };
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
  const requirement: ChapterRequirement = REQUIREMENTS.includes(row.requirement as ChapterRequirement) ? (row.requirement as ChapterRequirement) : "settle_in";
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
    reward_item: typeof row.reward_item === "string" && row.reward_item ? row.reward_item : null,
    world: row.world === "village" || row.world === "new" ? row.world : null,
    active: row.active !== false,
  };
}

export function validateChapterDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const req = d.requirement as ChapterRequirement;
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.position !== "number" || !Number.isInteger(d.position) || d.position < 1 || d.position > 50) errors.push("position: 1-50");
  if (typeof d.title !== "string" || !d.title.trim() || d.title.length > 80) errors.push("title: 1-80 characters");
  if (!REQUIREMENTS.includes(req)) errors.push(`requirement: one of ${REQUIREMENTS.join(", ")}`);
  if (req === "club_goal" && (typeof d.goal_slug !== "string" || !d.goal_slug)) errors.push("club_goal chapters need a goal");
  if (typeof d.skippable_max_tier !== "number" || d.skippable_max_tier < 0 || d.skippable_max_tier > 5) errors.push("skippable_max_tier: 0-5");
  if (req === "club_goal" && d.skippable_max_tier !== 0) errors.push("club_goal chapters can't be skippable");
  if (d.reward_coins !== undefined && (typeof d.reward_coins !== "number" || !Number.isInteger(d.reward_coins) || d.reward_coins < 0 || d.reward_coins > 5000)) errors.push("reward_coins: 0-5000");
  if (d.world !== undefined && d.world !== null && d.world !== "village" && d.world !== "new") errors.push("world: village, new or both (empty)");
  if (d.reward_item !== undefined && d.reward_item !== null && (typeof d.reward_item !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.reward_item))) errors.push("reward_item: a shop item slug");
  if (!Array.isArray(d.unlocks_regions)) errors.push("unlocks_regions: list");
  const copy = d.step_copy as Record<string, unknown> | undefined;
  if (!copy || typeof copy !== "object") errors.push("step_copy: object");
  else if (REQUIREMENTS.includes(req)) {
    for (const key of Object.keys(copy)) {
      if (!STEP_KEYS[req].includes(key)) errors.push(`step_copy.${key}: not a step of ${req}`);
    }
  }
  return errors;
}
