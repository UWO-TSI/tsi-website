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

## Round 9: David's tutorial round 8 review (2026-11-04, verbatim; https://claude.ai/artifact/B7SrDpE4EsdadjUSnXKYes)

Approved: t8-id, t8-wheel.
- t8-dock (redo): "simplify the bar, i was thinking pressing a button and a phone pops up on the bottom right and the apps are like all the stuff in the bar so that we dont need the bottom bar anymore"
- t8-esc (redo): "tethos island shouldnt take up screen remove"
- t8-esc-phone (redo): no note (the same changes on a phone)
- t8-hud (redo): "i was thinking the hud doesnt exist, you press it it shows off above the keyboard and it flies to where it usually sits"
- t8-map (redo): "have the hud pop ontop of the keyboard and fly over"

Round 9:
1. **The in-game phone replaces the Esc view's bottom bar.** One key (pick a free one, say which, and add it to the keyboard card and the Settings key list) and a small tap target on touch screens bring up a phone in the bottom right; its apps are everything the bar held (Settings first, Friends with Who's on the island, Quests, and the rest). The bottom bar is deleted, not hidden. The phone is a new kit piece: write it into the design bible's UI section (size, corner, slide-in, app grid, how an app opens and how you get back) so later UI matches it. On a phone screen it may take more of the screen; show both. Say in the report whether Esc still opens the big-minimap view or now just opens the phone.
2. **Esc view:** remove the big "Tethos Island" title; nothing else takes its place.
3. **H and M lessons:** before the lesson the HUD (and, for M, the minimap) isn't on screen at all. Pressing the key makes it appear above the keyboard card, show off for a beat, then fly to where it usually sits and stay. Reduced motion: it fades in at its place.
4. Evidence ids t8 to t9 (`t9-*`): the phone opening and an app open (desktop and phone), the Esc view without the title, the H and M lessons as frame strips (before the key, above the card, mid-flight, settled).

## Round 8: David's round 7 review (2026-11-03, verbatim; https://claude.ai/artifact/CZ2GaCgveWyeVh13EewDS8)

Approved: t7-quest, t7-id-pick, t7-icons, t7-peek-bag. t7-icons-toast (approve): "looks good, "
- t7-icons-esc (redo): "the settings icon should be in the bar before, and i want you to simplify the bar below, combine things you think makes sense, and some things like you dont need"
- t7-id (redo): "remove the show off part actually"
- t7-peek-hud (redo): "no the time heath and exp and stuff should go to the ui not on the right side"
- t7-peek-map (redo): "should go to the actual ui"
- t7-peek-wheel (redo): "keep the old one, and put it on top of the keyboard ui, and move the keyboard ui a lil down"

