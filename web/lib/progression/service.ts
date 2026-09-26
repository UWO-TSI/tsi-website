/**
 * Progression service: every rule the /api/progression/* routes enforce.
 * Callers pass the authenticated member id; nothing here trusts client
 * numbers beyond the offer (kind, units) of a delivery.
 */
import {
  currentObjective,
  evaluateChapters,
  unlockedRegions,
  validateAdvance,
  type AdvanceAction,
  type ChapterFacts,
} from "./chapters";
import { goalCycle, goalPercent, monumentStage, planContribution, type PlanRejection } from "./goals";
import { noteRateLimit, RATE_WINDOW_MS, validateNote } from "./letters";
import { itemDeliveryKind } from "./items";
import { StoreError, type MemberFacts, type ProgressionStore } from "./store";
import type { ClubGoal, DeliveryKind, GoalProgressView, ProgressionState } from "./types";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string };

const fail = (status: number, error: string, code?: string) => ({ ok: false as const, status, error, code });

export function storeFailure(err: unknown): { ok: false; status: number; error: string; code?: string } {
  if (err instanceof StoreError) {
    if (err.code === "unavailable") return fail(503, "Progression isn't available yet.", "unavailable");
    if (err.code === "cap_exceeded") return fail(409, "You've given the most this goal accepts from one member. Thank you!", "cap_reached");
    if (err.code === "insufficient") return fail(409, "You don't have enough to deliver that.", "insufficient");
    if (err.code === "not_found") return fail(404, "Not found.", "not_found");
  }
  return fail(500, "Something went wrong. Try again.", "failed");
}

const PLAN_ERRORS: Record<PlanRejection, [number, string]> = {
  invalid_amount: [400, "Invalid amount."],
  kind_not_accepted: [422, "This goal doesn't take that kind of delivery."],
  not_weighted: [422, "That doesn't count toward this goal."],
  cap_reached: [409, "You've given the most this goal accepts from one member. Thank you!"],
};

// ─── Goals ───────────────────────────────────────────────────────────────────

/**
 * Story goals are a sequence (cafe, then museum): a story goal takes
 * contributions only once every earlier story goal is complete. Seasonal
 * goals run on their own windows.
 */
export async function storyLocks(store: ProgressionStore, goals: ClubGoal[], now: Date): Promise<Map<string, string>> {
  const locks = new Map<string, string>();
  let waitingOn: string | null = null;
  for (const g of goals.filter((x) => x.goal_type === "story").sort((a, b) => a.position - b.position)) {
    if (waitingOn) {
      locks.set(g.slug, waitingOn);
      continue;
    }
    if (!(await store.completion(g.id, goalCycle(g, now).cycle))) waitingOn = g.slug;
  }
  return locks;
}

export async function goalViews(store: ProgressionStore, goals: ClubGoal[], memberId: string | null, now: Date): Promise<GoalProgressView[]> {
  const locks = await storyLocks(store, goals, now);
  return Promise.all(goals.map((g) => goalView(store, g, memberId, now, locks.get(g.slug) ?? null)));
}

export async function goalView(store: ProgressionStore, goal: ClubGoal, memberId: string | null, now: Date, lockedBy: string | null = null): Promise<GoalProgressView> {
  const c = goalCycle(goal, now);
  const [progress, completedAt, mine] = await Promise.all([
    store.goalProgress(goal.id, c.cycle),
    store.completion(goal.id, c.cycle),
    memberId ? store.memberTotals(goal.id, c.cycle, memberId) : Promise.resolve({ credited_points: 0, delivery_points: 0 }),
  ]);
  const completed = completedAt !== null;
  const percent = completed ? 100 : goalPercent(progress.points, goal.target_points);
  return {
    slug: goal.slug,
    title: goal.title,
    summary: goal.summary,
    goal_type: goal.goal_type,
    cycle: c.cycle,
    open: c.open && !completed && !lockedBy,
    locked_by: lockedBy,
    target_points: goal.target_points,
    points: progress.points,
    percent,
    stage: monumentStage(percent),
    completed,
    completed_at: completedAt,
    contributors: progress.contributors,
    accepts: goal.accepts,
    weights: goal.weights,
    caps: goal.caps,
    unlocks: goal.unlocks,
    monument_key: goal.monument_key,
    my_points: mine.credited_points,
    my_delivery_points: mine.delivery_points,
  };
}

