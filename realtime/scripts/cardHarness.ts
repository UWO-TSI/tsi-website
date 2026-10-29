// Local realtime for the net-identity check: dev tokens, but cards behave as in production (createCardLoader: 60 s
// cache, refresh re-reads at most every 10 s) over a JSON file the browser test writes (what /api/profile and
// /api/identity/name would have saved). Run: cd realtime && CARDS=<file> PORT=2600 npx tsx scripts/cardHarness.ts (specs/evidence/net-identity/shoot.mjs drives it)
import { readFileSync } from "node:fs";
import { listen } from "@colyseus/tools";
import { createApp } from "../src/app.config";
import { createCardLoader, devCard } from "../src/auth/card";
import { parseEnv } from "../src/env";

const CARDS = process.env.CARDS!;
const names = new Map<string, string>();
const inner = createCardLoader({
  source: async (uid) => {
    const name = names.get(uid)!;
    let saved: Record<string, unknown> = {};
    try { saved = JSON.parse(readFileSync(CARDS, "utf8"))[name] ?? {}; } catch { /* nothing saved yet */ }
    console.log(`card read ${name} ${new Date().toISOString()} ${JSON.stringify(saved).slice(0, 80)}`);
    return { ...devCard({ uid, dev: true, devName: name } as never), ...saved };
  },
});
const env = parseEnv({ NODE_ENV: "development", DEV_AUTH: "1", PORT: process.env.PORT ?? "2600" });
await listen(createApp({
  env,
  loadCard: async (identity, opts) => {
    names.set(identity.uid, identity.devName ?? "Dev");
    return inner({ ...identity, dev: false }, opts);
  },
}), env.port);
console.log(`harness on :${env.port}`);
