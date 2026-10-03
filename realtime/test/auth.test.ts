// specs/multiplayer.md §7 realtime/test/auth.test.ts: the token, origin and card gates.
// The room-level codes (4001/4002/4006 on a real join) are in island.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { SignJWT } from "jose";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { authenticate, JoinRefused, type AuthServices } from "../src/auth/authenticate";
import { CARD_FIELDS, CardError, createCardLoader, devCard, PlayerCardSchema, type PlayerCard } from "../src/auth/card";
import { createOriginPolicy } from "../src/auth/origin";
import { AuthError, createVerifier, devUid, type Identity, type Verify } from "../src/auth/verify";
import { createApp } from "../src/app.config";
import { DEFAULT_ALLOWED_ORIGIN_PATTERNS, DEFAULT_ALLOWED_ORIGINS, DEV_ORIGIN_PATTERNS, parseEnv } from "../src/env";
import { createTestKeys, TEST_SUPABASE_URL, type TestKeys } from "./helpers/jwt";

const PORT = 2591;
const MEMBER = "11111111-2222-4333-8444-555555555555";

let keys: TestKeys;
let verify: Verify;

beforeAll(async () => {
  keys = await createTestKeys();
  verify = createVerifier({ supabaseUrl: TEST_SUPABASE_URL, jwks: keys.jwks, devAuth: true, production: false });
});

async function reason(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AuthError) return e.reason;
    if (e instanceof CardError) return e.reason;
    if (e instanceof JoinRefused) return e.refusal;
    throw e;
  }
  return "accepted";
}

describe("verify: Supabase access tokens", () => {
  it("accepts a valid ES256 token and returns the verified sub", async () => {
    await expect(verify(await keys.sign())).resolves.toEqual({ uid: MEMBER, dev: false });
  });

  it("refuses a missing token", async () => {
    expect(await reason(verify(undefined))).toBe("missing_token");
    expect(await reason(verify(""))).toBe("missing_token");
    expect(await reason(verify(null))).toBe("missing_token");
  });

  it("refuses a bad signature", async () => {
    expect(await reason(verify(await keys.sign({}, { key: "other" })))).toBe("invalid_token");
    const t = await keys.sign();
    const tampered = t.slice(0, t.lastIndexOf(".") + 1) + "A".repeat(86);
    expect(await reason(verify(tampered))).toBe("invalid_token");
    expect(await reason(verify("not.a.jwt"))).toBe("invalid_token");
  });

  it("refuses an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(await reason(verify(await keys.sign({}, { expiresIn: past })))).toBe("expired");
  });

  it("refuses the wrong issuer or audience", async () => {
    expect(await reason(verify(await keys.sign({ iss: "https://evil.supabase.co/auth/v1" })))).toBe("wrong_issuer");
    expect(await reason(verify(await keys.sign({ aud: "anon" })))).toBe("wrong_audience");
  });

  it("refuses anonymous sign-ins and non-authenticated roles", async () => {
    expect(await reason(verify(await keys.sign({ is_anonymous: true })))).toBe("anonymous");
    expect(await reason(verify(await keys.sign({ role: "anon" })))).toBe("not_authenticated");
    expect(await reason(verify(await keys.sign({ role: "service_role" })))).toBe("not_authenticated");
  });

  it("refuses a token signed with another algorithm (HS256 with a guessed secret)", async () => {
    const hs = await new SignJWT({ sub: MEMBER, role: "authenticated", aud: "authenticated", iss: `${TEST_SUPABASE_URL}/auth/v1` })
      .setProtectedHeader({ alg: "HS256", kid: "test-kid" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-guessed-shared-secret-of-enough-length"));
    expect(await reason(verify(hs))).toBe("invalid_token");
  });

  it("refuses a token whose sub is not a user id", async () => {
    expect(await reason(verify(await keys.sign({ sub: "service" })))).toBe("invalid_token");
  });

  it("refuses real tokens when no Supabase URL is configured", async () => {
    const local = createVerifier({ devAuth: true, production: false });
    expect(await reason(local(await keys.sign()))).toBe("unconfigured");
  });
});

describe("verify: dev tokens", () => {
  it("accepts dev:<name> with DEV_AUTH outside production, with a stable synthetic id", async () => {
    const a = await verify("dev:Alice");
    expect(a).toEqual({ uid: devUid("Alice"), dev: true, devName: "Alice" });
    expect(a.uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect((await verify("dev:Bob")).uid).not.toBe(a.uid);
  });

  it("refuses a dev token in production, even with DEV_AUTH set", async () => {
    const prod = createVerifier({ supabaseUrl: TEST_SUPABASE_URL, jwks: keys.jwks, devAuth: true, production: true });
    expect(await reason(prod("dev:Alice"))).toBe("dev_refused");
    // ...and production still accepts real tokens.
    await expect(prod(await keys.sign())).resolves.toMatchObject({ uid: MEMBER });
  });

  it("refuses dev tokens without DEV_AUTH", async () => {
    const off = createVerifier({ supabaseUrl: TEST_SUPABASE_URL, jwks: keys.jwks, devAuth: false, production: false });
    expect(await reason(off("dev:Alice"))).toBe("dev_refused");
  });

  it("refuses malformed dev names", async () => {
    for (const t of ["dev:", "dev:a b", "dev:../x", `dev:${"x".repeat(25)}`]) {
      expect(await reason(verify(t))).toBe("invalid_token");
    }
  });

  it("never enables DEV_AUTH from a production environment", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", DEV_AUTH: "1", SUPABASE_URL: TEST_SUPABASE_URL, SUPABASE_SECRET_KEY: "x".repeat(32) }),
    ).toThrow(/DEV_AUTH/);
  });
});

