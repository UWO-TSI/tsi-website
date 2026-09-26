import type { Family } from "@/lib/oracle/engine";
import type { AccountSettings } from "./settings";
import { DomainError } from "@/lib/result";

export type IdentityErrorCode = "unavailable" | "name_taken" | "too_soon" | "forbidden" | "cooldown" | "insufficient" | "not_found" | "incomplete" | "failed";
export class IdentityError extends DomainError<IdentityErrorCode> {}

export interface IdentityRow {
  world_name: string | null;
  world_name_key: string | null;
  name_set_at: string | null;
  name_changes: number;
  mbti_type: string | null;
  family: Family | null;
  quiz_taken_at: string | null;
  muted_until: string | null;
}
export interface ProfileFacts {
  tier: number;
  membership: "member" | "public";
  is_active: boolean;
}
export interface Attempt {
  id: string;
  member_id: string;
  item_order: string[];
  status: "open" | "completed";
  fee_paid: number;
  mbti_type: string | null;
  family: Family | null;
  started_at: string;
  completed_at: string | null;
}

export interface IdentityStore {
  identity(memberId: string): Promise<IdentityRow>;
  profile(memberId: string): Promise<ProfileFacts>;
  keyOwner(key: string): Promise<string | null>;
  /** identity_set_name: uniqueness + change limit enforced atomically. */
  setName(memberId: string, name: string, key: string, actorId: string, cooldownDays: number): Promise<{ world_name: string; name_changes: number; replayed: boolean }>;
  openAttempt(memberId: string): Promise<Attempt | null>;
  getAttempt(attemptId: string): Promise<Attempt | null>;
  /** oracle_start: resume, or create (charging the respec fee via wallet_apply). */
  startAttempt(memberId: string, startKey: string, order: string[], fee: number, cooldownDays: number): Promise<{ attempt_id: string; fee_paid: number; resumed: boolean }>;
  saveAnswers(attemptId: string, answers: Record<string, number>): Promise<void>;
  answers(attemptId: string): Promise<Record<string, number>>;
  /** oracle_complete: store result, family, aura, respec log. */
  complete(attemptId: string, memberId: string, type: string, family: Family, scores: unknown, ties: Record<string, string>): Promise<{ family: Family; previous_family: Family | null; aura_new: boolean; replayed: boolean }>;
  auras(memberId: string): Promise<Family[]>;
  settings(memberId: string): Promise<AccountSettings>;
  saveSettings(memberId: string, s: AccountSettings): Promise<void>;
  report(reporterId: string, targetId: string, reason: string): Promise<void>;
  resolveReports(targetId: string, status: "actioned" | "dismissed"): Promise<void>;
  setMute(targetId: string, until: string | null): Promise<void>;
}
