import type { Donation, MemberItem, WeeklyBest } from "./logic";
import type { Species } from "./roster";
import { DomainError } from "@/lib/result";

export type CollectionsErrorCode =
  | "unavailable" | "already_donated" | "not_owned" | "not_donatable" | "rate_limited" | "failed"
  | "too_fast" | "no_roll" | "roll_expired" | "already_landed" | "already_harvested";
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
  /** Atomic: count+1, lifetime total+1, personal best size, this week's best; capped per species and member per hour. */
  recordCatch(memberId: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<CatchResult>;
  /** Atomic: a server-rolled cast waiting to be landed (too_fast within CAST_GAP_MS of the last). Returns its id. */
  cast(memberId: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<string>;
  /** Atomic: record the member's latest cast once, MIN_REEL_MS to ROLL_TTL_MS after it (recordCatch caps apply). */
  land(memberId: string, rollId: string): Promise<CatchResult & { item_key: string; size_cm: number | null }>;
  /** Atomic: one harvest per node per hour, recorded through recordCatch (a capped one leaves the node unharvested). */
  harvest(memberId: string, nodeId: string, hourKey: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<CatchResult>;
  /** Catalogue refs of the member's owned gear (rods). */
  ownedGear(memberId: string): Promise<string[]>;
  showcase(memberId: string): Promise<(string | null)[]>;
  setShowcase(memberId: string, keys: (string | null)[]): Promise<void>;
}
