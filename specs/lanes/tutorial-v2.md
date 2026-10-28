# Lane: tutorial-v2 (the first ten minutes)

Worktree `.claude/worktrees/tutorial-v2`, branch `game/tutorial-v2`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **t-short, t-catch, t-sell, t-hq** in `specs/launch/v1-gameplay.md`.

1. **The guide arrow first:** a faint arrow (on screen or at the feet) that points to a world target. It's shared: Bram when he's far now, quests later. Build it as one small component with an API other lanes can call. Commit it on its own and message the coordinator with the SHA.
2. **The new tour order:**
   - HQ first: sign in with Alice. Rework the HQ onboarding per t-hq: a lore overlay, a visual UI tour (what to press and hold), the QR check-in, earning from TSI events, currencies for real merch, the mailbox, the chat and every button. Store its progress on the account, not the device.
   - Then Bram waits outside and shows the other places in the camera conversation mode (one E press per building: museum, café, shop). He walks faster when you're close, and the arrow points to him when he's far.
   - Down the dock, he walks past the shipwright and the tackle shop with short pauses and no interaction, then stops at the fishing barrel and asks you to sell.
3. **The first catch** (t-catch): the reel pauses to teach "hold space or the mouse to keep it in the bar", and the first catch is always a fish.
4. **The tracker** after the tour points at the main quest's first step. Lane `main-quest` owns the tracker UI; use its hook once it lands, and until then keep the existing one.

**Where:**
- `web/lib/game/arrival/` (sequence, tutorial, lines, routes, `hq/`);
- `web/components/game/arrival/`, `web/components/game/hq/useHqOnboarding.ts`, `specs/hq-onboarding.md`;
- the reel: `web/lib/game/fishingReel.ts` and `FishingOverlay.tsx`;
- the sell barrel.

Keep the arrival's approved character screen (the reflection waves) as it is.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Round 3: David's v2 review (2026-10-27, verbatim)

