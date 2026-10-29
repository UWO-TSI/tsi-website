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

Round 4 (David's v3 review and playtest) built on the new world and shot headless: `specs/evidence/tutorial-v2/v4/` (a-* the dock and Alice's visit, b-* the sights to the hand-over, k-* the kit on /lab/gui, `-strip` for the animated beats). Before shots are round 3's, `specs/evidence/tutorial-v2/v3/`. Waiting on David's review. Round 3's status is in git history (4fee5d2b).

- **dock (v3-dock):** the tutorial dock's dressing (its box) shows until you've walked into HQ, then never again (`arrivalStore` `dockCleared`/`clearDock`/`useDockCleared`: `tsi.dock.cleared` on this device, or the account's HQ visit past its first beat). A replay (signed out, a reload restarts the arrival) passes over the dock's lessons: route stops flagged `dock` (`dockNew`, `dash`) are skipped in `stepTutorial` (`dockCleared` in the frame). No world data changed.
- **ID (v3-id, playtest 1):** no panel: the kit's `CardOverlay` holds a large `PrintedCard` (`large`, `tilt`: leans toward the pointer with a sheen). Your headshot is your real avatar through the creator's `Portrait` (`components/game/hq/IdHeadshot.tsx`, `framing="head"`, white studio). You write on the card itself (`PaperField`): world name, birthday (private), From (`hometown`), About you (`bio`); the spirit animal is gone. One button under it: Print my ID, then Done. Print: the card feeds out of a printer slot with a blinking light; a stamper (knob, handle, inked pad) comes down on the photo's corner, the card gives, the mark is left, a gleam runs across.
- **keys (v3-keys):** no white card: the kit's `KeyPrompt` (a small dark cue pill, then a smaller bare `KeyBoard`, a quiet Skip) low in the middle. Each key done brings its part of the screen into its real place (`uiTour.ts` `piece`; `DefaultIslandWorld` `tourShown`): H the full HUD (coins, level), Enter the chat bar (only when multiplayer is on), I the Bag button, B/J/L the menu dock's Collection, Quests and Mail entries (`MenuDock` `only`), M the minimap. Each springs in and rings (kit `SlotPop`). They show until the tour closes.
- **fly-in merge:** the menu, mail and minimap fly beats are gone (their keys bring them in); coins and gems keep their fly cards. HQ script is now 8 beats; saves moved to `tsi.hq.v4`.
- **sights (v3-sights):** kit `Keyword` (`components/gui/flat/keyword.tsx`): a line marks keywords with stars (`*fish*`, `*bug*`, `*coins*`); the word is coloured (`--ui-word-*` tokens) with a little flat icon that pops in as the typing reaches it and wiggles. TalkBox types lines part by part. Bram's sights lines use it.
- **playtest 2 (coins and gems):** the quest line hides while a currency flies; TopCluster `showcase` gives it an empty slot top right, the icon clicks into it (FlyIn sets `data-landed` on the slot), then the slot fades.
- **playtest 3:** gatherings are "a great way to level up" (lore page 3 and the check-in card's note).
- **playtest 4 (the hop):** root cause: the hop counted only inside a 0.45 m circle just past the box, so a real hop landing beside Bram missed it. Now `past: true`: past the box's line, anywhere within 1.4 m across (`tutorial.ts` `pastLine`; test).
- **playtest 5 (Esc):** root cause: Esc while she was still saying "Press Esc" closed the dialogue box instead (the press was lost), and a menu already open when the beat came round never counted. Now an Esc during her line opens the menu too, a cardless beat takes its event early (`visit.ts` `early`; her lines ending then moves past the beat, the farewell still said), and the menu open counts whenever the beat is on (tests).
- **playtest 6:** Alice's look-round-HQ line is out of both farewells for now (bring it back later); Juno's line kept.
- **playtest 7:** the camera travels between building shots (sights and wharf): an eased arc round Bram, lifted a little mid-way (`ArrivalWorld` `converseCamera`, `SHOT.glide`, `SHOT.crane`).
- **playtest 8:** every talk: too close to the resident, you step back to `TALK_COMFORT` (1.3 m) in a short walk (`residentTalk.ts` `stepBack`, PlayerAvatar's `tsi:face`; tests).
- **playtest 9:** one prompt: while the tutorial's glyph chip is up (`arrivalRun.chipUp`, `useArrivalChip`), the island's "Take out your fishing rod" hides.
- **playtest 10 (reel chip):** `components/game/arrival/FirstCatchTeach.tsx`, mounted by Arrival while the catch is the task, not by any overlay. Driven by events only: `tsi:fish-hooked` (the reel starts: the chip goes up over `[aria-label="Fishing reel"]`, or low in the middle without it), `tsi:fish-caught`, `tsi:fish-escaped`, `tsi:fish-end` (it goes), a pointer down or Space after 0.6 s (you're holding: it goes). The floor (the first fish can't get away) is the shared reel logic's `reelAssist.floor` (`lib/game/fishingReel.ts`, the default of `createFishingReel`), set by FirstCatchTeach. FishingOverlay is main's again (no tutorial code). Dropped with it: the longer first bite window and the reel pausing until you hold.
- **playtest 11:** removed from the world layout (`generate.ts` MARKET, regenerated): `market-8` (barrel), `market-15`, `market-16` (crates) in front of the fish market. The sell barrel and its fish crate stay. Later market ids renumbered (nothing refers to them).
- **playtest 12:** signed out on a dev server with Supabase blanked, selling runs on the in-memory economy over this browser's catch record (`lib/wallet/localEconomy.ts`, `transport.ts` falls back only after a 503/401, not in production, only with no Supabase URL; tests).
- **Kit (v3-kit):** `components/gui/flat`: `KeyPrompt`, `SlotPop`, `CardOverlay`, `PaperField`, `PrintedCard` (`large`, `tilt`, the stamper), `KeyBoard` smaller and bare, `Keyword`/`KeywordLine`; tokens `--ui-word-fish|bug|coin` in all three themes. /lab/gui `?only=key-board|keyword|printed-card`.

## Next

1. Act on David's round 4 review once main relays it.
2. Bring Alice's look-round-HQ line back when David says (the notice board, the trophy case, the Founder's desk).
3. Later, after David approves the desktop tutorial: the phone pass (the tour on touch, the ID at phone size).
4. At the fish-tiers merge: MemberFishing must dispatch `tsi:fish-hooked` when its reel starts and `tsi:fish-caught` / `tsi:fish-escaped` / `tsi:fish-end` when it ends, have its reel panel answer `[aria-label="Fishing reel"]` (or change FirstCatchTeach's REEL_BAR), and build its reel with `createFishingReel` (the floor comes from `reelAssist`).
5. Open for David: a job board or past-projects display in HQ; his name in the lore (the Founder for now).
6. Not run: perf:check (the 3D changes are the ID headshot's own small canvas while the card is up, and the market props removed).

## Tools and gotchas

- Round 4: `/private/.../scratchpad/run.sh <out> <scene>` style: start `NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172` under the devserver lock, then `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v4/shoot.mjs <out> walk-a|walk-b|kit`, one scene per call (walk-a about 7 min, walk-b about 6), then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> specs/evidence/tutorial-v2/v4`.
- walk-b pre-sets `tsi.hq.v4` (done) and `tsi.dock.cleared`, so the dock's lessons are passed over.
- Signed out: no coins (the shoot sets `window.__hudCoins(1240)` before the keys), no chat (multiplayer off: Enter brings nothing in), the sale now works.
- HQ room coordinates (lib/game/hqLayout.ts): the desk station is (4.6, -7.5) and the exit is (0, -8.2). Walk there with `tsi:interior-move`.
- The sell barrel's E ("sell") outranks fishing within 2.2 m. The cast stand has to stay outside that (routes.test checks it).
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
