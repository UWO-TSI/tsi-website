import type { ShopItem } from "./rules";
import { DomainError } from "@/lib/result";

export type EconomyErrorCode =
  | "unavailable" | "insufficient" | "not_found" | "not_for_sale" | "already_owned" | "bad_qty" | "bad_price" | "sold_out"
  | "not_sellable" | "insufficient_items" | "too_many_open" | "already_resolved" | "forbidden" | "not_owned" | "no_slot" | "locked" | "failed";
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
  setEquipped(memberId: string, itemId: string, equipped: boolean): Promise<void>;
  dailyGift(memberId: string): Promise<{ coins: number; balance: number; claimed: boolean; day: string }>;
  dailyClaimed(memberId: string, day: string): Promise<boolean>;
  merchReserve(memberId: string, itemId: string, key: string, pickupCode: string): Promise<{ reservation_id: string; gems_balance: number; replayed: boolean }>;
  reservations(filter: { memberId?: string; status?: Reservation["status"] }): Promise<Reservation[]>;
  merchResolve(reservationId: string, actorId: string, action: "fulfil" | "cancel", note: string | null): Promise<{ status: string; replayed: boolean }>;
  credit(memberId: string, currency: "coins" | "gems", amount: number, source: string, ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}
