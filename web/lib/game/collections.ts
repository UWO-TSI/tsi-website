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

function validItemKey(key: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key);
}

/** Zero stock still records discovery; malformed browser data is never inventory. */
export function collectionCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, count]) =>
    validItemKey(key) && typeof count === "number" && Number.isSafeInteger(count) && count >= 0
  ));
}

export function localCollections(scope?: string): Record<string, number> {
  try {
    return collectionCounts(JSON.parse(localStorage.getItem(scope ? `${KEY}:${scope}` : KEY) ?? "{}"));
  } catch {
    return {};
  }
}

/** Record an item locally AND post it to the server (fire-and-forget). */
export function collect(itemKey: string, scope?: string): void {
  if (!validItemKey(itemKey)) return;
  try {
    const all = localCollections(scope);
    all[itemKey] = Math.min(Number.MAX_SAFE_INTEGER, (all[itemKey] ?? 0) + 1);
    localStorage.setItem(scope ? `${KEY}:${scope}` : KEY, JSON.stringify(all));
  } catch {
    /* private browsing */
  }
  if (scope) return;
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
    const have = Object.hasOwn(all, itemKey) ? all[itemKey] : 0;
    if (!validItemKey(itemKey) || !Number.isSafeInteger(n) || n < 1 || !Object.hasOwn(all, itemKey)) return have;
    const left = Math.max(0, have - n);
    all[itemKey] = left;
    localStorage.setItem(KEY, JSON.stringify(all));
    return left;
  } catch {
    return 0;
  }
}

/** Merge server rows with the local record (max count per key). */
export function mergeWithLocal(server: Record<string, number>, scope?: string): Record<string, number> {
  const out = collectionCounts(server);
  for (const [k, n] of Object.entries(localCollections(scope))) {
    out[k] = Math.max(out[k] ?? 0, n);
  }
  return out;
}