async function maybeComplete(store: ProgressionStore, goal: ClubGoal, cycle: number): Promise<boolean> {
  const { points } = await store.goalProgress(goal.id, cycle);
  if (points < goal.target_points) return false;
  const fresh = await store.markGoalComplete(goal.id, cycle, points);
  if (fresh && (goal.completion_letter_subject || goal.completion_letter_body)) {
    // Row 183: a letter to every member. broadcast key dedupes retries.
    await store.broadcastSystemLetter(`goal:${goal.slug}:${cycle}`, goal.completion_letter_subject || goal.title, goal.completion_letter_body || goal.title);
  }
  return fresh;
}

export interface DeliveryOffer {
  goal_slug: string;
  kind: DeliveryKind;
  amount: number;
  item_key: string | null;
  idempotency_key: string;
}

export async function contribute(
  store: ProgressionStore,
  memberId: string,
  offer: DeliveryOffer,
  now: Date,
): Promise<ServiceResult<{ replayed: boolean; credited_points: number; amount_used: number; capped: boolean; goal: GoalProgressView; completed_now: boolean }>> {
  try {
    const goals = await store.listGoals();
    const goal = goals.find((g) => g.slug === offer.goal_slug);
    if (!goal) return fail(404, "That goal isn't active.", "not_found");

    // Replays return the original credit before any cap math runs.
    const prior = await store.findContribution(memberId, offer.idempotency_key);
    if (prior) {
      if (prior.goal_id !== goal.id) return fail(409, "Idempotency key reused for another goal.", "key_reused");
      return { ok: true, data: { replayed: true, credited_points: prior.credited_points, amount_used: 0, capped: false, goal: await goalView(store, goal, memberId, now), completed_now: false } };
    }

    const c = goalCycle(goal, now);
    if (!c.open) return fail(409, "This goal isn't taking deliveries right now.", "closed");
    if ((await storyLocks(store, goals, now)).has(goal.slug)) return fail(409, "This goal opens after the one before it is complete.", "locked");
    if (await store.completion(goal.id, c.cycle)) return fail(409, "This goal is already complete.", "completed");
    if (offer.kind !== "coins" && (!offer.item_key || itemDeliveryKind(offer.item_key) !== offer.kind)) {
      return fail(400, "Pick an item of that kind to deliver.", "invalid");
    }

    const totals = await store.memberTotals(goal.id, c.cycle, memberId);
    const plan = planContribution({ goal, source: "delivery", kind: offer.kind, amount: offer.amount, totals });
    if (!plan.ok) {
      const [status, error] = PLAN_ERRORS[plan.reason];
      return fail(status, error, plan.reason);
    }
    const res = await store.commitContribution({
      goalId: goal.id,
      cycle: c.cycle,
      memberId,
      source: "delivery",
      kind: offer.kind,
      itemKey: offer.kind === "coins" ? null : offer.item_key,
      amount: offer.amount,
      amountUsed: plan.amountUsed,
      weight: plan.weight,
      credited: plan.creditedPoints,
      capped: plan.capped,
      memberCap: plan.memberCap,
      deliveryCap: plan.deliveryCap,
      idempotencyKey: offer.idempotency_key,
      refId: null,
      note: null,
      createdBy: null,
    });
    const completedNow = res.replayed ? false : await maybeComplete(store, goal, c.cycle);
    return {
      ok: true,
      data: { replayed: res.replayed, credited_points: res.credited_points, amount_used: res.replayed ? 0 : plan.amountUsed, capped: !res.replayed && plan.capped, goal: await goalView(store, goal, memberId, now), completed_now: completedNow },
    };
  } catch (err) {
    return storeFailure(err);
  }
}

