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

- **Run 2 (2026-10-26, 20:40 to 20:55 Toronto, night), production main 2fe3e3b8 (the sushi bar, phase A), merged here:** evidence `specs/evidence/launch-check/run2/`.
  - **day: 47 of 49 passed.** Everything from run 1 again (presence Here (2), chat, friends, wave, dances, report, live mute and unmute, flow 4 with a river `fish_dace`, the shovel gate, Pim's grant, `rock_stone`).
  - **Sushi bar, all 11 passed:** both walk to the entrance (west beach, `(-47, 114.5)`), both offered "Enter the sushi bar", E pressed together seats both ("Leave the bar"), on different stools (3 and 2); each in turn stands with E at the exit, the camera back behind them, and sees the other seated, the tag over the counter at stool height (44% down the view, shots 33 and 35); A sits again and stands again.
  - **Fail 1, not a game fault:** no buried shell this hour (the six shell nodes gave coconuts, a whelk and scallops; run 1 dug `shell_asari`). The dig is the hour's roll.
  - **Fail 2, intermittent, not reproduced:** the bench. In the day run A stood 1.06 from fire-bench-0 with no prompt; in the first bench-only run E at fire-bench-1 cleared the prompt without seating A. Three later tries all sat and stood properly (prompt Sit on the bench, then Stand up, the avatar on the slot). Likely a resident holding the slots at the fire at night, but not proven.
  - Cleanup: 5 tables' set-null rows by id, the 3 users (200 each); verify 0 rows left (`run2/cleanup-proof.txt`).
  - New in the script: `bench` (a phase of its own too) and `sushiBar` steps; spots.ts gives the bar's entrance, exit, stools and the fire's benches with routes.

- **Run 3 done (2026-10-27, 04:45 to 05:45 Toronto, night), production main 5e599116, under the browser lock:** evidence `specs/evidence/launch-check/run3/`. Totals: identity 11 of 17 (first sitting), identity2 22 of 26, identity3 13 of 13, night 22 of 22, day 51 of 51, collide 24 of 24. Every fail was the test's and was fixed and rerun; no game fault found.
  - **Names and looks:** A, fresh, in the arrival's reflection: Yes with the name empty says "The island needs a name for you." and saves nothing (look and name both null in the database); another skin, hairstyle and hair colour, "Probe Alder" (free), Yes saves both in 3.4 s. B sees A's name and hair and skin (the card's look and the look the Character is drawn with) 10.6 to 15.7 s after the save, A on one socket; A's tag reads Probe Alder. D (a fourth account, see below) sets "Probe Rowan" and new hair in the shop's fitting room: saved, A by the shop's door sees both 10.6 s after D steps out (21.6 s after the save), tag too. C joins later and has A and D with names and looks within 1 s of its socket opening (its join came about 29 s after its page loaded: three headless pages on one machine).
  - **Wharf deck edge, 9 of 9:** deck-0 (north), deck-18 (middle), deck-32 (south): walk, sprint, sprint with a dash out across the edge over the sea: held 0.19 to 0.20 inside the drawn edge every time (the body's radius), never past it.
  - **Hitboxes, 10 of 10, plus the dance circle and the doors:** walk and sprint into the plaza fountain, plaza-bench-0, lamp-plaza-0's post, the shop's wall and the campfire's stone ring: stopped 0.19 to 0.20 outside what's drawn every time. The dance circle (2.9) walked to on four sides. Doors: "Enter the shop", "Enter HQ".
  - **Alice, 5 of 5:** the settle-in step reads "Report back to Alice at HQ" (the tracker during the visit: "Report to Alice at HQ"); HQ's door "Enter HQ"; inside, the front desk "Talk to Alice"; her tag "Alice"; the talk "Talking with Alice", "Alice · HQ lead", "There you are! Bram said you'd be up. I'm Alice."
  - **Hair shop, 6 of 6:** Baby sprout, Layered shag, Swept fringe, V-kei layers listed at 350 coins (GET /api/economy/shop); Wavy half-up not listed.
  - **The fails, all the test's:** (1) the first sitting hit its 590 s limit after the creator steps: the room walker in the shop had no position source and the plaza bench caught the route. (2) The shop has no multiplayer area (offline inside, by design: DefaultIslandWorld), so the wardrobe check now has A wait outside and measures from stepping out. (3) The script's device look had a cardigan a new account doesn't own: the save was refused (403 not_owned), so the looks are now the starter tee, shorts and slip-ons. (4) A world name changes once every 30 days (409 too_soon), and B's was set when B came in, so the wardrobe's name went to a fourth account D with no name yet (identity3, all passed). (5) The fountain's walk ran into lamp-fountain-0's post in its lane (rightly solid): lanes are now checked clear. (6) One collide attempt's first key went unheard (calibration read 0): calibration now retries.
  - **Script (run 3):** a React devtools hook in each page (`probe`) reads the player's position (outdoors and in rooms) and the other players' cards and drawn looks, with no dev hooks; `go` routes between any two places over the spawn's walk tree (spots.ts writes it; half a unit clear of props); rooms walk their own floor paths (spots.ts `rooms`); phases `identity` (needs a fresh A), `identity2`, `identity3`, `collide`, `joinlag`; `cleanup.mjs` takes the fourth account.
  - **Cleanup:** 5 tables' set-null rows by id, A's mute cleared, the 4 users deleted (200 each); verify: 162 columns plus auth.users and profiles hold 0 rows for the four ids, 0 recorded rows left (`run3/cleanup-proof.txt`).

## Run 3 (2026-10-27, night): production main 5e599116 (names, looks, collision, Alice, the hair shop)

The coordinator merged and deployed David's production fixes. Run the two-account check again on play.tethos.ca, with the third account where it's needed. Same script, same throwaway accounts, the same cleanup with proof by counts (keys never printed or logged), under the browser lock. Add steps for:

1. **Names and looks** (net-identity, `specs/lanes/net-identity.md`; its harness `realtime/scripts/cardHarness.ts` and `specs/evidence/net-identity/shoot.mjs` show the flow):
   - A makes a character in the first creator with a non-default look (hairstyle, hair colour and skin) and a world name. Confirming with the name field empty must say "The island needs a name for you." and not save.
   - B must see A's world name on A's tag, and A's hair and skin, within about 15 s without rejoining. Check the remote's look through the dev hook if it's there; in production, compare screenshots and the name tag.
   - B changes name and look in the wardrobe (its new name field); A sees both within about 15 s.
   - C joins later and sees both at join.
2. **The wharf deck's edge:** walk and sprint at three deck edges over the sea; you stop at the edge and never drop into the water.
3. **Hitboxes:** run into the plaza fountain, a plaza bench, a lamp post and a plaza building's wall; you're stopped at what's drawn. A building's door prompt still shows. The campfire stops you at its stone ring, and the dance circle round it stays open.
4. **Alice:** the HQ resident's name tag and dialogue say Alice. The settle-in chapter's step reads "Report back to Alice at HQ".
5. **Hair shop:** Baby sprout, Layered shag, Swept fringe and V-kei layers are on sale at 350 coins; Wavy half-up isn't sold.

Everything from runs 1 and 2 stays in the script; run it all. Evidence in `specs/evidence/launch-check/run3/`. Report the counts per phase, every fail with its reason, and the cleanup proof.

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
