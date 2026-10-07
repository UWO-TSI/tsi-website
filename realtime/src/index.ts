// Entry point: `npm run dev` (tsx watch) and `node dist/index.mjs` (Docker, Fly).
// @colyseus/tools loads `.env.<NODE_ENV>` / `.env` when imported, before getEnv() reads them.
import { listen } from "@colyseus/tools";
import { createApp } from "./app.config";
import { getEnv } from "./env";

const env = getEnv();
if (env.production && !env.internalSecret) {
  console.warn("REALTIME_INTERNAL_SECRET is not set: admin mutes, removals and blocks reach the island only through the 60 s poll and the next join");
}
await listen(createApp({ env }), env.port);
console.log(`realtime listening on :${env.port} (${env.nodeEnv}${env.devAuth ? ", DEV_AUTH" : ""})`);
