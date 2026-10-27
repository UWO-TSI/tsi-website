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

## Status

All four items are built and run end to end headless on the new world. Not yet reviewed by David. The final evidence batch is still to shoot (Next).

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

1. Shoot the evidence batch in one short devserver hold, with the dev server on 3172 and `NEXT_PUBLIC_GAME_WORLD=new` (see Tools): `first10` (part a: the HQ visit and the sights), `first10b` (part b: the wharf, the catch, the barrel) and `hq-phone`. Make webp sheets in `specs/evidence/tutorial-v2/v2/`.
2. Report to the coordinator for David's review page.
3. Open for David:
   - Bram explains selling but doesn't make you sell the first fish (m1 donates it). The task is only to open the barrel.
   - Every line is a draft.
   - The cut HQ beats (founder, map, board).
   - During any arrival, HQ's door is always "enter".

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
