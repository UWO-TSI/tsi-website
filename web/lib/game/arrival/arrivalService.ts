/**
 * The account's arrival flag (specs/v1-drop.md §1: the opening plays once per account). The tutorial's reward is the
 * flag: Bram's coins go into the wallet once, under one idempotency key, whether you walk the tour or skip it, so
 * "has this account arrived" is "is that credit in its ledger". No new table, nothing to migrate; the reward can never
 * be paid twice. Server side: app/api/world/arrival.
 */
import { TUTORIAL_REWARD } from "./lines";

export const ARRIVAL_KEY = "arrival:v1";

/** The two ledger operations the flag needs (the wallet's store, lib/wallet). */
export interface ArrivalLedger {
  /** Whether the member's ledger already holds this idempotency key. */
  has(memberId: string, key: string): Promise<boolean>;
  credit(memberId: string, currency: "coins", amount: number, source: "quest", ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}

export const hasArrived = (ledger: ArrivalLedger, memberId: string) => ledger.has(memberId, ARRIVAL_KEY);

/** Arrived: Bram's coins, once. Asked again it pays nothing and says so. */
export async function finishArrival(ledger: ArrivalLedger, memberId: string): Promise<{ coins: number; balance: number; granted: boolean }> {
  const r = await ledger.credit(memberId, "coins", TUTORIAL_REWARD.coins, "quest", "arrival", ARRIVAL_KEY);
  return { coins: r.replayed ? 0 : TUTORIAL_REWARD.coins, balance: r.balance, granted: !r.replayed };
}
