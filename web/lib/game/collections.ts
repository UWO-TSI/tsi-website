"use client";

/**
 * Local-first collections (loop iter 4, David bug report 2026-07-24:
 * "fish, foraging, flower etc does not show in items tab").
 *
 * The server rolls and records every member catch (catchRequest). Without a
 * session (or on the env-less preview) there is no server record, so this
 * keeps one in localStorage too, and readers merge both, so the Collection
 * Book always reflects what you actually did. Server stays the source of
 * truth when it works; local fills the gaps.
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

const RECORDS_KEY = "tsi.records.local.v1";
/** Local personal best sizes (cm) per species, mirrored for offline catch cards. */
export function localRecords(): Record<string, number> {
  try { return collectionCounts(JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "{}")); } catch { return {}; }
}

/** Keep a size against this browser's personal bests; true when it beat a previous one. */
export function localRecord(itemKey: string, sizeCm: number | null): boolean {
  const records = localRecords();
  const prior = records[itemKey];
  if (sizeCm !== null && (prior === undefined || sizeCm > prior)) {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...records, [itemKey]: sizeCm })); } catch { /* private browsing */ }
  }
  return sizeCm !== null && prior !== undefined && sizeCm > prior;
}

/**
 * Record an item in this browser (the mirror of a server catch, or the whole
 * record signed out). A `scope` (the applicant island) keeps a separate record.
 */
export function collect(itemKey: string, { scope }: { scope?: string } = {}): void {
  if (!validItemKey(itemKey)) return;
  try {
    const all = localCollections(scope);
    all[itemKey] = Math.min(Number.MAX_SAFE_INTEGER, (all[itemKey] ?? 0) + 1);
    localStorage.setItem(scope ? `${KEY}:${scope}` : KEY, JSON.stringify(all));
  } catch {
    /* private browsing */
  }
}

/** A recorded catch (harvest, land), or a cast's roll waiting to be landed. `recipe`: what a rare catch taught. */
export interface CatchReply { item_key: string; size_cm: number | null; roll?: string; count?: number; total_collected?: number; new_record?: boolean; recipe?: { id: string; name: string } | null }
export type CatchAnswer = { ok: true; catch: CatchReply } | { ok: false; error: string; code?: string };

/**
 * POST /api/collections: the server rolls and records the catch
 * (lib/collections/service.ts catchAction). null = no account or no server:
 * the caller rolls locally and keeps it in this browser, as before.
 */
async function catchRequest(body: Record<string, unknown>): Promise<CatchAnswer | null> {
  try {
    const res = await fetch("/api/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 503) return null;
    const json = await res.json().catch(() => null);
    return res.ok && json?.catch ? { ok: true, catch: json.catch } : { ok: false, error: json?.error ?? "Something went wrong. Try again.", code: json?.code };
  } catch {
    return null;
  }
}
/** A forage node or bug spot, from where the player stands. */
export const harvestNode = (node: string, at: [number, number]) => catchRequest({ action: "harvest", node, at });
/** Roll the fish that will bite, from where the player stands; landed with landCatch when the reel is won. */
export const castLine = (site: "village" | "home", at: [number, number], power: number) => catchRequest({ action: "cast", site, at, power });
export const landCatch = (roll: string) => catchRequest({ action: "land", roll });

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
