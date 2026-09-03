"use client";

/**
 * Local-first collections (loop iter 4, David bug report 2026-07-24:
 * "fish, foraging, flower etc does not show in items tab").
 *
 * Every catch/pick POSTs /api/collections — but without a session (or on
 * the env-less preview) that 401s and the item vanishes. This helper
 * records everything in localStorage too, and readers merge both, so the
 * Collection Book always reflects what you actually did. Server stays the
 * source of truth when it works; local fills the gaps.
 */

const KEY = "tsi.collections.local.v1";

export function localCollections(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Record an item locally AND post it to the server (fire-and-forget). */
export function collect(itemKey: string): void {
  try {
    const all = localCollections();
    all[itemKey] = (all[itemKey] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private browsing */
  }
  fetch("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_key: itemKey }),
  }).catch(() => {});
}

/**
 * Spend/remove n of an item from the LOCAL record (Wharf Shack sales, E3).
 * v1 is local-first: the server collection row is NOT decremented yet — a
 * server-side atomic sale (decrement + earn) is the E4 follow-up before
 * beta, since mergeWithLocal(max) would resurrect sold counts on authed
 * accounts. Returns the remaining local count.
 */
export function spendCollected(itemKey: string, n: number): number {
  try {
    const all = localCollections();
    const left = Math.max(0, (all[itemKey] ?? 0) - n);
    if (left === 0) delete all[itemKey];
    else all[itemKey] = left;
    localStorage.setItem(KEY, JSON.stringify(all));
    return left;
  } catch {
    return 0;
  }
}

/** Merge server rows with the local record (max count per key). */
export function mergeWithLocal(server: Record<string, number>): Record<string, number> {
  const out = { ...server };
  for (const [k, n] of Object.entries(localCollections())) {
    out[k] = Math.max(out[k] ?? 0, n);
  }
  return out;
}