export async function adminCredit(
  store: ProgressionStore,
  adminId: string,
  input: { goal_slug: string; member_id: string; points: number; note: string | null; idempotency_key: string },
  now: Date,
): Promise<ServiceResult<{ replayed: boolean; credited_points: number; goal: GoalProgressView }>> {
  try {
    const goal = (await store.listGoals()).find((g) => g.slug === input.goal_slug);
    if (!goal) return fail(404, "That goal isn't active.", "not_found");
    if (!(await store.memberExists(input.member_id))) return fail(404, "Member not found.", "not_found");
    const c = goalCycle(goal, now);
    const totals = await store.memberTotals(goal.id, c.cycle, input.member_id);
    const plan = planContribution({ goal, source: "admin", kind: null, amount: input.points, totals });
    if (!plan.ok) {
      const [status, error] = PLAN_ERRORS[plan.reason];
      return fail(status, error, plan.reason);
    }
    const res = await store.commitContribution({
      goalId: goal.id, cycle: c.cycle, memberId: input.member_id, source: "admin", kind: null, itemKey: null,
      amount: input.points, amountUsed: input.points, weight: plan.weight, credited: plan.creditedPoints, capped: plan.capped,
      memberCap: plan.memberCap, deliveryCap: null, idempotencyKey: input.idempotency_key, refId: null, note: input.note, createdBy: adminId,
    });
    if (!res.replayed) await maybeComplete(store, goal, c.cycle);
    return { ok: true, data: { replayed: res.replayed, credited_points: res.credited_points, goal: await goalView(store, goal, null, now) } };
  } catch (err) {
    return storeFailure(err);
  }
}

/**
 * Credit real club activity (QR check-ins, completed bounties) that happened
 * inside a goal's window. Reads the existing event_attendance/bounty_claims
 * records; deterministic keys make re-runs no-ops.
 */