describe("origins", () => {
  const prod = createOriginPolicy({ origins: DEFAULT_ALLOWED_ORIGINS, patterns: DEFAULT_ALLOWED_ORIGIN_PATTERNS });
  const dev = createOriginPolicy({ origins: DEFAULT_ALLOWED_ORIGINS, patterns: [...DEFAULT_ALLOWED_ORIGIN_PATTERNS, ...DEV_ORIGIN_PATTERNS] });

  it("allows the §1.4 sites and the uwotsi Vercel previews", () => {
    for (const o of [...DEFAULT_ALLOWED_ORIGINS, "https://uwotsi-git-feat-x-davids-projects-e31987e3.vercel.app", "https://uwotsi-abc123-davids-projects-e31987e3.vercel.app"]) {
      expect(prod.allows(o), o).toBe(true);
    }
  });

  it("refuses look-alikes, other schemes and other previews", () => {
    for (const o of [
      "https://evil.example",
      "https://www.tethos.ca.evil.example",
      "http://www.tethos.ca",
      "https://tethos.ca:8443",
      "https://evil-davids-projects-e31987e3.vercel.app",
      "https://uwotsi-x-davids-projects-e31987e3.vercel.app.evil.example",
      "null",
      "http://localhost:3000",
    ]) {
      expect(prod.allows(o), o).toBe(false);
    }
  });

  it("allows localhost only outside production", () => {
    for (const o of ["http://localhost:3000", "http://play.localhost:3001", "http://127.0.0.1:3102", "http://localhost"]) {
      expect(dev.allows(o), o).toBe(true);
    }
    expect(dev.allows("http://localhost.evil.example")).toBe(false);
  });

  it("lets non-browser clients (no Origin header) through to the token check", () => {
    expect(prod.allows(undefined)).toBe(true);
    expect(prod.allows(null)).toBe(true);
  });
});

const CARD: PlayerCard = {
  name: "Maple",
  badge: "member",
  tier: 4,
  look: { body: "v7" },
  family: "Warden",
  level: 12,
  subclass: "druid",
  mastery: 3,
  aura: "mastery:colour",
  frame: null,
  classes_v2: false,
  muted_until: null,
  removed_until: null,
  created_at: "2026-09-29T04:27:00.123456+00:00",
};
const IDENTITY: Identity = { uid: MEMBER, dev: false };

