/**
 * In-memory ProgressionStore for tests. commitContribution mirrors
 * progression_commit_contribution() in 20260926150200_progression.sql: idempotent on
 * (member, key) and (goal, cycle, source, ref), re-checks caps, debits coins
 * or collection items, never below zero.
 */
import { DEFAULT_CHAPTERS, DEFAULT_GOALS } from "./defaults";
import { StoreError, type CommitInput, type MemberFacts, type ProgressionStore, type RealActivity } from "./store";
import type { ClubGoal, LetterView, MemberChapterProgress, QuestChapter } from "./types";

export interface MemoryContribution extends CommitInput {
  id: string;
}

export interface MemoryLetter {
  id: string;
  kind: "system" | "note";
  sender_id: string | null;
  recipient_id: string;
  subject: string;
  body: string;
  broadcast_key: string | null;
  created_at: string;
  read_at: string | null;
  reported: boolean;
}

export function memoryStore(seed?: { goals?: ClubGoal[]; chapters?: QuestChapter[] }) {
  const goals: ClubGoal[] = structuredClone(seed?.goals ?? DEFAULT_GOALS);
  const chapters: QuestChapter[] = structuredClone(seed?.chapters ?? DEFAULT_CHAPTERS);
  const progress = new Map<string, MemberChapterProgress>();
  const facts = new Map<string, MemberFacts>();
  const coins = new Map<string, number>();
  const items = new Map<string, number>(); // `${member}:${item}`
  const contributions: MemoryContribution[] = [];
  const totals = new Map<string, { credited_points: number; delivery_points: number }>();
  const completions = new Map<string, { at: string; total: number }>();
  const letters: MemoryLetter[] = [];
  const activity: RealActivity[] = [];
  const members = new Set<string>();
  const credits = new Set<string>();
  let seq = 0;
  let clock = Date.parse("2026-09-24T12:00:00Z");
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const tkey = (g: string, c: number, m: string) => `${g}:${c}:${m}`;

  const store: ProgressionStore = {
    async listGoals() {
      return goals.filter((g) => g.active).sort((a, b) => a.position - b.position);
    },
    async listChapters() {
      return chapters.filter((c) => c.active);
    },
    async memberProgress(memberId) {
      return [...progress.entries()].filter(([k]) => k.startsWith(`${memberId}:`)).map(([, v]) => structuredClone(v));
    },
    async saveMemberProgress(memberId, chapterId, next, completedAt) {
      progress.set(`${memberId}:${chapterId}`, { chapter_id: chapterId, ...structuredClone(next), completed_at: completedAt });
    },
    async memberFacts(memberId) {
      return facts.get(memberId) ?? { tier: 4, oracleDone: false, trialDone: false, firstCatchKey: null, hudMuted: false };
    },
    async setHudMuted(memberId, muted) {
      const f = await store.memberFacts(memberId);
      facts.set(memberId, { ...f, hudMuted: muted });
    },
    async goalProgress(goalId, cycle) {
      let points = 0;
      let contributors = 0;
      for (const [k, v] of totals) if (k.startsWith(`${goalId}:${cycle}:`)) {
        points += v.credited_points;
        contributors++;
      }
      return { points, contributors };
    },
    async memberTotals(goalId, cycle, memberId) {
      return { ...(totals.get(tkey(goalId, cycle, memberId)) ?? { credited_points: 0, delivery_points: 0 }) };
    },
    async completion(goalId, cycle) {
      return completions.get(`${goalId}:${cycle}`)?.at ?? null;
    },
    async findContribution(memberId, key) {
      const c = contributions.find((x) => x.memberId === memberId && x.idempotencyKey === key);
      return c ? { id: c.id, goal_id: c.goalId, credited_points: c.credited, replayed: true } : null;
    },
    async commitContribution(i) {
      const dup =
        contributions.find((x) => x.memberId === i.memberId && x.idempotencyKey === i.idempotencyKey) ??
        (i.refId ? contributions.find((x) => x.goalId === i.goalId && x.cycle === i.cycle && x.source === i.source && x.refId === i.refId) : undefined);
      if (dup) return { id: dup.id, replayed: true, credited_points: dup.credited };
      const t = totals.get(tkey(i.goalId, i.cycle, i.memberId)) ?? { credited_points: 0, delivery_points: 0 };
      if (i.memberCap !== null && t.credited_points + i.credited > i.memberCap) throw new StoreError("cap_exceeded");
      if (i.deliveryCap !== null && t.delivery_points + i.credited > i.deliveryCap) throw new StoreError("cap_exceeded");
      if (i.source === "delivery" && i.amountUsed > 0) {
        if (i.kind === "coins") {
          const have = coins.get(i.memberId) ?? 0;
          if (have < i.amountUsed) throw new StoreError("insufficient");
          coins.set(i.memberId, have - i.amountUsed);
        } else {
          const k = `${i.memberId}:${i.itemKey}`;
          const have = items.get(k) ?? 0;
          if (have < i.amountUsed) throw new StoreError("insufficient");
          items.set(k, have - i.amountUsed);
        }
      }
      const id = nextId();
      contributions.push({ ...i, id });
      totals.set(tkey(i.goalId, i.cycle, i.memberId), {
        credited_points: t.credited_points + i.credited,
        delivery_points: t.delivery_points + (i.source === "delivery" ? i.credited : 0),
      });
      return { id, replayed: false, credited_points: i.credited };
    },
    async markGoalComplete(goalId, cycle, total) {
      const k = `${goalId}:${cycle}`;
      if (completions.has(k)) return false;
      completions.set(k, { at: new Date(clock).toISOString(), total });
      return true;
    },
    async realActivity() {
      return [...activity];
    },
    async creditedRefs(goalId, cycle) {
      return new Set(contributions.filter((c) => c.goalId === goalId && c.cycle === cycle && c.refId).map((c) => `${c.source}:${c.refId}`));
    },
    async broadcastSystemLetter(key, subject, body) {
      for (const m of members) await store.sendSystemLetter(m, key, subject, body);
    },
    async sendSystemLetter(memberId, key, subject, body) {
      if (letters.some((l) => l.broadcast_key === key && l.recipient_id === memberId)) return;
      letters.push({ id: nextId(), kind: "system", sender_id: null, recipient_id: memberId, subject, body, broadcast_key: key, created_at: new Date(clock).toISOString(), read_at: null, reported: false });
    },
    async countNotesSince(senderId, since, recipientId) {
      return letters.filter((l) => l.kind === "note" && l.sender_id === senderId && Date.parse(l.created_at) >= since.getTime() && (!recipientId || l.recipient_id === recipientId)).length;
    },
    async memberExists(memberId) {
      return members.has(memberId);
    },
    async insertNote(senderId, recipientId, subject, body) {
      const l: MemoryLetter = { id: nextId(), kind: "note", sender_id: senderId, recipient_id: recipientId, subject, body, broadcast_key: null, created_at: new Date(clock).toISOString(), read_at: null, reported: false };
      letters.push(l);
      return { id: l.id, created_at: l.created_at };
    },
    async listLetters(memberId, limit) {
      return letters
        .filter((l) => l.recipient_id === memberId || l.sender_id === memberId)
        .slice(-limit)
        .reverse()
        .map((l): LetterView => ({ ...l, sender_name: l.sender_id ?? "Village Hall", recipient_name: l.recipient_id, outgoing: l.sender_id === memberId && l.recipient_id !== memberId }));
    },
    async markLetterRead(memberId, id, at) {
      const l = letters.find((x) => x.id === id && x.recipient_id === memberId);
      if (!l) return false;
      l.read_at = l.read_at ?? at;
      return true;
    },
    async creditCoins(memberId, amount, _source, _ref, key) {
      const k = `${memberId}:${key}`;
      if (credits.has(k)) return { balance: coins.get(memberId) ?? 0, replayed: true };
      credits.add(k);
      coins.set(memberId, (coins.get(memberId) ?? 0) + amount);
      return { balance: coins.get(memberId)!, replayed: false };
    },
    async reportLetter(memberId, id) {
      const l = letters.find((x) => x.id === id && x.recipient_id === memberId && x.kind === "note");
      if (!l) return false;
      l.reported = true;
      return true;
    },
  };

  return {
    store,
    goals,
    chapters,
    contributions,
    letters,
    activity,
    addMember(id: string, f: Partial<MemberFacts> = {}, wallet = 0) {
      members.add(id);
      facts.set(id, { tier: 4, oracleDone: false, trialDone: false, firstCatchKey: null, hudMuted: false, ...f });
      coins.set(id, wallet);
    },
    setFacts(id: string, f: Partial<MemberFacts>) {
      facts.set(id, { ...(facts.get(id) ?? { tier: 4, oracleDone: false, trialDone: false, firstCatchKey: null, hudMuted: false }), ...f });
    },
    giveItem(member: string, item: string, n: number) {
      items.set(`${member}:${item}`, (items.get(`${member}:${item}`) ?? 0) + n);
    },
    coinsOf: (m: string) => coins.get(m) ?? 0,
    itemsOf: (m: string, item: string) => items.get(`${m}:${item}`) ?? 0,
    advanceClock(ms: number) {
      clock += ms;
    },
  };
}
