# Lane: launch-check (the new world on production: tests and the two-account check)

Worktree `.claude/worktrees/launch-check`, branch `game/launch-check`, cut from main at 167ec19c. Agent type `uwotsi-lane`.

**Context (2026-10-26 evening):** David asked for the current version on play.tethos.ca so he can test multiplayer from another computer, and asked the coordinator to "make sure to get it working". Production now builds with `NEXT_PUBLIC_GAME_WORLD=new` and `NEXT_PUBLIC_MEMBER_WORLD=open`. The deploy of 167ec19c is running; the coordinator tells you when it's live. The realtime server (Fly `tethos-rt`, v7) is unchanged; no protocol changes.

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

## Rules

- **Secrets:** `web/.env.local` here is a local copy of the coordinator's and is gitignored. Never print, log, commit or write out any key, token or password. Passwords are random per run and held in memory, as the script already does.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP or the claude-in-chrome tools. Headless Chromium, muted, under the browser lock. Never port 3000.
- **Production data:** only the throwaway test accounts and their own rows, all cleaned up in the same session with proof. Never touch real members' data. Never run destructive SQL beyond deleting the test's own rows, by id.
- **Locks:** `LANE=game/launch-check /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>` for vitest and tsc. The browser lock: see `specs/lane-rules.md`.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Work only in this worktree.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere.
