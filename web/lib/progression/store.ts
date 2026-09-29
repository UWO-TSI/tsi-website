/**
 * Storage boundary for progression. The service (service.ts) holds the
 * rules; this interface is what it needs from the database. The Supabase
 * implementation lives in supabaseStore.ts; tests use an in-memory fake that
 * mimics progression_commit_contribution() semantics.
 */
import type { ClubGoal, ContributionSource, DeliveryKind, LetterView, MemberChapterProgress, QuestChapter } from "./types";
import type { MemberTotals } from "./goals";
import { DomainError } from "@/lib/result";

export type StoreErrorCode = "unavailable" | "cap_exceeded" | "insufficient" | "not_found" | "failed";

export class StoreError extends DomainError<StoreErrorCode> {}

export interface MemberFacts {
  tier: number;
  oracleDone: boolean;
  trialDone: boolean;
  firstCatchKey: string | null;
  hudMuted: boolean;
}

export interface CommitInput {
  goalId: string;
  cycle: number;
  memberId: string;
  source: ContributionSource;
  kind: DeliveryKind | null;
  itemKey: string | null;
  amount: number;
  amountUsed: number;
  weight: number;
  credited: number;
  capped: boolean;
  memberCap: number | null;
  deliveryCap: number | null;
  idempotencyKey: string;
  refId: string | null;
  note: string | null;
  createdBy: string | null;
}

export interface CommitResult {
  id: string;
  replayed: boolean;
  credited_points: number;
}

export interface RealActivity {
  source: "event" | "bounty";
  ref_id: string;
  member_id: string;
}

export interface ProgressionStore {
  listGoals(): Promise<ClubGoal[]>;
  listChapters(): Promise<QuestChapter[]>;
  memberProgress(memberId: string): Promise<MemberChapterProgress[]>;
  saveMemberProgress(
    memberId: string,
    chapterId: string,
    next: { status: "active" | "completed" | "skipped"; steps_done: Record<string, string>; donated_item_key: string | null },
    completedAt: string | null,
  ): Promise<void>;
  memberFacts(memberId: string): Promise<MemberFacts>;
  setHudMuted(memberId: string, muted: boolean): Promise<void>;

  goalProgress(goalId: string, cycle: number): Promise<{ points: number; contributors: number }>;
  memberTotals(goalId: string, cycle: number, memberId: string): Promise<MemberTotals>;
  completion(goalId: string, cycle: number): Promise<string | null>;
  findContribution(memberId: string, idempotencyKey: string): Promise<(CommitResult & { goal_id: string }) | null>;
  commitContribution(input: CommitInput): Promise<CommitResult>;
  /** Insert the completion row; true only for the call that created it. */
  markGoalComplete(goalId: string, cycle: number, total: number): Promise<boolean>;
  realActivity(since: Date | null, until: Date | null): Promise<RealActivity[]>;
  creditedRefs(goalId: string, cycle: number): Promise<Set<string>>;

  broadcastSystemLetter(broadcastKey: string, subject: string, body: string): Promise<void>;
  sendSystemLetter(memberId: string, broadcastKey: string, subject: string, body: string): Promise<void>;
  countNotesSince(senderId: string, since: Date, recipientId?: string): Promise<number>;
  memberExists(memberId: string): Promise<boolean>;
  insertNote(senderId: string, recipientId: string, subject: string, body: string): Promise<{ id: string; created_at: string }>;
  listLetters(memberId: string, limit: number): Promise<LetterView[]>;
  /** Recipient-only updates. Returns false if the letter isn't theirs. */
  markLetterRead(memberId: string, letterId: string, at: string): Promise<boolean>;
  reportLetter(memberId: string, letterId: string, reason: string, at: string): Promise<boolean>;
  /** Single wallet path (033 wallet_apply); idempotent per key. */
  creditCoins(memberId: string, amount: number, source: "chapter" | "quest", ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}
