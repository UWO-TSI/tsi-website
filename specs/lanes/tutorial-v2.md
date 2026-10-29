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

Round 3 (David's v2 review) built on the new world and shot headless: `specs/evidence/tutorial-v2/v3/` (a-* the dock and Alice's visit, b-* the sights to the hand-over, k-* the kit pieces on /lab/gui, `-strip` for the animated beats). Waiting on David's review. Round 2's status is in git history (fb5991d9).

- **arrow:** smaller (0.85) and nearer your feet (1.15 m ahead), `GuideArrow.tsx`.
- **dock (hq-first):** the new world's own dock stop in `routes/new.ts` (no longer borrowed from the village): Bram's talk teaches the box hop (`{jump}`), then an `auto` stop (no E) teaches the dash: `unlockMove("dash")` (a no-op when dash is already open; daily-social may open dash for all) and a `dash` task waiting for `tsi:dash` (PlayerAvatar announces a dash). While the box or the dash is the task, its key stays up in a chip (`Arrival.tsx` `teach`). The box is the route's tutorial-only crate.
- **sights:** the pan kept, the lines rewritten short in Bram's voice (`lines.ts` STOP_LINES.sights).
- **wharf:** a camera-conversation stop by the tackle shop panning to the tackle shop and the shipwright's (the sights' `shots`, on props), then `cast` at the quay's edge (his rod lent, the catch), then `barrel`. The passing-pause waypoints are deleted.
- **barrel:** the task waits for a real sale (`tsi:sold` from SellBody, reported when the sheet closes). Straight on, the `keep` stop (`auto`, `holds: "rod"`): Bram holds his rod through the talk and holds it out on the last line with the camera close on him (`"bram"` shot). The walk ends with no last word (`end: "none"`): `tsi:quest-complete` (QuestCheck), then RewardCard's From Bram (`tsi:gift`) and the rod into the bag (`tsi:bag-got`), in `finishArrival`.
- **HQ (club, lore, tour, farewell):** `hq/script.ts` v3: report, lore (the island, the Founder, the gatherings, GENESIS), the ID (IdCard: world name, birthday, spirit animal, existing profile fields; PATCH /api/profile now takes `birthday`), coins and gems (fly cards), check-ins, menu, mail, minimap (fly cards; the island shows the dock and the minimap while they fly), the keyboard tour (press or hold the lit key; Tab, G, H held; Enter, I, B, J, M, L pressed), Esc, the farewell naming the notice board, the trophy case and the Founder's desk, Juno's line kept. Saved visits moved to `tsi.hq.v3`.
- **Kit (design bible UI):** new flat kit pieces in `components/gui/flat/moments.tsx`: Spotlight, KeyBoard, FlyIn, QuestCheck, PrintedCard, on /lab/gui (`?only=key-board|fly-in|quest-check|printed-card`). Paper tokens `--ui-paper`, `--ui-paper-edge`, `--ui-paper-ink`, `--ui-stamp` in every theme. RegisterCard, MerchCard and the old UiTour are deleted. QuestCheck is ours (fired by `tsi:quest-complete`; main-quest fires it too); RewardCard is main-quest's.
- **catch:** untouched; the fishing UI redo is fish-tiers'.
- **phone (held):** a touch screen skips the keyboard tour (its say and its wait pass at once); round 2's touch tour copy is gone with the old tour.

## Next

1. Act on David's round 3 review once main relays it.
2. Later, after David approves the desktop tutorial: the phone pass (the tour on touch, the ID and fly cards at phone size).
3. Open for David: a job board or past-projects display in HQ (the farewell names only what exists); his name in the lore (the Founder for now).
4. Known: the arrow is a ground decal, so tall props in its spot can hide part of it. The hand-over close-up can have a stall post at its edge (it turns 1 rad off your line round Bram; no raycast).
5. Not run: perf:check (the 3D changes are the arrow's size and Bram's rod in his hands for the hand-over talk; neither is in a benched scene).

## Tools and gotchas

- Round 3: `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v3/shoot.mjs <out> walk-a|walk-b|kit`, each its own call; then `python3 specs/evidence/tutorial-v2/v3/strips.py <out> specs/evidence/tutorial-v2/v3`. Signed out: coins through `window.__hudCoins`, the sale by sending `tsi:sold`.
- Round 2's `specs/evidence/tutorial-v2/shoot.mjs` scenes (old script, before round 3): `first10` (part a, about 7 min), `first10b` (part b: the HQ visit is pre-done through `tsi.hq.v2`, about 5 min), `hq-phone` (`?hq=inside&hqvisit=1`, touch), and `arrow`.
  - Run each as its own foreground call: `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/shoot.mjs <out> <scene>`.
  - Dev server: `NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172`, under the devserver lock. Keep the hold short: the coordinator asked, because swap runs at 13 GB.
- HQ room coordinates (lib/game/hqLayout.ts): the desk station is (4.6, -7.5) and the exit is (0, -8.2). Walk there with `tsi:interior-move`.
- The sell barrel's E ("sell") outranks fishing within 2.2 m. The cast stand has to stay outside that (routes.test checks it).
- `stage()` waits miss instant stages: a pre-done HQ task passes in a frame.
- A browser with no saved look shows the plain creator first (click Skip).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/tutorial-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The village is retired (David, 2026-10-28):** every shot and run is on the new world; gates are vitest with `NEXT_PUBLIC_GAME_WORLD=new` only; no village-only code; keep off `web/lib/game/world/active.ts`.
- **UI (design bible, specs/design-bible.md UI):** one flat look, paper only for paper things, `--ui-*` tokens only, kit pieces from `web/components/gui/flat` (new ones go in the kit and /lab/gui first).
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
