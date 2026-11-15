# Lane: load-test (capacity for the December 20 public opening)

Worktree `.claude/worktrees/load-test`, branch `game/load-test`, cut from `feat/game-default-island` at the commit that adds this file. Agent type `uwotsi-lane`. Dev ports 3488 (web) and 2588 (realtime).

## Why

The game opens to the public worldwide on December 20, 2026 (`specs/launch/preregistration.md`; blockers in `specs/launch/blockers-dec20.md` §3). A shard holds 30 players. The plan is 500 players at once, tested to 1,000. Nobody knows what happens at 300.

## What exists (start here, don't rebuild)

- `realtime/` (Colyseus, Fly app `tethos-rt`, region yyz):
  - `src/app.config.ts` (`joinOrCreate` fills the fullest open shard, about line 102);
  - `src/rooms/{IslandRoom,limits,chat,state}.ts`;
  - `src/world.ts` (presence, friends, follow);
  - `scripts/bots.ts` (a bot client already);
  - `test/soak.ts`.
- `realtime/fly.toml`:
  - one machine, `auto_stop_machines = "off"`, `min_machines_running = 1`;
  - connection soft limit 300, hard limit 400;
  - its comment says "One stateful process holds every room".
- The web side a player hits: `web/lib/net/` (the protocol), `web/app/api/world/*`, and the progression, economy and fishing API routes a session calls.

## Build

1. **The bot.** Extend `realtime/scripts/bots.ts` into a headless player:
   - it joins a shard, walks, fishes and chats a little;
   - it makes the API calls a real session makes, at a real player's rate;
   - no rendering.
2. **Phase 1, local:**
   - Run the realtime server locally (port 2588) and the web app locally against the staging Supabase (`jjiyeroyralfbluowbjq`; keys in the keychain, never printed), or the in-memory services where the API needs no database.
   - Ramp 30, 100, 300 and 1,000 bots. For each step record:
     - join time (p50, p95);
     - server tick time (p50, p95, max) and event-loop lag;
     - memory and CPU of the realtime process;
     - messages per second;
     - API p95 and error rate;
     - Supabase connection count and slow queries (staging dashboard or `pg_stat_activity`).
   - Watch the Mac mini: stop the ramp if swap grows past 30 GB or wired memory passes 6 GB (it has crashed at 8 GB).
3. **Shards and friends:**
   - Confirm a new shard opens when one fills.
   - Confirm a friend and a party member can land in the same shard as their friend (follow, parties).
   - Confirm what happens when the one machine is full.
4. **The polite failure:** an "the island is full, trying again in a minute" screen for overload (flat kit only: rows 334 and 335, `specs/design-bible.md` UI), with an automatic retry, instead of a broken join.
5. **The capacity plan** (`specs/launch/capacity.md`):
   - the measured per-process cap;
   - what one Fly machine of the current size holds;
   - what 500 and 1,000 need;
   - whether the one-process design scales to more than one machine, and if not, the smallest change that lets shards spread over machines (for example, a machine per group of shards with Fly's replay routing);
   - Supabase pool and compute against 1,000;
   - Vercel plan limits for a spike on the title page and API routes.
   - Each sizing change gets a monthly cost line. Money is David's call: propose, don't buy.
6. **Phase 2, a real Fly run (needs David's OK, the coordinator asks):**
   - The plan for a temporary copy of `tethos-rt` on Fly (same machine size, a new app name), driven from the Mac mini, then destroyed: the commands and the cost estimate.
   - Don't create it. The coordinator runs it once David says yes.

## Rules

- Never touch production: not the `tethos-rt` app, not prod Supabase, not play.tethos.ca. Staging and local only.
- No secrets in the repo or the output.
- Headless only.
- Use the heavy lock for big ramps (`LANE=game/load-test /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`).
- Kill only the processes you started.
- Ports: never 3000, 3300, 3301 or 3390.

## Evidence and gates

- **Evidence:**
  - `specs/evidence/load-test/` holds the results table (CSV and a chart per metric across the ramp);
  - the "island is full" screen, desktop and phone, before and after;
  - the bot's run log.
- **Gates:**
  - tsc in `web/` and `realtime/`;
  - vitest in `web/` (new world, once) and in `realtime/`;
  - lint on touched files.

## Status

- Not started.

## Next

1. Read this file, `specs/launch/blockers-dec20.md` §3, `realtime/README.md`, then `CODEMAP.md`'s multiplayer rows.
2. Build steps 1 to 5 and write up phase 2.
3. Update this file, commit and report: the table, the cap, the plan, the cost lines, the phase 2 commands, and your questions.
