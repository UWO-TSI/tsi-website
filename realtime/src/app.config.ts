// The Colyseus app: rooms, HTTP routes and the transport (specs/multiplayer.md §1.1).
// createApp() takes its services as arguments so tests can boot it with a local
// JWKS and an in-memory card loader instead of Supabase.
import config, { type ConfigOptions } from "@colyseus/tools";
import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import type { AuthServices } from "./auth/authenticate";
import { CardError, createCardLoader, supabaseCardSource } from "./auth/card";
import { BASE_CORS_HEADERS, corsHeaders, createOriginPolicy } from "./auth/origin";
import { createVerifier } from "./auth/verify";
import { getEnv, type Env } from "./env";

export type AppServices = AuthServices;
export type AppOptions = Partial<AppServices> & { env?: Env };

/** GET /health: Fly's check. 503 while draining for a restart. */
export const health = createEndpoint("/health", { method: "GET" }, async () => {
  const draining = matchMaker.state === matchMaker.MatchMakerState.SHUTTING_DOWN;
  return Response.json(
    {
      ok: !draining,
      uptime: Math.round(process.uptime()),
      rooms: matchMaker.stats.local.roomCount,
      clients: matchMaker.stats.local.ccu,
    },
    { status: draining ? 503 : 200, headers: { "cache-control": "no-store" } },
  );
});

/** The production services, built from the environment; any of them can be replaced. */
export function createServices(env: Env, overrides: Partial<AppServices> = {}): AppServices {
  const source =
    env.supabaseUrl && env.supabaseSecretKey
      ? supabaseCardSource(env.supabaseUrl, env.supabaseSecretKey)
      : async () => {
          throw new CardError("unavailable", "SUPABASE_URL / SUPABASE_SECRET_KEY not set");
        };
  return {
    origins:
      overrides.origins ?? createOriginPolicy({ origins: env.allowedOrigins, patterns: env.allowedOriginPatterns }),
    verify:
      overrides.verify ??
      createVerifier({ supabaseUrl: env.supabaseUrl, devAuth: env.devAuth, production: env.production }),
    loadCard: overrides.loadCard ?? createCardLoader({ source }),
    now: overrides.now,
  };
}

export function createApp(options: AppOptions = {}): ConfigOptions {
  const { env: envOverride, ...overrides } = options;
  const env = envOverride ?? getEnv();
  const services = createServices(env, overrides);

  // §1.4: echo only allowed origins; never allow credentials (auth is a bearer token).
  // The controller is process-wide: the last app created owns it.
  (matchMaker.controller as { DEFAULT_CORS_HEADERS: Record<string, string> }).DEFAULT_CORS_HEADERS = {
    ...BASE_CORS_HEADERS,
  };
  matchMaker.controller.getCorsHeaders = (headers: Headers) => corsHeaders(services.origins, headers.get("origin"));

  return config({
    // @colyseus/tools prints a banner and a line per listen; keep stdout to our own logs in production.
    displayLogs: !env.production,
    options: { greet: false },
    rooms: {},
    routes: createRouter({ health }),
    initializeTransport: (opts) =>
      new WebSocketTransport({
        ...opts,
        // §1.4: pose packets are ~40 bytes; nothing a client sends needs more than 4 KB.
        maxPayload: 4096,
        // Browsers don't apply CORS to WebSockets: refuse other sites' pages at the handshake.
        beforeUpgrade: (_request, context) =>
          services.origins.allows(context.headers.get("origin")) ? undefined : new Response(null, { status: 403 }),
      }),
  });
}
