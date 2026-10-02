import type { Donation, MemberItem, WeeklyBest } from "./logic";
import type { Species } from "./roster";
import type { TourneyEntry } from "@/lib/progression/seasonal";
import { DomainError } from "@/lib/result";

export type CollectionsErrorCode =
  | "unavailable" | "already_donated" | "not_owned" | "not_donatable" | "rate_limited" | "failed"
  | "too_fast" | "no_roll" | "roll_expired" | "already_landed" | "already_harvested" | "out_of_season";
export class CollectionsError extends DomainError<CollectionsErrorCode> {}

export interface TourneyRef {
  goal_id: string;
  cycle: number;
}
/** The seasonal side of a land: limited-time species whose event isn't running, and the tourney that is. */
export interface LandSeason {
  closed: string[];
  tourney: TourneyRef | null;
}

/** A recipe a rare catch taught (20260930100000 crafting_catch_drop). */
export interface LearnedRecipe {
  id: string;
  name: string;
}

export interface CatchResult {
  count: number;
  total_collected: number;
  best_size_cm: number | null;
  new_record: boolean;
  /** Land and harvest: the recipe this catch taught, in the same transaction; null when none. */
  recipe?: LearnedRecipe | null;
}

export interface CollectionsStore {
  roster(): Promise<Species[]>;
  memberItems(memberId: string): Promise<MemberItem[]>;
  donations(): Promise<Donation[]>;
  findDonation(memberId: string, idempotencyKey: string): Promise<Donation | null>;
  /** Atomic: refuse duplicates, consume one specimen, record the donor. */
  donate(memberId: string, speciesKey: string, idempotencyKey: string, sizeCm: number | null): Promise<{ replayed: boolean }>;
  weeklyBests(weekStart: string): Promise<WeeklyBest[]>;
  /** Atomic: a server-rolled cast waiting to be landed (too_fast within CAST_GAP_MS of the last). Returns its id. */
  cast(memberId: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<string>;
  /**
   * Atomic: record the member's latest cast once, MIN_REEL_MS to ROLL_TTL_MS after it (collections_record_catch's caps apply).
   * `seasonal` (20260929120000): refuse a limited-time catch whose event is `closed`, and enter the open `tourney`.
   * A rare catch may teach a recipe with it (20260930100000).
   */
  land(memberId: string, rollId: string, seasonal?: LandSeason): Promise<CatchResult & { item_key: string; size_cm: number | null }>;
  /** Atomic: one harvest per node per hour, recorded with collections_record_catch's caps (a capped one leaves the node unharvested); a rare one may teach a recipe. */
  harvest(memberId: string, nodeId: string, hourKey: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<CatchResult>;
  /** The member's owned gear keys: catalogue refs and shop slugs (lib/game/tools.ts: rods by ref, nets and shovels by slug). */
  ownedGear(memberId: string): Promise<string[]>;
  /** Every entry of one tourney cycle, with names (service role: the route applies the board's privacy). */
  tourneyEntries(goalId: string, cycle: number): Promise<TourneyEntry[]>;
  showcase(memberId: string): Promise<(string | null)[]>;
  setShowcase(memberId: string, keys: (string | null)[]): Promise<void>;
}
