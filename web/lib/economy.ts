/**
 * Economy v2 display constants (David ruling 2026-07-25 — see
 * specs/economy-v2-currencies.md).
 *
 * ⚠ SCHEMA MAPPING — READ BEFORE TOUCHING CURRENCY CODE:
 * The live DB's `tc_balance` / `pay_tc` / `price_tc` / `tc_reward` columns
 * hold the MONEY-EQUIVALENT tier, displayed as **Gems 💎** since 2026-07-25.
 * The column names are historical; they are NOT renamed pre-beta (live
 * prod shares the schema). The in-game play currency ("TC 🪙", earned by
 * selling catches) is a SEPARATE wallet: code name `coins`, arriving with
 * migration 023. No code path may ever convert coins→gems or coins→CAD,
 * and the Gem ≈ CAD rate is never revealed in user-facing strings.
 */

/** Money-equivalent tier (backed by the legacy tc_* columns). */
export const GEMS = {
  name: "Gems",
  singular: "Gem",
  symbol: "💎",
} as const;

/** In-game play currency (the `coins` wallet, migration 023). */
export const COINS = {
  name: "TC",
  singular: "TC",
  symbol: "🪙",
} as const;

/** "1,234 💎" — the standard Gems balance rendering. */
export function fmtGems(n: number): string {
  return `${n.toLocaleString()} ${GEMS.symbol}`;
}

/** "350 🪙" — the standard coins rendering. */
export function fmtCoins(n: number): string {
  return `${n.toLocaleString()} ${COINS.symbol}`;
}
