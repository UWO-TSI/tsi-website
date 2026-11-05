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

## Round 13: David's tutorial round 12 review (2026-11-05, verbatim; https://claude.ai/artifact/8sNHHXTmmPUrQ6C4kvzu9M)

Approved: t12-app, t12-away, t12-close, t12-cost, t12-desktop, t12-hud, t12-key, t12-phone, t12-reduced-smooth, t12-tilt, t12-tour-phone.
- t12-corner (approve): "good"
- t12-highlight (redo): "the ui and app design needs to be redone to fit the theme"
- t12-model (redo): "the ui screen needs to be remodeled, and wondering if the ui can have less pixel pass cuz its hard to read the icons on the phone"
- t12-questions (redo): "charm needs proper physics, i think maybe what if we scratch the id idea and alice gives them a phone instead which makes them make a profile on the phone and has the other apps? thoughts?"
- t12-screen (redo): "ui needs redone, should have pixel wash but shouldnt be pixel wash over pixel, should be 1 and lighter"
- t12-slide (approve): "better charm physics"
- t12-turnaround (redo): "the charm on the phone is a accessory, and it has proper physics, charms will be swappable later"

Build:
1. The phone's UI, redone to fit the phone:
   - Give it its own app design that matches the phone (pearl and lime, and only the pixel style from the DS reference: no Nintendo art, font or text). It is no longer today's game UI.
   - Remodel the screen itself (t12-model).
   - One pixel wash, lighter, and never a wash over the world's pixel pass: keep the phone's screen out of the world pass, or draw it after, so icons and keypad digits read at real size. That also fixes round 12's broken-up digits.
2. The charm: an accessory with its own model and proper physics. It swings and settles with the phone's slide, snap and lean, and stays swappable later.
3. David's idea: drop the ID, and Alice hands you the phone, where you make your profile and which has the other apps.
   - The coordinator's answer to him: worth doing. The phone is already what the tour teaches, so it gets a story reason to exist and there's one object to learn instead of two. The print-and-stamp moment can move onto the phone's screen.
   - Pitch it with clips: Alice hands over the phone at registration, it starts up, you fill in your profile on it (existing profile fields only), and it's stamped.
   - List everything the ID touches today (code, tour steps, other players viewing your ID) and what replaces each.
   - Nothing about the ID ships until David picks.
4. Keep everything approved: X, the corner, the HUD flying in, the tilt, putting it away, the tour on the phone, desktop and phone, reduced motion, cost.
5. Merge origin/main first; this lane hasn't merged it yet.
6. `specs/references/phone/` is third-party art and is untracked. Never commit it.

## Round 12: David's tutorial rounds 9, 10 and 11 reviews (2026-11-04, verbatim; https://claude.ai/artifact/99FLDZKNXT2AG9KJ9uBn4M, https://claude.ai/artifact/RyNFwoRguwVeQ649Ye5VLc, https://claude.ai/artifact/8SM3Qk28k3Vma8c5hKCvHU)

Round 9 page:
Approved: t9-app, t9-map.
- t9-apps-phone (redo)
- t9-esc-phone (redo)
- t9-esc (redo): "make a button that brings up the phone and have animation of it poping up and putting it back down animatino so its not just always in the bottom right"
- t9-hud (redo): "i dont get this one, arent we already showing the coins and gems and shit, what does h do, is it even necessary"
- t9-phone-in (redo)
- t9-phone (redo): "phone needs to be remodeled, i will provide refrences"
- t9-questions (redo)
- t9-tour (redo): "phone is one of the most important thing so like make sure the button for it is obvious like zxc  or smth"

Round 10 page:
Approved: none.
- t10-app (redo)
- t10-beside (redo): "bigger longer screen, the dial buttons are flatter take up less of the phonem the buttoins are clear and not newon creen, the n8umber use a different font and flatterm the screen is bigger and longer, the things on the phone are stuckers, model the phone withou stickers first , the color isnt right, the charm is added on and customizable, the app needs to be redesign to fit this style, the camera angle for the phone is off. and the ui of the phone needs to be redone to fit that style. also make it so if your mouse hits the bottom right of the screen without clicking it will pop up and hiting it again retracts"
- t10-esc (redo)
- t10-grid (redo)
- t10-phone-slide (redo)
- t10-phone (redo)
- t10-questions (redo)
- t10-slide (redo)
- t10-turnaround (redo)

