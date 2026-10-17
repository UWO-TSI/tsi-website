/**
 * The account's arrival flag (specs/v1-drop.md §1: the opening plays once per account). The tutorial's reward is the
 * flag: Bram's coins go into the wallet once, under one idempotency key, whether you walk the tour or skip it, so
 * "has this account arrived" is "is that credit in its ledger". No new table, nothing to migrate; the reward can never
 * be paid twice. Server side: app/api/world/arrival.
 *
 * Row 312 (specs/hq-onboarding.md): an account that arrives from now on is paid under its own key, ARRIVAL_TAUGHT_KEY,
 * and that key is also the flag that its tools are taught by people: after Bram's rod, the net and the shovel come from
 * residents (lib/game/tools.ts TAUGHT_KINDS). An account that arrived before (ARRIVAL_KEY) or never arrived (it was
 * playing before the opening existed) keeps the starter net and shovel.
 */
import { TUTORIAL_REWARD } from "./lines";

/** Arrived before row 312: the starter net and shovel stay yours. */
export const ARRIVAL_KEY = "arrival:v1";
/** Arrived under row 312: the same reward, and your net and shovel are taught by residents. */
export const ARRIVAL_TAUGHT_KEY = "arrival:v2";

/** The two ledger operations the flag needs (the wallet's store, lib/wallet). */
export interface ArrivalLedger {
  /** Whether the member's ledger already holds this idempotency key. */
  has(memberId: string, key: string): Promise<boolean>;
  credit(memberId: string, currency: "coins", amount: number, source: "quest", ref: string, key: string): Promise<{ balance: number; replayed: boolean }>;
}

/** Arrived (either key), and whether the account's tools are taught (the row 312 key). */
export async function arrivalStatus(ledger: Pick<ArrivalLedger, "has">, memberId: string): Promise<{ arrived: boolean; taught: boolean }> {
  const [before, taught] = await Promise.all([ledger.has(memberId, ARRIVAL_KEY), ledger.has(memberId, ARRIVAL_TAUGHT_KEY)]);
  return { arrived: before || taught, taught };
}
export const hasArrived = async (ledger: Pick<ArrivalLedger, "has">, memberId: string) => (await arrivalStatus(ledger, memberId)).arrived;

/**
 * Arrived: Bram's coins, once. Asked again it pays nothing and says so. An account paid under the old key replays that
 * credit (nothing paid, its tools stay as they were); any other is paid under the row 312 key and its tools are taught.
 */
export async function finishArrival(ledger: ArrivalLedger, memberId: string): Promise<{ coins: number; balance: number; granted: boolean; taught: boolean }> {
  const before = await ledger.has(memberId, ARRIVAL_KEY);
  const r = await ledger.credit(memberId, "coins", TUTORIAL_REWARD.coins, "quest", "arrival", before ? ARRIVAL_KEY : ARRIVAL_TAUGHT_KEY);
  return { coins: r.replayed ? 0 : TUTORIAL_REWARD.coins, balance: r.balance, granted: !r.replayed, taught: !before };
}
