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

## Round 5: David's v4 review (2026-10-29, verbatim)

Approved: v4-dock, v4-esc, v4-glide, v4-hop, v4-props, v4-reel, v4-sell, v4-small.
- v4-id (approved, note): "the pringin card animation is buggy and you can see it before the printer line"
- v4-keys (redo): "i like the old UI better, remove this new keyboard ui, just tweak the old keyboard ui so that theres less uncessary text and make it more lightweight"
- v4-currency (redo): "animation looks good but still isnt the natural spot for them in the ui, it goes to where the quests are. i think underlying issue is the layer 2 ui isnt finalized and there isnt a slot for the coins and gems" (design bible UI 8b: the wallet's slot top right under the time)
- v4-sights (redo): "good, introduce the shop to sell ingame and real merch, include little icon movement thing too, for cafe explain study with friends and get rewarded for it. I want you to always add colored icon in text that makes sense and wiggle it a bit, for the fishing market rod, ships allat"
- v4-kit (redo, no note).

## Round 4: David's v3 review and his playtest (2026-10-29, verbatim)

Review of round 3. Approved: v3-arrow, v3-wharf, v3-barrel, v3-currency, v3-hudfly, v3-lore, v3-farewell.
- v3-sights (approved, note): "i want you to use simple 2d icon for fish bug word and make it color and shake a lil"
- v3-checkin (approved, note; the coordinator answers it): "yeah and is it possible to make them each a unique qr that they keep themselves that we can scan as well, and they can easilty connect to their apple wallet from their c omputer, check if feasible first"
- v3-dock (redo): "ok so for tutorial, when you just land, the dock will look slightly differnt because youre doing tutorial and you have to learn to jump over box, and need to learn how to jump dash as well, but once you walk into hq, the game auto clears up tutorial dock and resets it with the proper dock after"
- v3-id (redo): "the id overlay needs to be redesigned, the card looks bad, should show character head shot. like the card itself is the overlay and you can hover and it tilts and button bottom that confirms it"
- v3-keys (redo): "i dont like that white card, just keep the keys there, and whever they press the keys they go to the next one and i want it so that its smaller keyboard ui but pressing it the mini map, the back pack stuff like that begins popping in the ui one by one"
- v3-kit (redo, no note).

His playtest of round 3 (signed out, dev server):
1. "alice the printing of id still horrible, the spirit animal is useless ask for stuff that matters"
2. "when coins and gems go to top right it doesnt show on ui and the quest ui is there, quest ui should dissapear for this part, the coins and gems should go up there and click into place for the ui and gently fade away"
3. "dont say only real gatherings level you up, these in person events are a great way to level up"
4. "when bram does the hop over box, i did but it doesnt register so i have to do it again"
5. "alice when ask to press esc it glitches sometimes and doesnt register"
6. "The part where she says look around should be edited for later" (taken out for now; bring Alice's look-around-HQ line back later; Juno's line stays)
7. "make showing off the 3 main building make it so theres camera movement between them" and "same wit hrod shop and stuff at wharf"
8. "also when engaging in convo with npc and you happen to be like in their face it should auto take a step back on your character just minor detail things"
9. Double prompt: "Tab Hold for your tools" and "Tab Take out your fishing rod" at once (one prompt only; the tutorial's chip wins).
10. "this tutorial should show up when the fish bar pops up and should be less words"
11. "these barral and crate infront of the sell fish shop should be removed"
12. "sell for fish doesnt work" (signed out, no database: make the dev path sell against the in-memory store; production unchanged).
Not ours: the creator's water and hair; casting toward the cursor; the reel panel's how-to text.

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

Round 5 built on the new world and shot headless: `specs/evidence/tutorial-v2/v5/` (a-* HQ, b-* the sights and wharf, k-* the kit, c-keys-r3-r4-r5 the comparison). Waiting on David's review. Main merged at 660eb79d (the village retired: `routes/index.ts` and GAME_WORLD gone, NEW_ROUTE everywhere; tutorial.test's walk-along mechanics run on a fixture route `WALK`, the old village stops). Round 4's status is in git history (1fc48ea3).

- **wallet (v4-currency, bible UI 8b):** kit `WalletSlot` (`components/gui/flat/wallet.tsx`: coins and gems in one white pill, each cell `data-hud-slot`; `at` in/out slides; `landing`: that cell's icon waits until a FlyIn marks it `data-landed`, then clicks in and its count ticks up from 0; `CountUp` moved here from TopCluster). `TopCluster.tsx` `HudWallet` is the HUD's wallet, under `HudClock` in the top-right column (DefaultIslandWorld): it rests there in the UI view (Esc 1, the HUD key, the setting, the keys tour's H), slides in at rest for `FLASH_MS.coins` (now 2000) when coins or gems change, and holds in for Alice's `showcase` (hq.fly), lingering 0.9 s after; a cinematic (Alice talking again) fades it with the rest of the top right (it isn't unmounted). TopCluster lost its coin chip and the old showcase slot; the quest line no longer hides for a fly. `hudStore` carries `gems` (from the wallet read) and `setHudGems`; dev hook `window.__hudGems` beside `__hudCoins`.
- **keys (v4-keys):** round 3's card back as a light `Spotlight` (`light`: no scrim, a small white card on a hairline, only "Hold [H] At a glance", the keys on a light well, dots and Skip). `KeyPrompt` and its CSS deleted; `KeyBoard` back on its well (32 px keys, thin foot). Steps lost their `text` (uiTour.ts titles a word or two). Kept round 4's behaviour: each press moves on and its HUD piece springs in (SlotPop); H now points at the wallet.
- **ID (v4-id):** printing, the card's wrapper is clipped at the slot's line (`clip-path` on `.paperWrap`, top edge only) and the card slides down out of it (`printOut` is a plain translate); nothing shows above the slot.
- **keywords (v4-sights):** `keyword.tsx` is a dictionary (`KEYWORDS`: fish, bug, coin, gem, rod (a drawn rod), shovel, merch, ID, mail, map, study, ship/boat/shipwright, shop/tackle shop, market/fish market, café, museum, HQ, wharf, barrel, gathering), each with a lucide icon and a tone (`--ui-word-fish|bug|coin|gem|place|item`, all three themes). `keywordParts` finds them in any line (whole words, any case, longest phrase first); no stars any more (`plainLine` deleted), so every TalkBox line in the game gets them (TalkBox shows a keyword's icon as the typing reaches it through `[data-tone]`). Lines: the café "Study there with friends, and you'll earn coins for it.", the shop "Tools and clothes for the island, and real merch too.", the wharf "Here's the wharf and the fish market."
- **Kit (v4-kit):** /lab/gui `?only=key-board` (the light card), `wallet`, `fly-in` (into the wallet's cell), `keyword` (every kind, then a line), `printed-card`.

## Next

1. Act on David's round 5 review once main relays it.
2. At the main-quest r3 merge: TopCluster (their XP chip out, my coin chip out: keep both removals), hudStore (their `hudLive` and chapter XP, my `gems`), hudPrefs FLASH_MS (their `xp` gone, my `coins: 2000`), the theme files (their tokens at the end, mine after `--ui-word-coin`).
3. Other coin and gem animations (rewards, sales) should fly to `[data-hud-slot="coins"|"gems"]` too (bible 8b); the sale already slides the wallet in through the coins change.
4. Bring Alice's look-round-HQ line back when David says.
5. Later, after David approves the desktop tutorial: the phone pass.
6. At the fish-tiers merge: MemberFishing must dispatch `tsi:fish-hooked` / `tsi:fish-caught` / `tsi:fish-escaped` / `tsi:fish-end`, answer `[aria-label="Fishing reel"]`, and build its reel with `createFishingReel`.
7. Open for David: a job board or past-projects display in HQ; his name in the lore (the Founder for now).

## Tools and gotchas

- Round 5: `scratchpad/tv5-run.sh <out> hq|sights|kit` under `withlock.sh devserver` (starts `next dev -p 3172` new world, Supabase blanked, runs `specs/evidence/tutorial-v2/v5/shoot.mjs`, stops the server); then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> <dir>`. The hq scene pre-sets `tsi.dock.cleared` (the dock's lessons skipped) and sets coins 1240 and gems 35 through the dev hooks inside HQ.
- Round 4: `/private/.../scratchpad/run.sh <out> <scene>` style: start `NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172` under the devserver lock, then `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v4/shoot.mjs <out> walk-a|walk-b|kit`, one scene per call (walk-a about 7 min, walk-b about 6), then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> specs/evidence/tutorial-v2/v4`.
- walk-b pre-sets `tsi.hq.v4` (done) and `tsi.dock.cleared`, so the dock's lessons are passed over.
- Signed out: no coins (the shoot sets `window.__hudCoins(1240)` before the keys), no chat (multiplayer off: Enter brings nothing in), the sale now works.
- HQ room coordinates (lib/game/hqLayout.ts): the desk station is (4.6, -7.5) and the exit is (0, -8.2). Walk there with `tsi:interior-move`.
- The sell barrel's E ("sell") outranks fishing within 2.2 m. The cast stand has to stay outside that (routes.test checks it).
- A browser with no saved look shows the plain creator first (click Skip).

## Rules

- **Gates round 5:** tsc clean; full vitest (new world) 376 files, 3543 passed, 4 skipped; eslint clean on every file changed since the merge. perf:check not run (UI only).
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/tutorial-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The village is retired (David, 2026-10-28):** every shot and run is on the new world; gates are vitest with `NEXT_PUBLIC_GAME_WORLD=new` only; no village-only code; keep off `web/lib/game/world/active.ts`.
- **UI (design bible, specs/design-bible.md UI):** one flat look, paper only for paper things, `--ui-*` tokens only, kit pieces from `web/components/gui/flat` (new ones go in the kit and /lab/gui first).
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