Round 11 page:
Approved: t11-app, t11-desktop, t11-finish, t11-phone-slide, t11-short.
- t11-beside (redo): "i like it so far but i want it to be a blend of the current ui with a pixel wash if that makes sense, like current ui but green highlights and giving it a pixel finish from the overall pixelation"
- t11-close (redo): "the phone is angled so the ui also needs to have the same angle, i want either the ui to be baked in the model or like find a way to make it naturally angled and tilted within  the blender model"
- t11-highlight (redo)
- t11-phone (redo): "the phone tiles with the mouse, the phone ui needs to be fixed"
- t11-questions (redo)
- t11-screen (redo)
- t11-slide (approve): "make it pull out and filp open and not 1 motion"

Rounds 9 and 10 were marked after round 11 was built, so read all three together; round 11's approved cards (app, desktop, finish, phone slide, short) stand.

Build:
1. **The phone remodelled** (t10-beside): a bigger, longer screen; flatter dial buttons that take up less of the phone, clear rather than neon; the numbers in a different, flatter font; the colour fixed; no stickers (model it bare first); a charm hung on that can be swapped later (a cosmetic slot, the model only for now); fix the camera angle on the phone. Never model a Sanrio character. Headless Blender only.
2. **The motion** (t11-slide): it pulls out, then flips open: two motions, not one.
3. **The screen in the phone's plane** (t11-close, t11-phone, t11-questions): the phone keeps a natural tilt and follows the mouse, and the UI tilts with it. Either bake the UI into the screen (render it to a texture on the screen mesh) or otherwise put it in the model's plane. Not a flat overlay.
4. **The UI style** (t11-beside, t10-app): today's game UI with a pixel wash: the current layout and look, green highlights, and an overall pixel finish from the pixelation. The apps redesigned to fit. Keep the round font and the pixel pointing hand unless the new style needs otherwise, and say which.
5. **Opening it** (t9-esc, t9-tour, t10-beside): not always sitting in the bottom right. A key that's obvious, one of Z, X or C (whichever is free; check the bindings and the settings page), brings it up with the pull-out and flip, and puts it away again. The mouse touching the bottom-right corner (no click) pops it up, and touching it again puts it away. The tour teaches the key clearly; the phone is one of the most important things.
6. **The H step** (t9-hud): David asks what H does and whether it's needed. Drop the key: at that step the HUD flies in by itself (above the keyboard card, then to its places). Say on the card that this is the coordinator's default.

## Round 11: the phone's screen in a pixel style (David, 2026-11-04, verbatim)

