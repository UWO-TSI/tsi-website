"use client";

/**
 * Local-first game-coins wallet (Economy v2 E2 — the play currency, TC 🪙).
 *
 * Same philosophy as collections.ts: every earn records to localStorage AND
 * posts to /api/coins (fire-and-forget). The server wallet (migration 024's
 * earn_coins RPC) is the balance of record when reachable; the local mirror
 * keeps env-less dev, the lab benches, and pre-migration prod working.
 *
 * Coins are NEVER the money tier (Gems) and never convert — display them
 * with lib/economy's COINS constants only.
 */

const KEY = "tsi.coins.local.v1";

export function localCoins(): number {
  try {
    const n = Number(localStorage.getItem(KEY) ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Earn coins: bump the local mirror, post to the server wallet, notify
 * listeners (window "tsi:coins" CustomEvent with the new local total).
 * Returns the new LOCAL total for immediate UI.
 */
export function earnCoins(amount: number, reason: string): number {
  const amt = Math.max(1, Math.min(4000, Math.floor(amount)));
  let total = amt;
  try {
    total = localCoins() + amt;
    localStorage.setItem(KEY, String(total));
  } catch {
    /* private browsing */
  }
  fetch("/api/coins", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amt, reason }),
  }).catch(() => {});
  try {
    window.dispatchEvent(new CustomEvent("tsi:coins", { detail: { coins: total, earned: amt } }));
  } catch {
    /* SSR safety */
  }
  return total;
}

/** Display balance: the server wallet when it exists, else the local mirror. */
export function displayCoins(server: number | null | undefined): number {
  return server ?? localCoins();
}
