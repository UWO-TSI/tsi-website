# Lane: launch-check (the new world on production: tests and the two-account check)

Worktree `.claude/worktrees/launch-check`, branch `game/launch-check`, cut from main at 167ec19c. Agent type `uwotsi-lane`.

**Context (2026-10-26 evening):** David asked for the current version on play.tethos.ca so he can test multiplayer from another computer, and asked the coordinator to "make sure to get it working". Production now builds with `NEXT_PUBLIC_GAME_WORLD=new` and `NEXT_PUBLIC_MEMBER_WORLD=open`. The deploy of 167ec19c is running; the coordinator tells you when it's live. The realtime server (Fly `tethos-rt`, v7) is unchanged; no protocol changes.

## Status

- **Steps 1 and 2 done (2026-10-26 evening), head after `e54d2121`:**
  - `web/app/api/collections/route.test.ts` takes its shore, inland and node spots from the active world (`activeVillage()`, as the server does) and checks the world has rocks, shells, mushrooms and bug spots. Green with and without `NEXT_PUBLIC_GAME_WORLD=new`; the full suite too (3433 passed both ways), tsc and eslint clean.
  - **Game fix (the coordinator's call):** the new world had no rock or shell objects, so the shovel had nothing to strike or dig and its teaching quest (Pim, "dig up one buried thing") couldn't finish. `generate.ts` `gatherSpots` now places 5 rocks (`rock-a/b/c`, the village's models, so VillageLife draws its outcrop at each node) at the path's bend, the village's north and west edges, the river's near bank and the beach's back, and 6 shell dig spots on the beach's dry sand; ids `gather-rock-N`, `gather-shell-N`. Defaults David can move in the editor. The world was regenerated: only `world.json` changed (a fresh generation reproduced the committed world byte for byte first, so no sculpting was lost); `cells.json` unchanged. Fruit (18) and bug spots (22) were already there.
  - The river and the bottles were fixed by world-fixes (37731921), merged in 1877dcb5, which is what production ran.
  - `specs/evidence/launch-check/two-account.mjs` (from launch-v1's): `BASE` defaults to `https://play.tethos.ca` (tethos.ca redirects to www and doesn't serve the game), `SHARE` optional, the cast spot, the fire and a walking route to it from `spots.ts` (the active world, judged as the server does: cast `[58, 100]` river, fire `(14, 104)`, spawn `(68, 46)`); the walk follows the route and calibrates W and D once. Everything it checked before is kept.
  - `cleanup.mjs` (copied) also collects rows from every user foreign key that a delete only sets to NULL, read from the catalog (5 tables added since Oct 22).

- **Step 3 done (2026-10-26, 19:33 to 19:45 Toronto), production play.tethos.ca at main 1877dcb5, realtime tethos-rt v7, under the browser lock:**
  - **day: 35 of 36 passed.** Tags, chat and bubbles both ways (about 1.1 to 1.2 s), friend code ask and accept (`/internal/friend` applied), Here in friends, wave, both dances, report, remove and mute (`/internal/sanction` applied), A refused 1.2 s after the mute, B never got it, unmute, line through again; flow 4 (Bram's coins once, a river catch `fish_angelfish` from the river's east bank, donate, report to Wren, 100 coins once, a second report refused, the letter); the shovel (refused before Pim, granted, `rock_stone` struck at rock-0, `shell_asari` dug at shell-0). The one fail: the menu said Here (3), not Here (2): a real player ("Islander") was on the island. Not a game fault; the check now accepts 2 or more.
  - **night: 22 of 22 passed** (second attempt). Night phase, both walk the route to the fire, the stomp both ways, report, mute (in the database too), refused, unmute, block (`/internal/block` applied) both ways, A's tag still shows. The first attempt (`results-night-1.txt`, 13 of 15) failed the report with 404 "That line isn't on record yet": B reported 1.2 s after the line, and the realtime server writes the chat log every 2 s. Designed behaviour (the message says try again); the test now waits 3 s, and a rerun starts by unblocking.
  - No join refused or dropped (0 socket closes), no page errors.
  - **Script fixes:** production's auth cookie is `sb-tethos-auth` on `.tethos.ca` (`web/lib/supabase/cookie.ts`), so the script signs in under that name; the cleanup scan's auth.users and profiles rows had no column names and were dropped from the counts (fixed: aliased).
  - **Cleanup:** 5 tables' set-null rows deleted by id, A's mute cleared, the 3 users deleted (200 each); verify: 162 columns plus auth.users and profiles hold 0 rows for the three ids, 0 recorded rows left (`specs/evidence/launch-check/cleanup-proof.txt`).

## Next

1. **Fix `web/app/api/collections/route.test.ts` for the new world.** With `NEXT_PUBLIC_GAME_WORLD=new`, 21 tests fail with 422, because they cast at village coordinates. The server rightly refuses a spot that isn't water in the active world.
   - Make the test take its spots from the active world, the same way the server checks them, so it passes with and without the switch.
   - Don't weaken what it checks.
   - If the 422 shows a real server problem in the new world (for example, a valid new-world water spot refused), fix that instead and say so.
2. **Adapt the two-account test** (`specs/evidence/launch-v1/two-account.mjs`, its lane notes in `specs/lanes/launch-v1.md`) to the new world and to production.
   - Take the wharf or river cast spot for flow 4 and the campfire's position from the active world's data, not the village's hard-coded numbers.
   - Point it at production (`https://tethos.ca` or `https://play.tethos.ca`, whichever serves the member world); production has no share token.
   - Keep everything it already checks.
3. **When the coordinator says the deploy is live,** run it against production with three throwaway accounts, exactly as the Oct 22 run did:
   - `setup`, then `day`;
   - `night` too, if it's after real nightfall in Toronto (the campfire lights at night);
   - then the cleanup (`specs/evidence/launch-v1/cleanup.mjs`), with proof by counts that every test row and account is gone.

   Keep the account ids file outside the repo, in your session scratchpad. Shots and results go under `specs/evidence/launch-check/`.
4. **If a step fails because of the game,** not the test: find the cause, fix it on this branch if it's small and clear, with a test, and report it. For anything bigger, report it and stop.
5. **Report:** commit, update Status here, and SendMessage "main" with the pass and fail list, the fixes, and the cleanup proof. Then stop.

## Tools and gotchas

- Spots: `cd web && NEXT_PUBLIC_GAME_WORLD=new npx vite-node -c vitest.config.ts ../specs/evidence/launch-check/spots.ts` (the script runs it itself).
- Regenerate the world: `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts` (tsx fails on its top-level await). Paint is final only after the paint pass in `generateWorld`: anything that reads `paintAt` goes after it.
- Run: `IDS=<scratchpad>/ids-launch-check.json OUT=specs/evidence/launch-check node specs/evidence/launch-check/two-account.mjs setup|day|night`, then `cleanup.mjs scan|collect|delete|verify`.

## Rules

- **Secrets:** `web/.env.local` here is a local copy of the coordinator's and is gitignored. Never print, log, commit or write out any key, token or password. Passwords are random per run and held in memory, as the script already does.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP or the claude-in-chrome tools. Headless Chromium, muted, under the browser lock. Never port 3000.
- **Production data:** only the throwaway test accounts and their own rows, all cleaned up in the same session with proof. Never touch real members' data. Never run destructive SQL beyond deleting the test's own rows, by id.
- **Locks:** `LANE=game/launch-check /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest and tsc. The browser lock: see `specs/lane-rules.md`.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Work only in this worktree.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere.