export async function syncRealActivity(store: ProgressionStore, goal: ClubGoal, now: Date): Promise<{ credited: number; skipped: number }> {
  const c = goalCycle(goal, now);
  if (!c.open || (await store.completion(goal.id, c.cycle))) return { credited: 0, skipped: 0 };
  if ((await storyLocks(store, await store.listGoals(), now)).has(goal.slug)) return { credited: 0, skipped: 0 };
  const since = c.start ?? (goal.created_at ? new Date(goal.created_at) : null);
  const [activity, done] = await Promise.all([store.realActivity(since, c.end), store.creditedRefs(goal.id, c.cycle)]);
  const totalsCache = new Map<string, { credited_points: number; delivery_points: number }>();
  let credited = 0;
  let skipped = 0;
  for (const a of activity) {
    if (done.has(`${a.source}:${a.ref_id}`)) continue;
    let totals = totalsCache.get(a.member_id);
    if (!totals) {
      totals = await store.memberTotals(goal.id, c.cycle, a.member_id);
      totalsCache.set(a.member_id, totals);
    }
    const plan = planContribution({ goal, source: a.source, kind: null, amount: 1, totals });
    if (!plan.ok) {
      skipped++;
      continue;
    }
    try {
      const res = await store.commitContribution({
        goalId: goal.id, cycle: c.cycle, memberId: a.member_id, source: a.source, kind: null, itemKey: null,
        amount: 1, amountUsed: 1, weight: plan.weight, credited: plan.creditedPoints, capped: plan.capped,
        memberCap: plan.memberCap, deliveryCap: null, idempotencyKey: `${a.source}:${a.ref_id}:${goal.id}:${c.cycle}`,
        refId: a.ref_id, note: null, createdBy: null,
      });
      if (!res.replayed) {
        credited++;
        totals.credited_points += res.credited_points;
      }
    } catch (err) {
      if (err instanceof StoreError && err.code === "cap_exceeded") {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  if (credited > 0) await maybeComplete(store, goal, c.cycle);
  return { credited, skipped };
}

// ─── Chapters ────────────────────────────────────────────────────────────────

async function chapterContext(store: ProgressionStore, memberId: string, now: Date) {
  const [chapters, goals, progress, facts] = await Promise.all([
    store.listChapters(),
    store.listGoals(),
    store.memberProgress(memberId),
    store.memberFacts(memberId),
  ]);
  const views = await goalViews(store, goals, memberId, now);
  const chapterFacts: ChapterFacts = {
    tier: facts.tier,
    oracleDone: facts.oracleDone,
    trialDone: facts.trialDone,
    firstCatchKey: facts.firstCatchKey,
    goals: Object.fromEntries(views.map((g) => [g.slug, { completed: g.completed, myPoints: g.my_points }])),
  };
  return { chapters, goals, goalViews: views, progress, facts, chapterFacts };
}

function buildState(ctx: Awaited<ReturnType<typeof chapterContext>>, facts: MemberFacts, unread: number): ProgressionState {
  const views = evaluateChapters(ctx.chapters, ctx.progress, ctx.chapterFacts);
  const completedGoals = new Set(ctx.goalViews.filter((g) => g.completed).map((g) => g.slug));
  return {
    chapters: views,
    goals: ctx.goalViews,
    objective: currentObjective(views, facts.hudMuted),
    hud_muted: facts.hudMuted,
    unlocked_regions: unlockedRegions(views, completedGoals),
    unread_letters: unread,
    source: "live",
  };
}

export async function loadState(store: ProgressionStore, memberId: string, now: Date): Promise<ServiceResult<ProgressionState>> {
  try {
    const ctx = await chapterContext(store, memberId, now);
    const letters = await store.listLetters(memberId, 50);
    const unread = letters.filter((l) => !l.outgoing && !l.read_at).length;
    return { ok: true, data: buildState(ctx, ctx.facts, unread) };
  } catch (err) {
    return storeFailure(err);
  }
}

export async function advanceChapter(
  store: ProgressionStore,
  memberId: string,
  input: { chapter_slug: string; action: AdvanceAction },
  now: Date,
): Promise<ServiceResult<ProgressionState>> {
  try {
    const ctx = await chapterContext(store, memberId, now);
    const chapter = ctx.chapters.find((c) => c.slug === input.chapter_slug && c.active);
    if (!chapter) return fail(404, "Chapter not found.", "not_found");
    const views = evaluateChapters(ctx.chapters, ctx.progress, ctx.chapterFacts);
    const view = views.find((v) => v.slug === chapter.slug)!;
    const progress = ctx.progress.find((p) => p.chapter_id === chapter.id);
    const result = validateAdvance(input.action, chapter, view, progress, ctx.chapterFacts, now);
    if (!result.ok) return fail(result.status, result.error, "rejected");
    const completedAt = result.completedChapter ? now.toISOString() : null;
    await store.saveMemberProgress(memberId, chapter.id, result.next, completedAt);
    if (result.next.status === "completed" && chapter.completion_letter) {
      await store.sendSystemLetter(memberId, `chapter:${chapter.slug}`, chapter.title, chapter.completion_letter);
    }
    // Chapter reward (row 200): once per member and chapter, not for a skip.
    if (result.next.status === "completed" && chapter.reward_coins > 0) {
      await store.creditCoins(memberId, chapter.reward_coins, "chapter", chapter.slug, `chapter:${chapter.slug}`);
    }
    return loadState(store, memberId, now);
  } catch (err) {
    return storeFailure(err);
  }
}

// ─── Letters ─────────────────────────────────────────────────────────────────

export async function sendNote(
  store: ProgressionStore,
  senderId: string,
  input: { to: string; subject?: unknown; body?: unknown },
  now: Date,
): Promise<ServiceResult<{ id: string; created_at: string }>> {
  const check = validateNote(input);
  if (!check.ok) return fail(400, check.error, "invalid");
  if (input.to === senderId) return fail(400, "You can't send a note to yourself.", "invalid");
  try {
    if (!(await store.memberExists(input.to))) return fail(404, "Member not found.", "not_found");
    const since = new Date(now.getTime() - RATE_WINDOW_MS);
    const [today, toThem] = await Promise.all([store.countNotesSince(senderId, since), store.countNotesSince(senderId, since, input.to)]);
    const limit = noteRateLimit(today, toThem);
    if (!limit.ok) return fail(429, limit.error, "rate_limited");
    return { ok: true, data: await store.insertNote(senderId, input.to, check.subject, check.body) };
  } catch (err) {
    return storeFailure(err);
  }
}
