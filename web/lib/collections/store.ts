import type { Donation, MemberItem, WeeklyBest } from "./logic";
import type { Species } from "./roster";
import type { TourneyEntry } from "@/lib/progression/seasonal";
import { DomainError } from "@/lib/result";

export type CollectionsErrorCode =
  | "unavailable" | "already_donated" | "not_owned" | "not_donatable" | "rate_limited" | "failed"
  | "too_fast" | "no_roll" | "roll_expired" | "already_landed" | "already_harvested" | "out_of_season" | "none_left"
  | "bag_full" | "storage_full" | "locked" | "insufficient_items" | "key_reused" | "bad_qty" | "bad_credit" | "not_this_month" | "not_bigger";
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

/** What a dig records: a find (into the bag) or a purse (into the wallet). */
export type DigRecord = { item_key: string; size_cm: number | null; trophy: boolean } | { currency: "coins" | "gems"; amount: number };

export interface CatchResult {
  count: number;
  total_collected: number;
  best_size_cm: number | null;
  new_record: boolean;
  /** Land and harvest: the recipe this catch taught, in the same transaction; null when none. */
  recipe?: LearnedRecipe | null;
}

/** A backpack stack (member_collections): the stock, its lock (selling and dropping skip it) and the best size caught. */
export interface BagItem {
  item_key: string;
  count: number;
  locked: boolean;
  best_size_cm: number | null;
}
/** The home storage chest (member_storage). */
export interface ChestItem {
  item_key: string;
  count: number;
}

export interface CollectionsStore {
  roster(): Promise<Species[]>;
  memberItems(memberId: string): Promise<MemberItem[]>;
  donations(): Promise<Donation[]>;
  findDonation(memberId: string, idempotencyKey: string): Promise<Donation | null>;
  /** Atomic: refuse duplicates, consume one specimen, record the donor. */
  donate(memberId: string, speciesKey: string, idempotencyKey: string, sizeCm: number | null): Promise<{ replayed: boolean }>;
  /**
   * Atomic (museum_hand_in, m5): hand one of a species in to the museum's drive, whether or not it's on display yet
   * (a duplicate counts: the drive can always be finished). Consumes one; a replayed key returns replayed.
   */
  handIn(memberId: string, speciesKey: string, idempotencyKey: string): Promise<{ replayed: boolean }>;
  /** Every hand-in (the club's museum drive). */
  handIns(): Promise<{ member_id: string; species_key: string }[]>;
  weeklyBests(weekStart: string): Promise<WeeklyBest[]>;
  /** Atomic: a server-rolled cast waiting to be landed (too_fast within CAST_GAP_MS of the last). Returns its id. */
  cast(memberId: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<string>;
  /**
   * Atomic: record the member's latest cast once, MIN_REEL_MS to ROLL_TTL_MS after it (collections_record_catch's caps apply).
   * `seasonal` (20260929120000): refuse a limited-time catch whose event is `closed`, and enter the open `tourney`.
   * A rare catch may teach a recipe with it (20260930100000).
   */
  land(memberId: string, rollId: string, seasonal?: LandSeason): Promise<CatchResult & { item_key: string; size_cm: number | null }>;
  /** The species of a member's cast roll (landed or not, while it's kept: a day), or null: a raid's opener really had it on the line. */
  rolled(memberId: string, rollId: string): Promise<string | null>;
  /** Atomic: one harvest per node per hour, recorded with collections_record_catch's caps (a capped one leaves the node unharvested); a rare one may teach a recipe. */
  harvest(memberId: string, nodeId: string, hourKey: string, itemKey: string, sizeCm: number | null, trophyEligible: boolean): Promise<CatchResult>;
  /**
   * Atomic (collections_dig): one dig per spot per hour; the member's dig tally +1 (returned as `digs`). A find is recorded
   * like a harvest (caps, bag, recipe); a purse is paid into the wallet once.
   */
  dig(memberId: string, nodeId: string, hourKey: string, loot: DigRecord): Promise<Partial<CatchResult> & { digs: number }>;
  /** Atomic: eat one of a fruit the member has (collections_eat); none_left when they have none. Returns how many are left. */
  eat(memberId: string, itemKey: string): Promise<{ count: number }>;
  /** The member's owned gear keys: catalogue refs and shop slugs (lib/game/tools.ts: rods by ref, nets and shovels by slug). */
  ownedGear(memberId: string): Promise<string[]>;
  /** The member's tools are taught by people (row 312, lib/game/arrival/arrivalService.ts): the starter net and shovel only once given. */
  toolsTaught(memberId: string): Promise<boolean>;
  /** Every entry of one tourney cycle, with names (service role: the route applies the board's privacy). */
  tourneyEntries(goalId: string, cycle: number): Promise<TourneyEntry[]>;
  /** The member's meal buff from the sushi bar while it lasts (member_buffs), which their casts roll with; null when none. */
  buff(memberId: string, now: Date): Promise<{ luck: number; size: number } | null>;
  showcase(memberId: string): Promise<(string | null)[]>;
  setShowcase(memberId: string, keys: (string | null)[]): Promise<void>;
  // ── The backpack and the home storage chest (20261003054110_backpack) ──
  // Every catch above refuses `bag_full` when the item needs a slot the bag doesn't have (cast, land, harvest).
  /** The bag's stacks with their locks, and the chest's. */
  bag(memberId: string): Promise<{ items: BagItem[]; chest: ChestItem[] }>;
  setLocked(memberId: string, itemKey: string, locked: boolean): Promise<void>;
  /** Atomic, once per key: drop `qty` of an unlocked item (gone for good). Returns how many are left. */
  drop(memberId: string, itemKey: string, qty: number, key: string): Promise<{ count: number; replayed: boolean }>;
  /** Atomic, once per key: move `qty` between the bag and the chest (`bag_full` / `storage_full` when it won't fit). */
  move(memberId: string, itemKey: string, qty: number, to: "chest" | "bag", key: string): Promise<{ replayed: boolean }>;
  /** Atomic, once per key: every unlocked material in the bag into the chest. Returns how many moved. */
  storeMaterials(memberId: string, key: string): Promise<{ moved: number; replayed: boolean }>;
  /** The monthly board's entries (monthly_fish_entries) for the month starting `month`, with world names; `caught_at` is when it was entered. */
  monthEntries(month: string): Promise<WeeklyBest[]>;
  /** The biggest of each fish and sea species this member landed since the Toronto `month` began (weekly_catch_bests). */
  monthCatches(memberId: string, month: string): Promise<{ item_key: string; size_cm: number }[]>;
  /**
   * Atomic, once per key (monthly_fish_enter): put one unlocked `itemKey` from the bag on this month's board at the
   * biggest size caught this month; not_this_month when none was, not_bigger when the entry there is as big already.
   */
  enterMonth(memberId: string, itemKey: string, key: string): Promise<{ size_cm: number; replayed: boolean }>;
}