describe("card loader", () => {
  it("validates the RPC's shape: exactly the §2.2 keys", () => {
    expect(Object.keys(PlayerCardSchema.shape).sort()).toEqual([...CARD_FIELDS].sort());
    expect(PlayerCardSchema.safeParse(CARD).success).toBe(true);
    expect(PlayerCardSchema.safeParse({ ...CARD, display_name: "Real Name" }).success).toBe(false);
  });

  it("matches the keys every migration's realtime_player_card builds (M1's, and M2's with the real removed_until)", () => {
    const dir = new URL("../../web/supabase/migrations/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql") && readFileSync(new URL(f, dir), "utf8").includes("FUNCTION public.realtime_player_card("));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      const sql = readFileSync(new URL(file, dir), "utf8");
      const from = sql.indexOf("jsonb_build_object(", sql.indexOf("FUNCTION public.realtime_player_card("));
      const body = sql.slice(from, sql.indexOf("FROM profiles", from));
      const keys = [...body.matchAll(/^\s*'([a-z_0-9]+)',/gm)].map((m) => m[1]);
      expect(keys.sort(), file).toEqual([...CARD_FIELDS].sort());
    }
  });

  it("caches a card for 60 s per user", async () => {
    let t = 0;
    const source = vi.fn(async () => CARD);
    const load = createCardLoader({ source, now: () => t });
    await load(IDENTITY);
    t = 59_000;
    await load(IDENTITY);
    expect(source).toHaveBeenCalledTimes(1);
    t = 60_000;
    await load(IDENTITY);
    expect(source).toHaveBeenCalledTimes(2);
    await load({ uid: "22222222-2222-4222-8222-222222222222", dev: false });
    expect(source).toHaveBeenCalledTimes(3);
  });

  it("re-reads on refresh at most once per 10 s", async () => {
    let t = 0;
    const source = vi.fn(async () => CARD);
    const load = createCardLoader({ source, now: () => t });
    await load(IDENTITY);
    t = 9_999;
    await load(IDENTITY, { refresh: true });
    expect(source).toHaveBeenCalledTimes(1);
    t = 10_000;
    await load(IDENTITY, { refresh: true });
    expect(source).toHaveBeenCalledTimes(2);
    t = 12_000;
    await load(IDENTITY, { refresh: true });
    expect(source).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight read between simultaneous joins", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const source = vi.fn(async () => {
      await gate;
      return CARD;
    });
    const load = createCardLoader({ source });
    const both = Promise.all([load(IDENTITY), load(IDENTITY)]);
    release();
    await both;
    expect(source).toHaveBeenCalledTimes(1);
  });

  it("gives up after 3 s and aborts the request", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const load = createCardLoader({
        source: (_uid, signal) =>
          new Promise((resolve) => {
            signal.addEventListener("abort", () => (aborted = true));
            setTimeout(() => resolve(CARD), 10_000);
          }),
      });
      const p = reason(load(IDENTITY));
      await vi.advanceTimersByTimeAsync(2_999);
      expect(aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await p).toBe("timeout");
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a missing profile, a malformed card and a failing database distinctly", async () => {
    expect(await reason(createCardLoader({ source: async () => null })(IDENTITY))).toBe("no_profile");
    expect(await reason(createCardLoader({ source: async () => ({ ...CARD, tier: 9 }) })(IDENTITY))).toBe("invalid");
    expect(
      await reason(
        createCardLoader({
          source: async () => {
            throw new Error("fetch failed");
          },
        })(IDENTITY),
      ),
    ).toBe("unavailable");
  });

  it("gives dev tokens a synthetic card without touching the database", async () => {
    const source = vi.fn(async () => CARD);
    const load = createCardLoader({ source });
    const card = await load({ uid: devUid("bot-07"), dev: true, devName: "bot-07" });
    expect(source).not.toHaveBeenCalled();
    expect(PlayerCardSchema.safeParse(card).success).toBe(true);
    expect(card.name).toBe("bot-07");
    expect(card).toEqual(devCard({ uid: devUid("bot-07"), dev: true, devName: "bot-07" }));
  });
});

