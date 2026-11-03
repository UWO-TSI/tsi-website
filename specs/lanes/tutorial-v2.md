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

## Round 6: David's playtest of round 5 (2026-11-01 night, verbatim, local test server)

Screenshot: `/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/images/82.png` (night, Bram's first line on the dock, the talk box with the hearts row and the gift button).
- "no need to show heart and gift in the tutorial"
- "also in the cut scene to come on the island on one of the cuts it shows the island from the dock but the camera angle and teh way the world is curved you can only rly see water"

- On Bram's wharf line "And the shipwright's. Boats, one of these days." (screenshot `.../images/83.png`): "rewrite" (coordinator: say plainly what the building is and that boats come later, in Bram's voice, one short sentence, keeping the shipwright and boat icons; check the lore first; show old and new lines on the review).
- "remove the it got away ui when a bug gets away and only show it if im trying to catch a bug, if not dont show" (coordinator: the toast only when the player swung the net at that bug or was mid-catch; a bug flying off on its own shows nothing).

His round 5 review marks (page GbbF8C1nVDqkyqcSP5UV2w), verbatim:
- v5-id (redo): "i think we remove like where youre from and put stuff thats important in game, like pronouns or smth like what does other multi player games need" (coordinator: drop "where you're from"; propose fields from what cozy multiplayer games show on a player card, build the best few, list the others for him).
- v5-keys (redo): "the keyboard overlay can be bigger, 15% bigger, also when holding each key it should pop on the right side what it will look like and fade away when let go, like the inventory bar or emote wheel with a mini animation on it spinning or selecting "
- v5-kit (approve): " on thing is the museum is closed so i cant donate anything to the museum and im stuck for the tutorial" (coordinator: signed out on a local server the progression is the static previewState (lib/progression/client.ts, source "defaults"), the first catch never ticks, so Juno never takes it; check that reading; say if a signed-out player can really get stuck, but don't build a local progression).
- v5-sights (redo): "i want you to make a icon library that matches words to icons so all future convo uses colored icons" (coordinator: keyword.tsx's KEYWORDS becomes the documented library with much wider coverage (places, items, creatures, actions, roles), a design bible rule that every talk line uses it, the full library on /lab/gui as a kit page).
- v5-wallet-slot (redo): "pressing esc there is a long pause of silence, it should be instant when you press esc alice explains, and explain that you click to be in locked camera and esc to be free cam"

More notes may follow from the coordinator while you work.

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

Round 6 built (David's round 5 playtest and review, 2026-11-01), code at 3b2f6b9a and 0f5216fb; evidence `specs/evidence/tutorial-v2/v6/` (t6-*). Round 5's status is in git history (21e72484).

- **Hearts and gift (note 1):** `useInTutorial()` (arrivalStore: an arrival running, or Alice's visit not done) hides TalkBox's friendship row and gift picker; they come back after.
- **The crossing (note 2):** the curve (view-space z^2 x 0.0032) hid the island below a low camera: from 0.45 m the sea's horizon is 12 m away. The bow cut now rides about 5 m up over the bow on a 28 to 25 lens, aimed at the island (the wharf fills the frame); the drone cut stays wide and aims there too. The "island" point is now a quarter of the way from the pier's tip to HQ (the wharf's buildings and the town), not half HQ's position (the island's far middle, 110 to 130 m off). Nothing in the world moved. The crossing is always dawn gold (by design), so day and night shots of it match; the night difference starts on the dock.
- **Shipwright line (note 3):** "And the shipwright's. Boats, one of these days." is now "And that's the shipwright's yard, where you'll build a boat of your own one day." (m7: crafting boats is the next launch.)
- **Bug toast (note 4):** "It got away!" only when your swing startled the bug (VillageLife `startled`); one that flies off on its own is silent.
- **v5-id:** "From" is out; Pronouns in (free text with picks: she/her, he/him, they/them, she/they, he/they, any pronouns). New column `profiles.pronouns` (migration `20261101230000_profile_pronouns.sql`, not applied: the coordinator applies it), PATCH /api/profile takes it. Proposed for David, not built: a title (ACNH passport's two-word phrase), "here for" tags (fishing, bugs, decorating, chatting, studying), favourite catch (from the collection), usual play hours or time zone, "resident since" date, showing pronouns on other players' cards (the net card).
- **v5-keys:** the light keyboard card 15% bigger (keys 37 px, lead 17 px); `KeyPeek` (kit, new) pops on the card's right while a tour key is down (wheel spins in and picks, emote wheel picks a heart, HUD pills slide in, bag bar fills, collection flips, quests tick, map pings, mail rises) and fades on release (at least 1.1 s for a quick press). Spotlight got an `aside` slot.
- **v5-sights:** `keyword.tsx` is the icon library: 70-odd kinds over 8 tones (sea creatures, land creatures, coins, gems/rewards/events, things, places, people, things you do; new tokens `--ui-word-person`, `--ui-word-act` in all three themes). Design bible UI rule 8c: every talk line uses it, new things get a row. Kit page `/lab/gui?only=keyword-library`.
- **v5-wallet-slot (Esc):** Alice answers 150 ms after Esc (was 2.6 s of silence) with the new `camera` lines: "That's your menu. Esc brings it up whenever you need it." / "Out on the island, click and your mouse turns the camera. Esc lets it go again." (left out on touch). Both farewells lost their old menu line.
- **Evidence (`specs/evidence/tutorial-v2/v6/`):** t6-before-/t6-after- `{d,n}-cuts` (every cut's middle plus the landing), `-bow`, `-drone` (15/50/90%), `-talk-bram`; t6-talk-hearts-before-after-crop; t6-id-form, t6-id-card; t6-keys-card-bigger, t6-keys-peek-{wheel,emote,hud,fade,press} strips and the wheel and bag crops; t6-esc-instant strip, t6-esc-alice-menu, t6-esc-alice-camera; t6-shipwright-line (old: v5/b-46-wharf-shipwright); t6-kit-{key-peek,key-board,keyword,keyword-library,printed-card}. /lab/gui logs a hydration mismatch on every overlay (pre-existing, not this round's).
- **v5-kit (museum stuck):** confirmed: signed out the progression is the static `previewState` (lib/progression/client.ts, source "defaults"), `firstCatchKey` is always null, so Juno's step never takes the catch and a signed-out player is stuck at "bring your first catch to Juno". Signed in, facts read the catch from the DB and Juno takes it. Not built (no local progression), per the coordinator.

## Next

1. Act on David's round 6 review once main relays it.
2. The coordinator applies `20261101230000_profile_pronouns.sql` before the ID ships (without it, PATCH /api/profile with pronouns fails and the card says it wasn't saved).
3. At the main-quest r3 merge: TopCluster (their XP chip out, my coin chip out: keep both removals), hudStore (their `hudLive` and chapter XP, my `gems`), hudPrefs FLASH_MS (their `xp` gone, my `coins: 2000`), the theme files (their tokens at the end, mine after `--ui-word-coin`, now with `--ui-word-person` and `--ui-word-act`).
4. Other coin and gem animations (rewards, sales) should fly to `[data-hud-slot="coins"|"gems"]` too (bible 8b).
5. Bring Alice's look-round-HQ line back when David says.
6. Later, after David approves the desktop tutorial: the phone pass (KeyPeek sits right of the card: no room on a phone).
7. At the fish-tiers merge: MemberFishing must dispatch `tsi:fish-hooked` / `tsi:fish-caught` / `tsi:fish-escaped` / `tsi:fish-end`, answer `[aria-label="Fishing reel"]`, and build its reel with `createFishingReel`.
8. Open for David: the ID fields he picks from the list above; the wake cut (all sea, by design) if he wants it changed too; a job board or past-projects display in HQ; his name in the lore (the Founder for now).

## Tools and gotchas

- Round 6: `scratchpad/tv6-multi.sh <out> shoot:day shoot:night walk:hq walk:sights walk:kit` under `withlock.sh devserver` (one dev server on 3172, several scenes). `v6/shoot.mjs <out> day|night`: the crossing played out, each cut at 15/50/90% (`<P>-cut-N-<id>-fNN`), the middles plus the landing as `<P>-cuts-fNN`, then Bram's first talk box. `v6/walk.mjs`: round 5's walks (hq: pronouns, key peeks, Esc; sights: the shipwright line) and the kit (key-peek, keyword-library). Then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> <dir>`.
- The crossing's geometry (dock frame, new world): the boat starts about 45 m off the pier's tip and 130 m from half HQ's position; the curve's horizon from height h is sqrt(h / 0.0032) m away (0.45 m: 12 m; 4 m: 35 m).

- Round 5: `scratchpad/tv5-run.sh <out> hq|sights|kit` under `withlock.sh devserver` (starts `next dev -p 3172` new world, Supabase blanked, runs `specs/evidence/tutorial-v2/v5/shoot.mjs`, stops the server); then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> <dir>`. The hq scene pre-sets `tsi.dock.cleared` (the dock's lessons skipped) and sets coins 1240 and gems 35 through the dev hooks inside HQ.
- Round 4: `/private/.../scratchpad/run.sh <out> <scene>` style: start `NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npx next dev -p 3172` under the devserver lock, then `HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v4/shoot.mjs <out> walk-a|walk-b|kit`, one scene per call (walk-a about 7 min, walk-b about 6), then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> specs/evidence/tutorial-v2/v4`.
- walk-b pre-sets `tsi.hq.v4` (done) and `tsi.dock.cleared`, so the dock's lessons are passed over.
- Signed out: no coins (the shoot sets `window.__hudCoins(1240)` before the keys), no chat (multiplayer off: Enter brings nothing in), the sale now works.
- HQ room coordinates (lib/game/hqLayout.ts): the desk station is (4.6, -7.5) and the exit is (0, -8.2). Walk there with `tsi:interior-move`.
- The sell barrel's E ("sell") outranks fishing within 2.2 m. The cast stand has to stay outside that (routes.test checks it).
- A browser with no saved look shows the plain creator first (click Skip).

## Rules

- **Gates round 6:** tsc clean; full vitest 398 files passed (2 skipped), 3737 tests passed, 4 skipped; eslint clean on every changed .ts/.tsx since 4fb4b8cc. perf:check not run (camera framing and UI only; nothing new renders in the world).
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/tutorial-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The village is retired (David, 2026-10-28):** every shot and run is on the new world; gates are vitest with `NEXT_PUBLIC_GAME_WORLD=new` only; no village-only code; keep off `web/lib/game/world/active.ts`.
- **UI (design bible, specs/design-bible.md UI):** one flat look, paper only for paper things, `--ui-*` tokens only, kit pieces from `web/components/gui/flat` (new ones go in the kit and /lab/gui first).
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