"phone ui reference, change color but  keep the pixel-y style" (with a reference image: `specs/references/phone/phone-ui-ref.png` and its README entry; untracked, third-party (a Nintendo DS game), never in git). Rounds 9 (https://claude.ai/artifact/99FLDZKNXT2AG9KJ9uBn4M) and 10 (https://claude.ai/artifact/RyNFwoRguwVeQ649Ye5VLc) are still waiting for marks: the coordinator forwards them if they arrive while you work.

David, a minute later: "the phone also needs a pixel filter".

Round 11:
0. **The phone itself gets the pixel filter:** today the three rendered layers are smooth and high-resolution while the island behind has the game's pixel finish (the post pass's pixel size), so the phone reads as pasted on. Give the body, the sliding top and the strap the same look: render them small and scale them up by whole numbers with pixelated rendering, at the same on-screen pixel size as the world (read it from the pixel finish's setting so the two match at every quality tier and screen), with the same colour treatment if the finish has one. The screen UI (item 1) uses the same pixel size. Show the phone beside the world, before and after, desktop and phone.
1. **Restyle what's on the phone's screen** (the app grid, the app labels and their keys, the home bar, and anything else drawn on the glass) in the reference's pixel style: chunky pixel-stepped frames with a dark outer and a light inner line, small pixel curls at the corners, a pill label or title band, square app tiles with a pixel border and a clear highlighted tile for the hovered or keyboard-selected app. Take the style only: our own drawn frames and icons, in the phone's colours (cream white, mint and the pale-green screen, a deep green for the outlines), never the game's art, font or text. Its orange and brown are what David means by "change color".
2. **Crisp pixels:** draw the frames as tiny pixel images (9-slice) scaled by whole numbers with pixelated rendering, so the pixels stay square on desktop and on a phone screen at their real sizes; the app icons in the same pixel look (redraw or render them on a pixel grid) and readable at the round 10 tile size. A pixel font only if one with an open licence fits and stays readable; logged in SOURCES.md; otherwise keep the kit font.
3. **Keep everything round 10 built:** the model, the slide, the apps opening and coming back, the keys, touch, reduced motion. Fix round 10's known edge: under about 820 px tall the open phone reaches the wallet's slot by about 12 px.
4. If it fits, a small pixel pointing-hand on the selected app (keyboard and controller use); say if you left it out. Update bible UI 8d with the pixel screen rules so later phone apps match.
5. Evidence ids `t11-*`: the reference's style beside our screen (review only), the screen before (round 10) and after, close up at real pixel size and at 2x, the highlighted tile, the slide with the new screen, desktop and phone screens.

## Round 10: the phone as a 3D model (David, 2026-11-04, verbatim)

"phone model, make it 3d blender with a slide up animation" (with a reference image: `specs/references/phone/slider-phone-ref.png` and its README; untracked, third-party, never in git). Round 9's page (https://claude.ai/artifact/99FLDZKNXT2AG9KJ9uBn4M) is still waiting for marks: the coordinator forwards them if they arrive while you work.

Round 10:
1. **Model it in headless Blender from the reference:** a slider phone, cream-white with a soft mint tint, rounded and chunky in our art direction (simple, smooth, cartoony, subtle texture). Top half: a pale-green backlit screen, three heart buttons under it, a round d-pad with two teardrop soft keys either side, small clover, flower and heart marks. Bottom half: a 4 by 3 keypad of pill keys with a green glow, hidden until the top slides up. The braided green strap and the lime jelly star charm on the side. **No Sanrio character anywhere** (the stickers on the reference are Pochacco): where the reference has stickers, use our own motifs or leave them plain.
2. **The slide-up animation:** Y (and the touch button) brings the phone up from the bottom right, and its top half slides up to reveal the keypad, the classic slider motion with a small settle; putting it away plays it in reverse. The charm may swing with the motion if it's cheap; nothing else animates. Reduced motion: it appears open, no slide.
3. **The apps live on its screen:** the round 9 app grid (Settings, Quests, Bag, Collection, Friends, Mail, and how an app opens and comes back) shows on the phone's screen, legible at the phone's size on desktop and on a phone screen. The screen may take the reference's pale-green tint if the icons stay readable; show it.
4. **The cheapest way that still reads as 3D:** e.g. layers rendered from the Blender model (the body and keypad, the sliding top half) animated in CSS with the screen as live HTML, or a small live model; pick one, say why and what it costs (file sizes, or draws and frame time). Budgets in `specs/perf/budget.md`. Update bible UI 8d.
5. Evidence ids `t10-*`: the model's turnaround (front, side, back, three-quarter; closed and open), the slide as a frame strip, the phone in game with an app grid on its screen and with an app open, desktop and phone screens; the reference beside the render (in the review only; the reference itself never goes in git).

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

Round 13 built (David's round 12 marks), on origin/main merged at f694964d (one conflict, the lab's kit import line, taken as the union). Code at 9656fb91; evidence `specs/evidence/tutorial-v2/r13/` (t13-*: mp4 clips with `-poster.webp`, stills as webp). No migration. Nothing in round 13 is approved yet; round 12's approved cards stand.

- **The screen, its own design (t12-highlight, t12-screen):** `web/components/gui/flat/phoneScreen.ts` draws the home screen as pixel art on the screen's own grid (`SCREEN` 108 x 156, `TEX` 4 texture pixels a screen pixel, smooth sampling keeps them square): pearl and lime `--ui-phone-*` tokens (ink, white, pearl, pearl-2, lime, lime-deep, lime-soft; the same in all three themes; the old `--ui-phone-screen/-glow/-glow-soft` deleted), our own 8-row pixel font (`text`, `textWidth`), our own 16 x 16 icons by app id (`ICONS`: settings, quests, bag, collection, friends, mail, profile), stepped frames (`box`, `frame`), a dark band (signal, clover, heart, star, battery), tiles two across, the home bar (house and key), lime pick with a ring and a 1 px lift, round 11's hand on the keyboard pick. `PhoneApp.icon` is gone (the screen draws `ICONS[id]`); the callers' `KeywordIcon`s removed. Drafts: `scratchpad/r13/art/{icons,font}.py`.
- **One wash (t12-model, t12-screen):** `phone.tsx` `usePasses`: body, keys and charm render to a 1 / `PIXEL_FINISH` half-float target and are blitted up nearest; the body's depth is drawn again at full size (colour off); then layer `SHARP` (the glass and the keypad's `digits` node) renders at full resolution. Canvas dpr [1, 2], antialias on. The lights are enabled on every layer. Pixel finish off: one plain render. About 30 draws a frame while it moves.
- **The screen remodelled (t12-model):** `art/ui/slider_phone.py`: a raised clear bezel (0.09 proud, 0.18 wide) round a glass sunk 0.06 behind it, a thin dark mask (`phone_mask` #33463a), the earpiece moved up; the digits exported as their own node `digits`. Packed 381 + 149 KB, 70 + 92 KB brotli.
- **The charm (t12-turnaround, t12-questions):** `charm-star.glb` is now `charm` > `strap` and `pendant` (origin at the strap's end). `phoneMotion.ts` `hangCharm` / `stepCharm` / `charmStill`: a two-link Verlet chain (gravity 120, drag 2.6, 240 Hz steps), the mount eased between frames, pushed out of the phone's slab (`solidFor`); `hangParts` turns the strap and the pendant along it. Rehung each time the phone leaves from away; reduced motion hangs still. The old `swing` spring in `stepMotion` deleted.
- **The pitch (t12-questions, David's idea):** dev only, `?idphone=1` (`devHome` in DefaultIslandWorld; `pitch` in useHqOnboarding swaps Alice's idAsk / idDone for `PHONE_PITCH`). `components/game/hq/PhoneSignup.tsx`: a second kit `Phone` (testId `phone-signup`) with a `view` (the new `PhoneView`: `id`, `draw`, `moving`, `controls`): boot (clover grows, Hello!, the island's name), the profile form on the glass (the ID's fields; invisible inputs laid on the glass, testids `hq-id-*` kept), Stamp it (RESIDENT lands with a shake), Done, then its home screen with a Profile app, then away and `signed`. Saves with `saveId` (exported from IdCard). Lab: `/lab/gui?only=phone-pitch`. Nothing about the ID changes without the flag.
- **What the ID touches today, and what replaces it** (if David picks the phone):
  1. HQ beat `id` (`arrival/hq/script.ts:40`, card `id`, wait `signed`) -> the same beat and event, card `phone`; same position, so no progress version bump.
  2. Alice's `idAsk` / `idDone` (`hq/lines.ts:25-32`) -> `PHONE_PITCH.idAsk` / `idDone`.
  3. Tracker step "Make your island ID" (`hq/lines.ts:82`) -> "Set up your phone".
  4. `IdCard.tsx` (form, print, stamp, card) and `IdHeadshot.tsx` -> `PhoneSignup.tsx`; the headshot goes, or comes back as the Profile app's picture (question).
  5. Data: world name (`/api/identity/name`), pronouns, birthday, bio (`PATCH /api/profile`) -> unchanged (`saveId`).
  6. The friend code on the card -> on the phone's profile screen and the Profile app.
  7. Front desk reopen ("Front desk · your ID", E at the desk; DefaultIslandWorld :262, :1142, sheet `id`) -> the Profile app on the phone; the desk is just Alice.
  8. Kit `PrintedCard`, `CardOverlay`, `PaperField` (moments.tsx; only IdCard uses them) and lab `printed-card` -> deleted, or kept for paper things.
  9. Keyword `id` ("ID", "ID card", keyword.tsx:79) -> dropped; `phone` already exists.
  10. Tests `hq/visit.test.ts` (order, `signed`, the lore check, which now covers PHONE_PITCH) -> same order; the ID_CARD copy shrinks to the field labels.
  11. Other players: they never see your ID today (PlayerCard shows name, member dot, level; `realtime_player_card` sends no pronouns or bio) -> nothing to replace; pronouns on the player card would be new (question).
  12. `specs/hq-onboarding.md` (an older "register card") and `ShowcaseSheets.tsx:6` / `/api/collections/showcase` comments ("the one slot on their ID") -> rewritten.
  13. Found while listing, not verified: `pronouns` may be missing from `profiles_guard_privileged`'s editable fields (`20260926180000_ownership.sql:156-185`), so a PATCH with pronouns could be refused (42501) and the ID shows "HQ couldn't save that just now". Needs a new migration if true; not this lane's change.
- **Bible UI 8d** updated (the screen remodelled, the charm as an accessory and its physics, the pixel filter once, the screen's own design and its rules, `view`).
- **Gates round 13:** tsc clean; vitest (NEXT_PUBLIC_GAME_WORLD=new) 401 files passed, 2 skipped; 3782 tests passed, 4 skipped; eslint clean on every touched .ts/.tsx. perf:check (SCENES=v2, at 9656fb91) passed: high 5.10 ms median (baseline 4.80, +6.2%), p95 7.60, 356 draws (-0.8%); lite 3.10 ms (2.90, +6.9%), 281 draws (-2.8%), load 4.4 with other lanes running. The phone's canvas is closed in the bench (its own renderer, about 30 draws only while it or the charm moves).

## Next

1. Act on David's round 13 review once main relays it. Review-only sheet (never in git): `scratchpad/r13/turn/t13-refs-beside-screen.webp` in the session scratchpad.
2. Questions on t13-questions: the phone instead of the ID; the headshot; the front desk; pronouns on the player card; the screen's pixel size; the charm's swing; the H hold.
3. If the phone wins: build items 1 to 12 above, delete IdCard, IdHeadshot, PrintedCard, CardOverlay, PaperField and the dev flag.
4. Round 9's carried items: the ledger row for bible UI 8d (rounds 10 to 13), icon batches, the main-quest merge notes (TopCluster, `data-hud-quest`), coin and gem flights to `[data-hud-slot]`, Alice's look-round line, MemberFishing's test hooks, and David's open questions (the wake cut, a job board in HQ, his name in the lore, the showcase API).

## Tools and gotchas

- Round 13: shots `specs/evidence/tutorial-v2/v13/run.sh <out> ui | ui-phone | ui2x | charm | hq | pitch | reduced | smooth | lab | lab-pitch` under `withlock.sh devserver` (the scratchpad's `r13/shoot.sh <out> <scenes>` retries on exit 75). ui2x is a desktop at 2x (the screen and digits at real size); charm clips the swing; pitch is the HQ walk with `?idphone=1`. Clips: `python3 specs/evidence/tutorial-v2/v12/clips.py <shots> specs/evidence/tutorial-v2/r13 id=name ...`; sheets: `python3 specs/evidence/tutorial-v2/v13/sheets.py <all shots> <turnaround dir> specs/evidence/tutorial-v2/r13`. Quick screen previews without a server: bundle `phoneScreen.ts` with esbuild into a file:// page (scratchpad `r13/prev/`).
- The lab's `Loop` wraps in `display: contents`, which has no size: the phone sizes itself to its parent, so give it a sized parent (`PitchShow`). Focus on the glass's inputs with `preventScroll`, and `.phone` is `overflow: clip`, or typing scrolls the game to the caret.
- Round 12: shots `specs/evidence/tutorial-v2/v12/run.sh <out> ui | ui-phone | hq | keys | reduced | smooth` under `withlock.sh devserver` (dev server on 3172; ui and ui-phone together about 8 min, hq about 6, so run them as separate calls, in the background, looping on exit 75). Each scene records a video (`video-<id>/`); `clips-<id>.json` logs each beat's start and end; screenshots stall the video, so no screenshot inside a clipped beat (stills come from a second take). Then `python3 specs/evidence/tutorial-v2/v12/clips.py <shots> specs/evidence/tutorial-v2/r12 u-open=t12-slide-desktop ...` (mp4 and poster) and `python3 specs/evidence/tutorial-v2/v12/sheets.py <ui shots> <reduced+smooth shots> <keys shots> <turnaround dir> specs/evidence/tutorial-v2/r12`. ffmpeg here has no libwebp: posters go through PNG and PIL.
- Round 12 Blender: `withlock.sh blender .../Blender -b --factory-startup -P art/ui/slider_phone.py -- glb <dir>` then copy both GLBs into `web/public/assets/ui/phone/` and `cd web && node scripts/pack-glbs.mjs public/assets/ui/phone/phone.glb public/assets/ui/phone/charm-star.glb`.
- perf:check refuses to build with uncommitted changes in gated files (measure-build.sh): commit first.
- Round 11: shots `specs/evidence/tutorial-v2/v11/run.sh <out> ui | ui-phone | short | smooth | reduced` under `withlock.sh devserver` (dev server on 3172, runs `v11/walk.mjs`; ui and reduced together, the other three together, each run about 4 to 6 min). The walk logs rects (phone, wallet, tile), each phone canvas's pixels against its CSS size, and the world canvas's. Sheets: `python3 specs/evidence/tutorial-v2/v11/sheets.py` (reads the scratchpad shots; before = round 10's evidence). `border-image` with `border: 0 solid transparent` and an explicit image width paints in Chrome, and `image-rendering: pixelated` applies to it.
- Round 10: Blender `LANE=game/tutorial-v2 withlock.sh blender /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/ui/slider_phone.py -- layers|turnaround <dir> [samples]` (16 samples for a quick look; about 15 s a view on the GPU). In Blender 5.2 `view_transform`'s enum reads as NONE through bl_rna: set "Standard" directly. Shots: `specs/evidence/tutorial-v2/v10/run.sh <out> ui ui-phone reduced` under `withlock.sh devserver` (dev server on 3172, runs `v10/walk.mjs`). The slide frames are exact: the walk pauses the phone's CSS animations (`getAnimations({subtree:true})`) and seeks `currentTime`; for the put-away frames it stretches the 400 ms unmount timeout first. The walk also logs the phone's, the wallet's and an app's rects. Strips and sheets: a few lines of PIL (scratchpad `phone/strip.py`, `phone/sheet.py`).
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
