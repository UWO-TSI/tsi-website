// Server-to-server endpoints (specs/multiplayer.md §2.3, M2): the web app's admin and
// block routes tell the realtime server what changed, so it takes effect at once.
//   POST /internal/sanction {member_id, muted_until?, removed_until?}
//   POST /internal/block    {blocker_id, blocked_id, blocked}
// Each request is signed with the shared secret REALTIME_INTERNAL_SECRET:
//   x-rt-time:      the sender's clock, ms since the epoch (within 30 s of ours)
//   x-rt-nonce:     16–64 of [A-Za-z0-9_-], never reused (a replay inside the window is refused)
//   x-rt-signature: hex HMAC-SHA256 of `${time}.${nonce}.${body}` (web/lib/server/realtimeNotify.ts signs it)
// compared in constant time. Without the secret the endpoints answer 503.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createEndpoint } from "@colyseus/core";
import { z } from "zod";
import type { World } from "./world";

export const INTERNAL_HEADERS = { time: "x-rt-time", nonce: "x-rt-nonce", signature: "x-rt-signature" } as const;
/** The most a request body may weigh. */
export const INTERNAL_MAX_BODY = 2048;

export type InternalCheck = "ok" | "malformed" | "stale" | "bad_signature" | "replay";

const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const TIME = /^\d{1,16}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;

export function signInternal(secret: string, time: string, nonce: string, body: string): string {
  return createHmac("sha256", secret).update(`${time}.${nonce}.${body}`).digest("hex");
}

/** The signature check, with its own memory of nonces for twice the allowed clock skew. */
export function createInternalAuth(o: { secret: string; now?: () => number; skewMs?: number }) {
  const now = o.now ?? Date.now;
  const skewMs = o.skewMs ?? 30_000;
  const secret = Buffer.from(o.secret, "utf8");
  const seen = new Map<string, number>();
  return function check(h: { time: string | null; nonce: string | null; signature: string | null }, body: string): InternalCheck {
    if (!h.time || !TIME.test(h.time) || !h.nonce || !NONCE.test(h.nonce) || !h.signature || !SIGNATURE.test(h.signature.toLowerCase())) return "malformed";
    const t = now();
    if (Math.abs(t - Number(h.time)) > skewMs) return "stale";
    const expected = createHmac("sha256", secret).update(`${h.time}.${h.nonce}.${body}`).digest();
    const got = Buffer.from(h.signature.toLowerCase(), "hex");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return "bad_signature";
    for (const [k, until] of seen) if (until <= t) seen.delete(k);
    if (seen.has(h.nonce)) return "replay";
    seen.set(h.nonce, t + 2 * skewMs);
    return "ok";
  };
}

const when = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), "not a timestamp").nullable();
export const SanctionBody = z
  .strictObject({ member_id: z.uuid(), muted_until: when.optional(), removed_until: when.optional() })
  .refine((b) => b.muted_until !== undefined || b.removed_until !== undefined, "nothing to change");
export const BlockBody = z.strictObject({ blocker_id: z.uuid(), blocked_id: z.uuid(), blocked: z.boolean() });

const STATUS: Record<Exclude<InternalCheck, "ok">, number> = { malformed: 401, stale: 401, bad_signature: 401, replay: 409 };

export type InternalOptions = {
  world: World;
  /** REALTIME_INTERNAL_SECRET; undefined turns the endpoints off (503). */
  secret?: string;
  log: (event: string, fields: Record<string, unknown>) => void;
  now?: () => number;
};

export function internalEndpoints(o: InternalOptions) {
  const check = o.secret ? createInternalAuth({ secret: o.secret, now: o.now }) : null;
  const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

  /** Reads, checks and parses a signed request; a Response is a refusal. */
  async function signed<T>(path: string, request: Request | undefined, schema: z.ZodType<T>): Promise<T | Response> {
    if (!check) return json(503, { ok: false, error: "internal endpoints are off" });
    if (!request) return json(400, { ok: false, error: "no request" });
    const length = Number(request.headers.get("content-length") ?? NaN);
    if (!Number.isFinite(length)) return json(411, { ok: false, error: "length required" });
    if (length > INTERNAL_MAX_BODY) return json(413, { ok: false, error: "too large" });
    const body = await request.text();
    if (body.length > INTERNAL_MAX_BODY) return json(413, { ok: false, error: "too large" });
    const verdict = check(
      {
        time: request.headers.get(INTERNAL_HEADERS.time),
        nonce: request.headers.get(INTERNAL_HEADERS.nonce),
        signature: request.headers.get(INTERNAL_HEADERS.signature),
      },
      body,
    );
    if (verdict !== "ok") {
      o.log("internal_refused", { path, why: verdict });
      return json(STATUS[verdict], { ok: false, error: verdict });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json(400, { ok: false, error: "invalid body" });
    }
    const r = schema.safeParse(parsed);
    return r.success ? r.data : json(400, { ok: false, error: "invalid body" });
  }

  const sanction = createEndpoint("/internal/sanction", { method: "POST", disableBody: true }, async (ctx) => {
    const b = await signed("/internal/sanction", ctx.request, SanctionBody);
    if (b instanceof Response) return b;
    const patch: { muted_until?: string | null; removed_until?: string | null } = {};
    if (b.muted_until !== undefined) patch.muted_until = b.muted_until;
    if (b.removed_until !== undefined) patch.removed_until = b.removed_until;
    const sessions = o.world.sanction(b.member_id.toLowerCase(), patch);
    o.log("sanction", { uid: b.member_id, sessions, muted: b.muted_until !== undefined, removed: b.removed_until !== undefined });
    return json(200, { ok: true, sessions });
  });

  const block = createEndpoint("/internal/block", { method: "POST", disableBody: true }, async (ctx) => {
    const b = await signed("/internal/block", ctx.request, BlockBody);
    if (b instanceof Response) return b;
    const sessions = o.world.block(b.blocker_id.toLowerCase(), b.blocked_id.toLowerCase(), b.blocked);
    return json(200, { ok: true, sessions });
  });

  return { sanction, block };
}