Build: the Settings icon back in the Esc bar where it was, and the bar below simplified (combine what belongs together, drop what isn't needed; list the changes); remove the ID's show-off slot (pronouns stay); the HUD and map previews point at the real HUD pieces where they sit on screen instead of a panel on the right; the tool wheel preview goes back to round 6's, placed above the keyboard card, with the keyboard card a little lower. Merge origin/main first.

## Round 7: David's round 6 review (2026-11-02, verbatim; https://claude.ai/artifact/FLaWaoHYevUpA14EKAkENX)

Round 6 was merged to main by the coordinator (approved: t6-talk, t6-bow, t6-drone, t6-cuts, t6-shipwright, t6-bug, t6-keys, t6-keys-strip, t6-esc). Merge origin/main first.
- t6-icons (redo): "expand the icon library n the same design, then slowly impliment these icons so its uniform"
- t6-id (redo): "remove usall play time, fav catch maybe remove the 3 showcase and have a 1 slot for a cool fish or bug showoff on the id slot open"
- t6-keys-peek (redo): "make it look more similar to the actual ui"
- t6-stuck (approve): "make it work for tests"

Build:
1. Icons: grow the keyword library further in the same design, and start using it across the game's UI text (labels, tooltips, prompts), a batch at a time, so icons are uniform everywhere. List what each batch covered.
2. ID card: drop the ideas "usual play time" and "favourite catch"; instead one showcase slot on the ID for a fish or bug you choose to show off (from what you've caught). Pronouns stay.
3. The key previews: built from the real UI pieces (the actual tool wheel, emote wheel, bag bar, map), so they look like the game's UI, just small.
4. Signed out (dev and tests), the quest must be completable: let progression run locally when there's no server (the first catch ticks, Juno takes it), only in dev and tests, never in production.

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

Round 9 built (David's round 8 review, 2026-11-04) on origin/main 18362223 (merged at 6e97d63d), code at 8749c4df; evidence `specs/evidence/tutorial-v2/v9/` (t9-after-*, t9-before-* copied from round 8's after shots, which are the code before this round). No migration. Round 8's status is in git history (e89164be).

- **The phone (t8-dock):** kit piece `Phone` (`web/components/gui/flat/phone.tsx` + css, `/lab/gui?only=phone`), written into the design bible as UI 8d (8b's dock line now says the phone). Apps: Settings, Quests, Bag, Collection, Friends (Who's on the island inside), Mail. Key **Y** (`openPhone` in `lib/identity/settings.ts`, so it's in Settings' remappable key list). Y brings the phone up over play (cursor freed via `holdCursor("phone")`), Y/Esc/the home bar put it away. **Esc still opens the UI view** (big minimap, wallet, level badge) with the phone up where the bar was; Esc again is Esc 2. Touch: the old menu button (top left) is now a phone icon opening the UI view with the phone. An app opens its sheet and the phone tucks down (`away`) until the sheet closes. `MenuDock`, `Entry`, `DockKeys` and the dock CSS are deleted.
- **t8-esc:** the place-name heading ("Tethos Island") no longer shows with the full HUD or the UI view; it only flashes as you arrive in a scene.
- **t8-hud / t8-map:** in the tour the HUD (bars, quest line, time, wallet) and the minimap are unseen (`Unseen`, visibility only, places kept) until their key; the press (H's too, before the hold finishes) shows them, the kit's new `FlyHome` pops them up in a row above the keyboard card, shows off ~1 s and flies them home (FLY_HOME_MS 380/1000/760), and the next key waits for the landing. Reduced motion: a fade in place. `PeekRing` deleted. The tour's dock pieces (Quests, Collection, Mail, and Bag) now fill the phone a tile at a time, and a last step "Press Y Phone" brings the whole phone.
- **Gates round 9:** tsc clean; full vitest (NEXT_PUBLIC_GAME_WORLD=new, maxWorkers 2) 398 files passed, 1 failed, 2 skipped; 3757 passed, 4 failed: all 4 in `movement/keys.test.ts`, which used Y as a free key (now the phone's); switched it to U and the file plus arrival and identity (14 files, 116 tests) pass. No load timeouts this run. eslint clean on the 14 changed .ts/.tsx. No perf:check (UI only).

## Next

1. Act on David's round 9 review once main relays it.
2. Known edge: a saved account that already bound Y to a menu action now fails the duplicate check in `mergeSettings`, so `readSettings` falls back to the defaults for that account. Decide with the coordinator whether to drop the clashing default on read.
3. The ledger row for bible UI 8d (the coordinator records bible changes).
4. Icons, next batches: the collection and journal sheets, the shop and economy sheets, letters; after the other lanes merge, the quest tracker, the reel's tags and the interact prompt.
5. At the main-quest merge: TopCluster.tsx lost its default export in round 8 (keep theirs for HudClock/HudWallet edits, drop any reintroduced gear); `hudLead` now carries `data-hud-quest` (FlyHome's target).
6. Other coin and gem animations (rewards, sales) should fly to `[data-hud-slot="coins"|"gems"]` too (bible 8b).
7. Bring Alice's look-round-HQ line back when David says.
8. At the fish-tiers merge: MemberFishing must keep `data-member-fishing` and `[aria-label="Fishing reel"]`.
9. Open for David: the wake cut; a job board or past-projects display in HQ; his name in the lore (the Founder for now); whether the orphaned showcase API goes.

## Tools and gotchas

- Round 9: `specs/evidence/tutorial-v2/v9/run.sh <out> hq|ui|ui-phone|kit|kit-phone ...` under `withlock.sh devserver` (dev server on 3172, runs `v9/walk.mjs`). hq shoots H and M as 4 frames each (`a-hud-f01..04`, `a-map-f01..04`: before the key, 700 ms, 1700 ms, 2900 ms after it) plus the phone filling in the tour; ui: Y's phone, an app, back, away, then Esc's view and its apps; ui-phone: the phone button. The H/M frames go into 2x2 grids (`t9-after-hud-lesson-frames.webp`) with a few lines of PIL (strips.py makes them too small). Free keys left for later bindings: N, O, U.

- Round 8: `specs/evidence/tutorial-v2/v8/run.sh <out> hq|ui|ui-phone|kit|kit-phone ...` under `withlock.sh devserver` (dev server on 3172, runs `v8/walk.mjs`); hq's peeks are whole-screen frames (the HUD and map peeks ring the real pieces), ui shoots the Esc view, its dock, the top right, Settings and Friends. Before shots: copy walk/run to the scratchpad, `git switch --detach <base>`, shoot, switch back. Then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> <dir> 720`. The devserver lock is busy with other lanes for long stretches: loop on exit 75.
- Signed out the wallet is null, so the walk sets `__hudCoins(1240)` / `__hudGems(35)` before the keys.

- Round 7: `specs/evidence/tutorial-v2/v7/run.sh <out> hq|quest|ui|ui-phone|kit|kit-phone ...` under `withlock.sh devserver` (dev server on 3172, new world, Supabase blanked, runs `v7/walk.mjs`). `quest` needs `CAST_X=72.04 CAST_Z=30.4` (the tutorial's cast stand, logged by `hq` as castStand); free roam with no saved look shows the creator first (the walk clicks Skip). The reel autoplayer reads the window and the fish by their rects (`[class*=window]`, `[class*=marker] > *`). Then `python3 specs/evidence/tutorial-v2/v4/strips.py <out> <dir> 720`.
- zsh doesn't split an unquoted `$FILES`: pipe the changed-file list through `xargs npx eslint`.
- `/lab/gui` must import `@/lib/game/world/member` for the map peek (the game registers it; never import it from a shared game component, or the applicant island bundles the world).

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
