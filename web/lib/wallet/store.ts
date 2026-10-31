import type { FishingTask, ShopItem } from "./rules";
import { DomainError } from "@/lib/result";

export type EconomyErrorCode =
  | "unavailable" | "insufficient" | "not_found" | "not_for_sale" | "already_owned" | "bad_qty" | "bad_price" | "sold_out"
  | "not_sellable" | "insufficient_items" | "too_many_open" | "already_resolved" | "forbidden" | "not_owned" | "no_slot" | "locked" | "failed"
  | "not_requested" | "already_filled" | "not_rare_enough" | "not_done" | "already_claimed";
export class EconomyError extends DomainError<EconomyErrorCode> {}

export interface LedgerEntry {
  currency: "coins" | "gems";
  amount: number;
  balance_after: number;
  source: string;
  ref: string | null;
  created_at: string;
}
export interface InventoryRow {
  item: ShopItem;
  qty: number;
  equipped: boolean;
  acquired_at: string;
}
export interface Reservation {
  id: string;
  member_id: string;
  member_name?: string;
  item_id: string;
  item_name?: string;
  gems: number;
  status: "reserved" | "fulfilled" | "cancelled";
  pickup_code: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
}
export interface Sellable {
  item_key: string;
  count: number;
  /** Locked in the bag: selling skips it (specs/game-ui.md §7). */
  locked?: boolean;
}

/** The welcome week's part of a gift: the day (1 to 7), its coins and Gems, and the box's item slug on day 7. */
export interface WelcomeGift { day: number; coins: number; gems: number; item: string | null }
export interface DailyGift { coins: number; balance: number; claimed: boolean; day: string; welcome: WelcomeGift | null }
/** A meal's fishing buff while it lasts (member_buffs): what the server's casts add (lib/collections/rolls.ts fishRoll). */
export interface ActiveBuff {
  source: string;
  luck: number;
  size: number;
  until: string;
}

export interface EconomyStore {
  wallet(memberId: string): Promise<{ coins: number; gems: number }>;
  ledger(memberId: string, limit: number): Promise<LedgerEntry[]>;
  catalogue(): Promise<ShopItem[]>;
  inventory(memberId: string): Promise<InventoryRow[]>;
  /** The free starters, once per account (economy_grant_starters). */
  grantStarters(memberId: string): Promise<{ granted: boolean }>;
  buy(memberId: string, itemId: string, qty: number, priceEach: number, key: string): Promise<{ balance: number; owned: number; replayed: boolean }>;
  collections(memberId: string): Promise<Sellable[]>;
  sell(memberId: string, itemKey: string, qty: number, key: string): Promise<{ balance: number; remaining: number; paid: number; replayed: boolean }>;
  /**
   * The member's fishing so far for the tasks (fishing_task_claim checks the same): the fish landed by rod since the
   * Toronto `day` began, the fish landed since the `week` (its Monday) began, and the tasks claimed, as `<period>:<id>`.
   */
  taskState(memberId: string, day: string, week: string): Promise<{ today: string[]; week: string[]; claimed: string[] }>;
  /**
   * Atomic, once per key (fishing_task_claim): the server checks `task` is done in its period starting `start` and pays
   * `task.reward` coins once (already_claimed under another key; not_done until it's done).
   */
  claimTask(memberId: string, task: FishingTask, start: string, key: string): Promise<{ balance: number; paid: number; replayed: boolean }>;
  /**
   * Atomic, once per key (tackle_roll): pay `cost` in `currency` and receive the rolled prizes (item slugs, in order);
   * a replayed key returns the first roll's prizes and charges nothing.
   */
  tackleRoll(memberId: string, currency: "coins" | "gems", cost: number, prizes: readonly string[], key: string): Promise<{ balance: number; prizes: string[]; replayed: boolean }>;
  /** The chef's orders this member filled on a Toronto day (item keys). */
  chefFills(memberId: string, day: string): Promise<string[]>;
  /**
   * Atomic, once per key (chef_order_fill): hand over one unlocked `itemKey` for the day's order, earn `reward` coins and
   * the staff `meal`; already_filled when filled that day under another key.
   */
  chefFill(memberId: string, day: string, itemKey: string, reward: number, key: string, meal: ActiveBuff): Promise<{ balance: number; remaining: number; paid: number; replayed: boolean }>;
  /**
   * Atomic, once per key (sushi_order): pay `price` coins, or one unlocked `fishKey` for the feast, and eat: `buff`
   * replaces the member's meal buff.
   */
  order(memberId: string, dish: string, price: number, fishKey: string | null, buff: ActiveBuff, key: string): Promise<{ balance: number; paid: number; buff: ActiveBuff; replayed: boolean }>;
  /** The member's meal buff while it lasts at `now`, or null. */
  buff(memberId: string, now: Date): Promise<ActiveBuff | null>;
  setEquipped(memberId: string, itemId: string, equipped: boolean): Promise<void>;
  /** Today's gift, and the welcome week's bonus on the member's first seven gift days (`welcome`, null after them). */
  dailyGift(memberId: string): Promise<DailyGift>;
  dailyClaimed(memberId: string, day: string): Promise<boolean>;
  /** How many days the member has opened the gift (the welcome week's count). */
  giftDays(memberId: string): Promise<number>;
  merchReserve(memberId: string, itemId: string, key: string, pickupCode: string): Promise<{ reservation_id: string; gems_balance: number; replayed: boolean }>;
  reservations(filter: { memberId?: string; status?: Reservation["status"] }): Promise<Reservation[]>;
  merchResolve(reservationId: string, actorId: string, action: "fulfil" | "cancel", note: string | null): Promise<{ status: string; replayed: boolean }>;
  credit(memberId: string, currency: "coins" | "gems", amount: number, source: string, ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}
