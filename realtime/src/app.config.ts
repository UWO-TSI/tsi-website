// The Colyseus app: rooms, HTTP routes and the transport (specs/multiplayer.md §1.1).
// createApp() takes its services as arguments so tests can boot it with a local
// JWKS and an in-memory card loader instead of Supabase.
import config, { type ConfigOptions } from "@colyseus/tools";
import { createEndpoint, createRouter, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { getEnv, type Env } from "./env";

export type AppOptions = {
  env?: Env;
};

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

export function createApp(options: AppOptions = {}): ConfigOptions {
  const env = options.env ?? getEnv();

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
      }),
  });
}