describe("authenticate: the join gate", () => {
  function services(card: Partial<PlayerCard> | null = {}, now = Date.parse("2026-10-03T12:00:00Z")): AuthServices {
    return {
      verify,
      loadCard: createCardLoader({ source: async () => (card === null ? null : { ...CARD, ...card }) }),
      origins: createOriginPolicy({ origins: DEFAULT_ALLOWED_ORIGINS, patterns: DEFAULT_ALLOWED_ORIGIN_PATTERNS }),
      now: () => now,
    };
  }

  it("lets a member in with their card", async () => {
    const r = await authenticate(services(), await keys.sign(), "https://play.tethos.ca");
    expect(r.identity.uid).toBe(MEMBER);
    expect(r.card.name).toBe("Maple");
  });

  it("refuses a bad origin before looking at the token", async () => {
    const s = services();
    const spy = vi.fn(s.verify);
    expect(await reason(authenticate({ ...s, verify: spy }, await keys.sign(), "https://evil.example"))).toBe("origin");
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses bad tokens as auth", async () => {
    expect(await reason(authenticate(services(), undefined, "https://play.tethos.ca"))).toBe("auth");
    expect(await reason(authenticate(services(), await keys.sign({ is_anonymous: true }), null))).toBe("auth");
  });

  it("refuses a member removed until the future, and lets them back once it has passed", async () => {
    const token = await keys.sign();
    expect(await reason(authenticate(services({ removed_until: "2026-10-10T00:00:00Z" }), token, null))).toBe("removed");
    expect(await reason(authenticate(services({ removed_until: "2026-10-01T00:00:00Z" }), token, null))).toBe("accepted");
  });

  it("treats a token without a profile as auth, and a slow database as a retryable card failure", async () => {
    const token = await keys.sign();
    expect(await reason(authenticate(services(null), token, null))).toBe("auth");
    const slow: AuthServices = { ...services(), loadCard: async () => Promise.reject(new CardError("timeout")) };
    expect(await reason(authenticate(slow, token, null))).toBe("card");
  });
});

describe("HTTP and WebSocket origin checks", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    const env = parseEnv({ NODE_ENV: "test", DEV_AUTH: "1" });
    colyseus = await boot(createApp({ env, verify }), PORT);
  });

  afterAll(async () => {
    await colyseus?.shutdown();
  });

  async function preflight(origin: string) {
    return fetch(`http://127.0.0.1:${PORT}/matchmake/joinOrCreate/island`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, content-type" },
    });
  }

  it("echoes an allowed origin and never allows credentials", async () => {
    const res = await preflight("https://play.tethos.ca");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://play.tethos.ca");
    expect(res.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("sends no Allow-Origin to another site, so the browser blocks it", async () => {
    const res = await preflight("https://evil.example");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const get = await fetch(`http://127.0.0.1:${PORT}/health`, { headers: { Origin: "https://evil.example" } });
    expect(get.headers.get("access-control-allow-origin")).toBeNull();
  });

  function upgrade(origin?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/proc/room?sessionId=x`, origin ? { headers: { Origin: origin } } : {});
      ws.on("unexpected-response", (_req, res) => {
        resolve(res.statusCode ?? 0);
        ws.terminate();
      });
      ws.on("upgrade", () => {
        resolve(101);
        ws.terminate();
      });
      ws.on("error", (e) => reject(e));
    });
  }

  it("refuses the WebSocket handshake from another site's page", async () => {
    expect(await upgrade("https://evil.example")).toBe(403);
    expect(await upgrade("https://www.tethos.ca.evil.example")).toBe(403);
  });

  it("completes the handshake for allowed pages and non-browser clients", async () => {
    expect(await upgrade("https://play.tethos.ca")).toBe(101);
    expect(await upgrade("http://localhost:3000")).toBe(101);
    expect(await upgrade()).toBe(101);
  });

  it("answers /health", async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, rooms: 0, clients: 0 });
  });
});
