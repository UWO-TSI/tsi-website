/**
 * Oracle service: start/resume a reading, save answers in batches, finish
 * (scoring, tie-breakers, family, aura), respec quote. Clients send only
 * answers; the server scores.
 */
import { IdentityError, type IdentityStore } from "@/lib/identity/store";
import { FAMILY_COLOR, itemOrder, keeperBeat, missing, score, tieBreakersFor, tiedDichotomies, validAnswer, type Family, type OracleResult } from "./engine";
import { STATEMENTS, TIE_BREAKERS, type Pole } from "./items";
import { RESPEC_COOLDOWN_DAYS, RESPEC_FEE_COINS, startDecision } from "./retake";

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string; [k: string]: unknown };
const ERR: Record<string, [number, string]> = {
  unavailable: [503, "The Oracle is resting. Try again later."],
  cooldown: [409, "The Oracle needs time before another reading."],
  insufficient: [409, "A new reading costs coins you don't have yet."],
  not_found: [404, "That reading isn't yours."],
  incomplete: [409, "Answer every question first."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => {
  const code = err instanceof IdentityError ? err.code : "failed";
  const [status, error] = ERR[code] ?? ERR.failed;
  return { ok: false, status, error, code };
};

const TEXT = new Map(STATEMENTS.map((s) => [s.id, s.text]));

export interface AttemptView {
  attempt_id: string;
  items: { id: string; text: string }[];
  answered: Record<string, number>;
  total: number;
  fee_paid: number;
  resumed: boolean;
}

export async function startReading(store: IdentityStore, m: string, startKey: string, now: Date): Promise<Result<AttemptView>> {
  try {
    const [open, id] = await Promise.all([store.openAttempt(m), store.identity(m)]);
    const d = startDecision({ openAttemptId: open?.id ?? null, lastResultAt: id.quiz_taken_at, now });
    if (d.kind === "cooldown") return { ok: false, status: 409, code: "cooldown", error: ERR.cooldown[1], until: d.until };
    const fee = d.kind === "respec" ? d.fee : 0;
    const s = await store.startAttempt(m, startKey, itemOrder(`${m}:${startKey}`), fee, RESPEC_COOLDOWN_DAYS);
    const a = (await store.getAttempt(s.attempt_id))!;
    return { ok: true, data: { attempt_id: a.id, items: a.item_order.map((i) => ({ id: i, text: TEXT.get(i) ?? "" })), answered: await store.answers(a.id), total: a.item_order.length, fee_paid: a.fee_paid, resumed: s.resumed } };
  } catch (err) {
    return fail(err);
  }
}

async function ownOpen(store: IdentityStore, m: string, attemptId: string) {
  const a = await store.getAttempt(attemptId);
  if (!a || a.member_id !== m) throw new IdentityError("not_found");
  return a;
}

export async function answerBatch(store: IdentityStore, m: string, attemptId: string, batch: { item_id: string; value: number }[]): Promise<Result<{ answered: number; total: number; keeper_beat: number | null }>> {
  try {
    const a = await ownOpen(store, m, attemptId);
    if (a.status !== "open") return { ok: false, status: 409, code: "completed", error: "This reading is finished." };
    const ids = new Set(a.item_order);
    const clean: Record<string, number> = {};
    for (const b of batch) {
      if (!ids.has(b.item_id) || !validAnswer(b.item_id, b.value)) return { ok: false, status: 400, code: "bad_answer", error: `Invalid answer for ${b.item_id}.` };
      clean[b.item_id] = b.value;
    }
    await store.saveAnswers(attemptId, clean);
    const answered = Object.keys(await store.answers(attemptId)).length;
    return { ok: true, data: { answered, total: a.item_order.length, keeper_beat: keeperBeat(answered, a.item_order.length) } };
  } catch (err) {
    return fail(err);
  }
}

export interface ResultView {
  type: string;
  family: Family;
  color: string;
  dichotomies: OracleResult["dichotomies"];
  low_clarity: boolean;
  previous_family: Family | null;
  aura_new: boolean;
}
export type FinishOutcome = { status: "needs_tie_breakers"; tie_breakers: typeof TIE_BREAKERS } | ({ status: "done" } & ResultView);

export async function finishReading(store: IdentityStore, m: string, attemptId: string, ties: Record<string, string> | undefined): Promise<Result<FinishOutcome>> {
  try {
    const a = await ownOpen(store, m, attemptId);
    const answers = await store.answers(attemptId);
    if (a.status === "completed") {
      const r = score(answers, (ties ?? {}) as Record<string, Pole>);
      const c = await store.complete(attemptId, m, a.mbti_type ?? r.type, a.family ?? r.family, r.dichotomies, ties ?? {});
      return { ok: true, data: { status: "done", ...r, type: a.mbti_type ?? r.type, family: c.family, color: FAMILY_COLOR[c.family], previous_family: c.previous_family, aura_new: false } };
    }
    const gap = missing(answers);
    if (gap.length) return { ok: false, status: 409, code: "incomplete", error: `${gap.length} questions left.`, missing: gap };
    const tied = tiedDichotomies(answers);
    const validTies = Object.fromEntries(Object.entries(ties ?? {}).filter(([id, pole]) => TIE_BREAKERS.some((t) => t.id === id && t.options.some((o) => o.pole === pole))));
    if (tied.length && ties === undefined) return { ok: true, data: { status: "needs_tie_breakers", tie_breakers: tieBreakersFor(tied) } };
    const r = score(answers, validTies as Record<string, Pole>);
    const c = await store.complete(attemptId, m, r.type, r.family, r.dichotomies, validTies);
    return { ok: true, data: { status: "done", ...r, color: FAMILY_COLOR[r.family], previous_family: c.previous_family, aura_new: c.aura_new } };
  } catch (err) {
    return fail(err);
  }
}

export interface OracleStatus {
  type: string | null;
  family: Family | null;
  color: string | null;
  auras: Family[];
  taken_at: string | null;
  open_attempt: { attempt_id: string; answered: number; total: number } | null;
  next_reading: { kind: "free" | "respec" | "cooldown" | "resume"; fee: number; available_at: string | null };
}

export async function oracleStatus(store: IdentityStore, m: string, now: Date): Promise<Result<OracleStatus>> {
  try {
    const [id, open, auras] = await Promise.all([store.identity(m), store.openAttempt(m), store.auras(m)]);
    const d = startDecision({ openAttemptId: open?.id ?? null, lastResultAt: id.quiz_taken_at, now });
    return {
      ok: true,
      data: {
        type: id.mbti_type, family: id.family, color: id.family ? FAMILY_COLOR[id.family] : null, auras, taken_at: id.quiz_taken_at,
        open_attempt: open ? { attempt_id: open.id, answered: Object.keys(await store.answers(open.id)).length, total: open.item_order.length } : null,
        next_reading: {
          kind: d.kind, fee: d.kind === "respec" ? d.fee : d.kind === "cooldown" ? RESPEC_FEE_COINS : 0,
          available_at: d.kind === "cooldown" ? d.until : null,
        },
      },
    };
  } catch (err) {
    return fail(err);
  }
}
