import type { ShopItem } from "./rules";
import { DomainError } from "@/lib/result";

export type EconomyErrorCode =
  | "unavailable" | "insufficient" | "not_found" | "not_for_sale" | "already_owned" | "bad_qty" | "bad_price" | "sold_out"
  | "not_sellable" | "insufficient_items" | "too_many_open" | "already_resolved" | "forbidden" | "not_owned" | "no_slot" | "locked" | "failed"
  | "not_requested" | "already_filled" | "not_rare_enough";
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
  /** The requests (f-requests: the fish market's, the sushi chef's) this member filled on a Toronto day. */
  requestFills(memberId: string, day: string): Promise<{ board: "market" | "chef"; item_key: string }[]>;
  /**
   * Atomic, once per key (fish_request_fill): hand over one unlocked `itemKey` for the day's request on `board` and earn
   * `reward` coins, and `meal` when given (the chef's staff meal); already_filled when filled that day under another key.
   */
  fillRequest(memberId: string, day: string, board: "market" | "chef", itemKey: string, reward: number, key: string, meal?: ActiveBuff): Promise<{ balance: number; remaining: number; paid: number; replayed: boolean }>;
  /**
   * Atomic, once per key (sushi_order): pay `price` coins, or one unlocked `fishKey` for the feast, and eat: `buff`
   * replaces the member's meal buff.
   */
  order(memberId: string, dish: string, price: number, fishKey: string | null, buff: ActiveBuff, key: string): Promise<{ balance: number; paid: number; buff: ActiveBuff; replayed: boolean }>;
  /** The member's meal buff while it lasts at `now`, or null. */
  buff(memberId: string, now: Date): Promise<ActiveBuff | null>;
  setEquipped(memberId: string, itemId: string, equipped: boolean): Promise<void>;
  dailyGift(memberId: string): Promise<{ coins: number; balance: number; claimed: boolean; day: string }>;
  dailyClaimed(memberId: string, day: string): Promise<boolean>;
  merchReserve(memberId: string, itemId: string, key: string, pickupCode: string): Promise<{ reservation_id: string; gems_balance: number; replayed: boolean }>;
  reservations(filter: { memberId?: string; status?: Reservation["status"] }): Promise<Reservation[]>;
  merchResolve(reservationId: string, actorId: string, action: "fulfil" | "cancel", note: string | null): Promise<{ status: string; replayed: boolean }>;
  credit(memberId: string, currency: "coins" | "gems", amount: number, source: string, ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}
