/**
 * Tell the realtime server about a sanction or a block at once (specs/multiplayer.md §2.3, M2), so a T1/T2 mute or
 * removal reaches a player in the island within a second and a block stops chat between the pair without a rejoin.
 * Server-only: REALTIME_INTERNAL_URL (e.g. https://tethos-rt.fly.dev) and REALTIME_INTERNAL_SECRET (the same 32+
 * characters as the Fly secret). Either unset (local development): skipped, silently. A failure never fails the
 * route: the realtime server re-reads connected players' sanctions every 60 s, and blocks at the next join.
 *
 * The signature (realtime/src/internal.ts checks it): x-rt-time (ms), x-rt-nonce (single use) and x-rt-signature,
 * the hex HMAC-SHA256 of `${time}.${nonce}.${body}` with the secret.
 */
import { createHmac, randomBytes } from "node:crypto";

export const REALTIME_HEADERS = { time: "x-rt-time", nonce: "x-rt-nonce", signature: "x-rt-signature" } as const;
/** How long a route waits for the realtime server. */
export const REALTIME_NOTIFY_TIMEOUT_MS = 2000;

export type SanctionNotice = { member_id: string; muted_until?: string | null; removed_until?: string | null };
export type BlockNotice = { blocker_id: string; blocked_id: string; blocked: boolean };
/** applied: the server took it (its players' sessions changed now); skipped: not configured; failed: the poll catches up. */
export type RealtimeNotice = "applied" | "skipped" | "failed";

export function signRealtime(secret: string, time: string, nonce: string, body: string): string {
  return createHmac("sha256", secret).update(`${time}.${nonce}.${body}`).digest("hex");
}

export interface NotifyOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

export function notifyRealtime(path: "/internal/sanction", payload: SanctionNotice, o?: NotifyOptions): Promise<RealtimeNotice>;
export function notifyRealtime(path: "/internal/block", payload: BlockNotice, o?: NotifyOptions): Promise<RealtimeNotice>;
export async function notifyRealtime(path: string, payload: SanctionNotice | BlockNotice, o: NotifyOptions = {}): Promise<RealtimeNotice> {
  const env = o.env ?? process.env;
  const base = env.REALTIME_INTERNAL_URL, secret = env.REALTIME_INTERNAL_SECRET;
  if (!base || !secret) return "skipped";
  const body = JSON.stringify(payload);
  const time = String((o.now ?? Date.now)());
  const nonce = randomBytes(16).toString("hex");
  try {
    const res = await (o.fetch ?? fetch)(new URL(path, base), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REALTIME_HEADERS.time]: time,
        [REALTIME_HEADERS.nonce]: nonce,
        [REALTIME_HEADERS.signature]: signRealtime(secret, time, nonce, body),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(o.timeoutMs ?? REALTIME_NOTIFY_TIMEOUT_MS),
    });
    if (res.ok) return "applied";
    console.warn(`realtime notify ${path}: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`realtime notify ${path}: ${e instanceof Error ? e.name : "error"}`);
  }
  return "failed";
}
