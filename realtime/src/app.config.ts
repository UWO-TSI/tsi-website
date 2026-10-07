// The Colyseus app: rooms, HTTP routes and the transport (specs/multiplayer.md §1.1).
// createApp() takes its services as arguments so tests can boot it with a local
// JWKS and an in-memory card loader instead of Supabase.
import config, { type ConfigOptions } from "@colyseus/tools";
import { createEndpoint, createRouter, defineRoom, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MAX_PAYLOAD_BYTES, RECONNECT_GRACE_S, ROOM_NAME } from "@net/protocol";
import type { AuthServices } from "./auth/authenticate";
import { CardError, createCardLoader, supabaseCardSource } from "./auth/card";
import { BASE_CORS_HEADERS, corsHeaders, createOriginPolicy } from "./auth/origin";
import { createVerifier } from "./auth/verify";
import { getEnv, type Env } from "./env";
import { internalEndpoints } from "./internal";
import { createIslandRoom, type IslandRoomOptions } from "./rooms/IslandRoom";
import { offlineWorldSources, supabaseWorldSources } from "./sources";
import { createWorld, type World } from "./world";

export type AppServices = AuthServices;
export type AppOptions = Partial<AppServices> &
  Partial<Pick<IslandRoomOptions, "kickForMovement" | "graceS" | "log">> & {
    env?: Env;
    /** The rooms' shared chat log, blocks and sanctions (tests pass one with in-memory sources; theirs to start). */
    world?: World;
  };

/** One JSON line per event on stdout (Fly keeps them in `fly logs`). Never tokens, emails or real names. */
export function logLine(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}

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

/** The world from the environment: Supabase when it's configured, else nothing logged, blocked or sanctioned. */
export function createWorldFromEnv(env: Env, log: (event: string, fields: Record<string, unknown>) => void): World {
  const sources = env.supabaseUrl && env.supabaseSecretKey ? supabaseWorldSources(env.supabaseUrl, env.supabaseSecretKey) : offlineWorldSources;
  return createWorld({ ...sources, log });
}

export function createApp(options: AppOptions = {}): ConfigOptions {
  const { env: envOverride, kickForMovement, graceS, log, world: given, ...overrides } = options;
  const env = envOverride ?? getEnv();
  const logFn = log ?? logLine;
  const services = createServices(env, overrides);
  const world = given ?? createWorldFromEnv(env, logFn);
  if (!given) world.start();
  // A sanction's latest word outranks a card cached before it (M2: a removed player can't rejoin on an old card).
  const loadCard = services.loadCard;
  services.loadCard = async (identity, opts) => world.overlayCard(identity.uid, await loadCard(identity, opts));
  const IslandRoom = createIslandRoom({
    services,
    world,
    kickForMovement: kickForMovement ?? env.production,
    graceS: graceS ?? RECONNECT_GRACE_S,
    log: logFn,
  });
  const internal = internalEndpoints({ world, secret: env.internalSecret, log: logFn });

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
    // §3: joinOrCreate fills the fullest open shard.
    rooms: { [ROOM_NAME]: defineRoom(IslandRoom).sortBy({ clients: -1 }) },
    routes: createRouter({ health, sanction: internal.sanction, block: internal.block }),
    // Last chat lines to the log before the process exits.
    initializeGameServer: (server) => server.onShutdown(() => world.stop()),
    initializeTransport: (opts) =>
      new WebSocketTransport({
        ...opts,
        // §1.4: pose packets are ~40 bytes; nothing a client sends needs more than 4 KB.
        maxPayload: MAX_PAYLOAD_BYTES,
        // Browsers don't apply CORS to WebSockets: refuse other sites' pages at the handshake.
        beforeUpgrade: (_request, context) =>
          services.origins.allows(context.headers.get("origin")) ? undefined : new Response(null, { status: 403 }),
      }),
  });
}
