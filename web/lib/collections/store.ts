import type { Donation, MemberItem, WeeklyBest } from "./logic";
import type { Species } from "./roster";
import { DomainError } from "@/lib/result";

export type CollectionsErrorCode = "unavailable" | "already_donated" | "not_owned" | "not_donatable" | "rate_limited" | "failed";
export class CollectionsError extends DomainError<CollectionsErrorCode> {}

export interface CatchResult {
  count: number;
  total_collected: number;
  best_size_cm: number | null;
  new_record: boolean;
}

export interface CollectionsStore {
  roster(): Promise<Species[]>;
  memberItems(memberId: string): Promise<MemberItem[]>;
  donations(): Promise<Donation[]>;
  findDonation(memberId: string, idempotencyKey: string): Promise<Donation | null>;
  /** Atomic: refuse duplicates, consume one specimen, record the donor. */
  donate(memberId: string, speciesKey: string, idempotencyKey: string, sizeCm: number | null): Promise<{ replayed: boolean }>;
  weeklyBests(weekStart: string): Promise<WeeklyBest[]>;
  /** Atomic: count+1, lifetime total+1, personal best size, this week's best. */
  recordCatch(memberId: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<CatchResult>;
  showcase(memberId: string): Promise<(string | null)[]>;
  setShowcase(memberId: string, keys: (string | null)[]): Promise<void>;
}
