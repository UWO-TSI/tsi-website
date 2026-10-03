// What the server knows about a player (specs/multiplayer.md §2.2): one service-only
// RPC, `realtime_player_card`, read once per join, cached 60 s per user and re-read
// on a `refresh` message at most once per 10 s. Keys and numbers only: clients derive
// icons, titles and aura ramps from their own tables. The name is the world name
// (or "Islander"), never the Google name in profiles.display_name (row 222).
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Identity } from "./verify";

/** Exactly the keys realtime_player_card returns (web/supabase/migrations/*_realtime_card.sql). */
export const CARD_FIELDS = [
  "name",
  "badge",
  "tier",
  "look",
  "family",
  "level",
  "subclass",
  "mastery",
  "aura",
  "frame",
  "classes_v2",
  "muted_until",
  "removed_until",
  "created_at",
] as const;

const timestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "not a timestamp");

export const PlayerCardSchema = z.strictObject({
  name: z.string().min(1).max(32),
  badge: z.literal("member").nullable(),
  tier: z.number().int().min(1).max(5),
  /** avatar_config->'look' (≤ 2 KB) or null; parsed by the client with parseLook. */
  look: z.record(z.string(), z.unknown()).nullable(),
  family: z.enum(["Arcane", "Ranger", "Vanguard", "Warden"]).nullable(),
  level: z.number().int().min(1).max(50),
  subclass: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/).nullable(),
  mastery: z.number().int().min(1).max(20).nullable(),
  aura: z.string().max(64).nullable(),
  frame: z.string().max(64).nullable(),
  classes_v2: z.boolean(),
  muted_until: timestamp.nullable(),
  removed_until: timestamp.nullable(),
  created_at: timestamp,
});

export type PlayerCard = z.infer<typeof PlayerCardSchema>;

export type CardFailure = "no_profile" | "timeout" | "unavailable" | "invalid";

export class CardError extends Error {
  constructor(readonly reason: CardFailure, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "CardError";
  }
}

/** Fetches one raw card: null when the member has no profile. */
export type CardSource = (uid: string, signal: AbortSignal) => Promise<unknown>;

export type LoadCard = (identity: Identity, opts?: { refresh?: boolean }) => Promise<PlayerCard>;

export type CardLoaderOptions = {
  source: CardSource;
  ttlMs?: number;
  timeoutMs?: number;
  /** A refresh re-reads at most this often per user; sooner ones get the cached card. */
  refreshMinMs?: number;
  now?: () => number;
};

type Entry = { card: PlayerCard; fetchedAt: number };

/** Cards for dev tokens: no database. Varied by name so bot crowds don't look identical. */
export function devCard(identity: Identity): PlayerCard {
  const name = identity.devName ?? "Dev";
  const h = createHash("sha256").update(name).digest();
  const families = ["Arcane", "Ranger", "Vanguard", "Warden"] as const;
  return {
    name: name.slice(0, 16),
    badge: h[0] % 3 === 0 ? null : "member",
    tier: 4,
    look: null,
    family: families[h[1] % 4],
    level: 1 + (h[2] % 30),
    subclass: null,
    mastery: null,
    aura: null,
    frame: null,
    classes_v2: false,
    muted_until: null,
    removed_until: null,
    created_at: "2026-09-29T00:00:00.000Z",
  };
}

export function createCardLoader(opts: CardLoaderOptions): LoadCard {
  const ttlMs = opts.ttlMs ?? 60_000;
  const timeoutMs = opts.timeoutMs ?? 3_000;
  const refreshMinMs = opts.refreshMinMs ?? 10_000;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, Entry>();
  const inflight = new Map<string, Promise<PlayerCard>>();
  let lastSweep = now();

  function sweep(t: number) {
    if (t - lastSweep < ttlMs) return;
    lastSweep = t;
    for (const [uid, e] of cache) if (t - e.fetchedAt >= ttlMs) cache.delete(uid);
  }

  async function fetchCard(uid: string): Promise<PlayerCard> {
    const ac = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ac.abort();
        reject(new CardError("timeout"));
      }, timeoutMs);
    });
    let raw: unknown;
    try {
      raw = await Promise.race([opts.source(uid, ac.signal), timeout]);
    } catch (e) {
      if (e instanceof CardError) throw e;
      throw new CardError("unavailable", e instanceof Error ? e.message : undefined);
    } finally {
      clearTimeout(timer);
    }
    if (raw === null || raw === undefined) throw new CardError("no_profile");
    const parsed = PlayerCardSchema.safeParse(raw);
    if (!parsed.success) throw new CardError("invalid", parsed.error.issues.map((i) => i.path.join(".")).join(","));
    cache.set(uid, { card: parsed.data, fetchedAt: now() });
    return parsed.data;
  }

  return async function loadCard(identity, { refresh = false } = {}) {
    if (identity.dev) return devCard(identity);
    const t = now();
    sweep(t);
    const hit = cache.get(identity.uid);
    if (hit) {
      const age = t - hit.fetchedAt;
      if (refresh ? age < refreshMinMs : age < ttlMs) return hit.card;
    }
    let p = inflight.get(identity.uid);
    if (!p) {
      p = fetchCard(identity.uid).finally(() => inflight.delete(identity.uid));
      inflight.set(identity.uid, p);
    }
    return p;
  };
}

/** The production source: the service-only RPC through the secret key. */
export function supabaseCardSource(url: string, secretKey: string): CardSource {
  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async (uid, signal) => {
    const { data, error } = await db.rpc("realtime_player_card", { p_member: uid }).abortSignal(signal);
    if (error) throw new Error(`rpc ${error.code ?? "error"}`);
    return data;
  };
}