1. arrow (approved): "make arrow smaller slightly closer to you"
2. hq-first (approved): "dock should teach jump over box, and dash as well"
3. sights (approved): "the camera pan is a lot better, the explanation needs rewriting,"
4. barrel (approved): "after sell bram congratulates and gives you his rod and it shows quest comlpete check mark animation and have a cut scene where bram gives you the rod and then show the from bram ui and animation of it moving into your bag"
5. wharf (redo): "do the camera pan for the rod store and boat, then walk to edge, fish do fish tutorial and sell fish, the camera pan same way as the building tutorial earlier"
6. catch (redo): "looks good and like i think its time we update the ui for fishing to look nicer and also do ! with sound effect when fish hooked, and add small micro animation and juice to make it more dopamine while keeping the aestetic, and redo the fishing bar a little bit to make it look nicer" (the fishing UI goes to the fish-tiers lane; keep the tutorial's catch beat working)
7. club (redo): "they she explains more about the the currency how coins are traded for in game stuff, gems can be traded for rare items AND real merch, that will be shipped to you. the animation should be the coin icon pops in screen and screen darkens a lil and the coin moves to the coin slot and same with gems so user is engaged while learning what its for, same for things like menu, mailbox, and minimap"
8. lore (redo): "better, the thing is this should introduce the lore more rather than introduce tsi, beaucese outside ppl that might ont know tsi and came here purely for the game might play and it should make sense and not take away from the experience. weave tethos in the game, so alice explains that tethos island was found by David, and like he set up the island to invite everyone and all ppl to come hangout play etc, mention that tethos hosts genesis and in person events and you get limited awards and experience from it, but in a way where it doesnt confuse or take away the feel of the game from non tsi ppl. the register should be more animation and cooler rather than just a overlay, like say this is you making your id, alice asks you for your info, like bday and stuff and she prints and stamps your id and it shows on screen and you can edit or done" (in game the founder is "the Founder" until David says otherwise; existing profile fields only)
9. tour (redo): "this is a very low effort ui tour, i want you to make 2d model of the qwerty keyboard and use it as overlay, have people click the button, teach things that are not learned, like hold tab for wheel hold g to emote enter to chat, i for inv, m for map esc for ui etc. and user has to actually follow along instead of pressing next"
10. farewell (redo): "mention that theres stuff in the hq they can look around that shows past project, job board etc."
11. phone (redo): "I want you to only make the phone changes after tutorial section is done entirely" (hold the phone changes until the rest is approved)

## Status

All four items are built and run end to end headless on the new world. The evidence is shot: `specs/evidence/tutorial-v2/v2/01..11`. Waiting on David's review. The coordinator took the defaults on the four open notes (selling, the cut beats, the HQ door, drafts).

- **The guide arrow (shared), merged into main-quest at 203f8603.** `web/lib/game/guideArrow.ts` holds the API (tested). `web/components/game/GuideArrow.tsx` draws a faint chevron a step ahead of your feet: one mesh, in `IslandScene`, so outdoors only.
  - `const clear = showGuide(owner, { x, z } | () => XZ | null, { near })`. The newest guide wins; clearing it brings back the one under it. Also `clearGuide(owner)` and `guideNow()`. Dev hook: `window.__guide`.
  - Bram uses owner `bram` (shows from 7 m). main-quest uses owner `quest`.
- **t-short and t-sell: the new world's walk** (`lib/game/arrival/routes/new.ts`, data only). The village keeps today's walk.
  - The order:
    1. The dock and the crate, as before.
    2. Bram walks you to HQ's door and waits (stop `hqFirst`, task `hq`). Alice's visit runs inside, and he moves on when it's done and you're back out.
    3. One E opens the camera conversation (stop `sights`). He points out the museum, the café and the shop, one line and one building shot each (`shots`).
    4. Down the wharf, he pauses by the shipwright and the tackle shop, a passing line each (waypoints `pause`, `face`, `say`).
    5. His rod and a first catch off the quay (stop `wharf`; its stand is out of the sell barrel's E range).
    6. Open the sell barrel (stop `barrel`, task `sell`), then the end line and the reward.
  - New route data: `talk: "box"` (Bram's talks go in the TalkBox), `end` (`END_LINES.free`), prop places, passing waypoints, and the `hq` and `sell` tasks.
  - The tutorial events `talkEnded`, `hqDone` and `sellOpened`.
  - The camera conversation lives in `converseCamera` in `ArrivalWorld.tsx`: the residents' two-shot (`steerTalkShot`), then a blended cut to a building shot, then the camera is put back. You turn to face Bram (`tsi:face`).
  - Bram walks brisker with you on his heels (`bramPace`).
- **t-hq: Alice's visit reworked** (`lib/game/arrival/hq/script.ts`, `lines.ts`, `uiTour.ts`; the components `HqCards.tsx` LoreOverlay and MerchCard, and `UiTour.tsx`). Applies on both worlds.
  - The beats: report, lore overlay, register, club (events earn coins, gems and XP; the check-in QR), merch card, UI tour (press and hold keycaps, a ring around HUD parts), Esc, farewell.
  - The farewell has two versions: `farewell` (the village order) and `farewellTour` (Bram waiting outside). Both keep main-quest's Juno line.
  - The founder, map and board beats are cut. The desk and the board still work on E.
  - Progress is on the account: `profiles.preferences.onboarding` through `GET/POST /api/world/onboarding` (`accountProgress.ts`). It merges with the device copy `tsi.hq.v2`, the further along wins, and it pays nothing. Coordinator approved (d).
- **t-catch, both worlds.** The walk-along's catch shows a teaching card on the first reel (`REEL_TEACH`, the keys drawn held). The reel waits for a fresh hold, the bite window is longer, and a progress floor means the fish can't get away (`createFishingReel(fish, floor)`). Every catch is already a fish: no junk exists.
- Gates: full vitest passes with and without `NEXT_PUBLIC_GAME_WORLD=new` (3498 tests); tsc and eslint pass on the changed files.

## Next

1. Act on David's review notes, once the coordinator relays them.
2. Known and not fixed: the arrow is a ground decal, so tall props in its spot (a fountain's rim) can hide part of it. The evidence's 01 shows this by the plaza fountain.
3. The final batch's part b stopped at the barrel conversation (a talk-box wait timed out). Sheet 10 (the barrel and the end) is from the earlier part b run, on the same code for that stretch.

## Tools and gotchas

- `specs/evidence/tutorial-v2/shoot.mjs` scenes: `first10` (part a, about 7 min), `first10b` (part b: the HQ visit is pre-done through `tsi.hq.v2`, about 5 min), `hq-phone` (`?hq=inside&hqvisit=1`, touch), and `arrow`.
  - Run each as its own foreground call: `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/shoot.mjs <out> <scene>`.
  - Dev server: `NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172`, under the devserver lock. Keep the hold short: the coordinator asked, because swap runs at 13 GB.
- HQ room coordinates (lib/game/hqLayout.ts): the desk station is (4.6, -7.5) and the exit is (0, -8.2). Walk there with `tsi:interior-move`.
- The sell barrel's E ("sell") outranks fishing within 2.2 m. The cast stand has to stay outside that (routes.test checks it).
- `stage()` waits miss instant stages: a pre-done HQ task passes in a frame.
- A browser with no saved look shows the plain creator first (click Skip).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/tutorial-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
