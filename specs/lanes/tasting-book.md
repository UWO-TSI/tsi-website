# Lane: tasting-book (what sushi does)

Worktree `.claude/worktrees/tasting-book`, branch `game/tasting-book`, cut from `game/fishing-depth` at 0db249b4 (it needs that branch's new menu layout; fishing-depth merges to main first, then this one). Agent type `uwotsi-lane`. Dev port 3476.

## Round 6: David's tasting book round 5 review (2026-11-05, verbatim; https://claude.ai/artifact/BLVZqS9MJitK139U74p5sT)

Approved: tb5-learnt, tb5-questions, tb5-seat-later, tb5-seat, tb5-tank-given, tb5-tank-pick.
- tb5-look-close (redo), no note
- tb5-look (redo): "book is better modeled more prominent in the center of the t able"
- tb5-newfish-key (redo): "make it display all fish thats already given, allow you to open bag to give fish in inv but grey out ones you already given"
- tb5-newfish (redo): "make the ui more intuitive for page one collection and make it obvious it s a collection that give sperm boosts" (read: permanent boosts)
- tb5-pages (approve): "i think the pages need to be reorganized in a userfriendly intuitive way"
- tb5-tank (approve): "ok but like i wanna open the museum for fish provided, i think the hq tank will just be a seperate thing if you wanna drop but it doesnt do anything, its a very small thing"

Build:
1. The counter menu: model the book better, and place it prominently in the middle of the counter in front of your stool. Show it close up and in the game, as in r5. tb5-look-close had no note; tb5-look's note covers it.
2. Page one:
   - Make it obviously a collection, and make it obvious that a fish given there gives a permanent boost.
   - Show every fish already given, with the boost each one gave.
   - Open your bag from there to give a fish from your inventory. Fish already given are greyed out.
3. The pages after page one (approved with a note): reorganise them into a user-friendly, intuitive order and layout. Say what you changed and why.
4. The tank (approved with a note):
   - Given fish go to a museum. Find what the museum is today (the treasure spec mentions one for finds), pitch how given fish show there, and say what this changes from round 3 (the tank's count marks).
   - HQ's tank becomes a separate small thing: you can drop a fish in, and it does nothing.
5. tb5-questions was approved: a key fish given on page one unlocks its dish. With the tank doing nothing now, page one is where giving happens. Note anything this leaves open on the questions card.
6. `20261102120000_tasting_book.sql` is still unapplied, so changing it in place is fine.

## Round 5: David's tasting book round 4 review (2026-11-04, verbatim; https://claude.ai/artifact/M4Z2KdpsLFTQwTuTgakqiY)

Approved: tb4-choice, tb4-leave, tb4-menu-down, tb4-menu-open, tb4-questions, tb4-tank-prompt.
- tb4-look (redo): "make the menu on the table actually our menu"
- tb4-nigiri (approve): "make design of the menu more intuitive, we have teh first page which is offering new fish theres a button that gives them new fish from your inv , and the pages after are temp boosts that unlcok recipe based on the fishes you provide for the unlocking new recipes"
- tb4-seat (redo): "make reminder less bold and in your face"
- tb4-tank-given (redo): "why are you back on the old ui"
- tb4-tank (redo): "change ui"

Build:
1. The menu lying on the counter is our real menu (the teahouse menu's look), not a stand-in card (tb4-look). Model it in headless Blender if it needs a model.
2. The menu's design, more intuitive (tb4-nigiri): the first page offers new fish, with a button that gives the bar a new fish from your bag; the pages after are the temporary boosts, whose recipes unlock from the fish you've given.
3. The seated reminder quieter: smaller, lighter, not in your face (tb4-seat).
4. The tank sheet and the after-give view on the current flat UI kit (`web/components/gui/flat`, the design bible), not the old UI (tb4-tank, tb4-tank-given: "why are you back on the old ui").

## Round 4: David's tasting book round 3 review (2026-11-04, verbatim; https://claude.ai/artifact/9TZdz2Gtq8aNbN1AiqVaJQ)

Approved: tb3-book, tb3-buff, tb3-dishes, tb3-learnt, tb3-numbers, tb3-questions (all four picks: count cooked slots for the full-water prize, lower the permanent luck cap to +20%, one vocabulary on the menu, the buff on the right edge half faint).
- tb3-bar (redo): "remove menu and leave bar button, have menu be on the table, and character look down and press e to open, and find a way to exit. remove clock to look around"
- tb3-nigiri (redo): "ud for the nigiti page change, lasts say permanent"
- tb3-rules (redo): "no button that says fr thwe aquarium"

Round 4:
1. **The bar seat (coordinator's reading; show it on the card so David can correct it):** delete the Menu and Leave buttons (`DefaultIslandWorld.tsx` `barMenu`). The menu is a physical menu lying on the counter in front of the seat. Looking down at it (mouse, arrows, or a drag on touch) shows the usual E prompt (a tap target on touch); E opens the menu. Exits that need no button: Esc, tap outside or looking back up closes the menu; moving (WASD or the stick) stands you up and leaves the bar. "remove clock to look around" reads as the "Click to look around" hint (`lookHint`, line ~1609): don't show it while seated, and seated look-around works without a click.
2. **Nigiri page:** "Lasts" says "Permanent" (it says "For good" now).
3. **No "For the aquarium" button** on the nigiri choice (`SushiSheets.tsx`): the bar only cooks. Giving a fish to the tank happens at the tank in HQ (walk up, E, pick the fish); build that if it isn't there, with the same rules (free, the only way to milestones and a key fish's dish, no duplicates). Update the hint lines that tell you to give a fish to the tank so they point at HQ's tank.
4. **The approved picks:** the full-water prize counts cooked slots; the permanent luck cap drops to +20% (the migration is unapplied: change it in place, plus `bookLuck`); the numbers table updated.
5. Evidence ids `tb4-*`: the seat looking down at the menu with the prompt, the menu open, leaving by moving, the nigiri page, the tank give in HQ, desktop and phone.

## Round 3: David's round 2 review (2026-11-03, verbatim; https://claude.ai/artifact/R5ytwGPwnom5jxWo6e5rPb)

Approved: tb2-book, tb2-choice, tb2-dish-learnt, tb2-dish-locked, tb2-numbers, tb2-stamp.
- tb2-nigiri (approve): "phone ui a lil buggy"
- tb2-dish-ordered (approve): "phone ui gotta chill out theres too much buttons and shit, buff will show on the right side of the screen with icon, timer and percent, its like very faint so its not obvious"
- tb2-dishes (redo): "chill out on the buff and use term like luck and the other 5 criteria"
- tb2-questions (approve): "key fish, tank is the route for milestones and unlocks and cooking is solely for bonuses, no"

Build (merge game/fishing-depth's newest head first):
1. Rules: only key fish teach a dish. The aquarium route is what earns the milestones and unlocks; cooking gives only the permanent bonus. No nigiri for duplicates.
2. Dishes: smaller buffs, and name them in the rods' six stats (luck and the other five: bite, strength, reel, lure, control), not "rarer" and "bigger".
3. A buff shows on the right side of the screen as a very faint icon with its timer and percent.
4. Phone: fix the nigiri page's bugs and calm the menu down (fewer buttons; say what you merged or moved).

## Round 2: David's round 1 review (2026-11-02, verbatim; https://claude.ai/artifact/EiDyNe9y7NbVrF5CkHCeyS)

Approved: tb-stamp, tb-book, tb-book-empty, tb-give, tb-aquarium, tb-kit, tb-questions (the coordinator's picks: the feast stamps its fish too; the tank shows no giver names for now; "Opens later" stays; the tank's prompt mentions the gifts).
- tb-counter-choice (redo): "every new fish you find you can cook it for a very small perm fishing buff and everytime you got a new catch u would bring it here for a new kinda dish thing so you bring your new unique fish"
- tb-numbers (redo): "cooking fee like 100, like if its cooking the small new fish then its a perm small like 1% buff for fishing for new species and it can unlcok dishes taht are temp big buff but require ingredients and expensive. the fee for cooking scales with new fish unlock"

Build (first merge `game/fishing-depth` 34a84a7d into this branch: round 5 of fishing, not yet on main):
1. Cooking a species for the first time (its stamp) gives a small permanent fishing buff, about 1% per new species (say which stat: rarer or bigger fish, or both). Propose a cap or a gentle curve so 90-odd species can't stack into something silly, and show the numbers.
2. The fee starts around 100 coins and scales up with how many species you've already cooked.
3. Each first cook also unlocks a dish: a recipe that gives a big temporary buff but costs more and needs ingredients (other fish or items). Propose the first few dishes and their ingredients in a table; build the unlock and one dish end to end.
4. Repeat cooks of a stamped species: say what happens now (the old meal buff, or nothing).
5. Permanent buffs need a new column or table and a migration (timestamped after the newest on main), RLS like round 1, service role only. Stop before prod; the coordinator applies it. Never write the gem-to-money rate.

## David's call (fishing r4 review, 2026-11-01, f4-mechanic, verbatim)

"i think the dinner service is cool way to have mini game that makes money, so that maybe in next launch, and the tasting book should be impliment ed and one per fish kinda thing and they can either turn into meal that gets buff and a stamp or in the aquarium."

So:
- **Build the tasting book.** One entry per fish species. A fish you bring can go one of two ways:
  - **a meal:** Bancha cooks it, you get that dish's buff and the species' stamp in the book;
  - **the aquarium:** the fish goes into the aquarium instead.
- **Dinner service** (evening counter shifts, a slice, press and plate rhythm, tips) is for the next launch. Don't build it; add it to `specs/launch/` as a next-launch item with David's quote.
- The club feast was not picked. Don't build it.

The proposal he was answering (from the review page): "Bancha makes a nigiri from any species you bring. Each new one stamps a page of a tasting book at the back of the menu, a page per water. You chase the empty stamps." Cost: "The fish and a small coin fee". Reward: "The dish's buff, the stamp, and at 10, 25 and a full water a title, a bar stool for home or a rod part".

## Read first

- `specs/lanes/fishing-depth.md` (the menu, the dishes and buffs, the sushi bar code map), `specs/launch/sushi-bar.md`, `web/lib/game/sushiBar.ts`.
- The aquarium: `web/components/game/hq/Aquarium.tsx` and `specs/interiors/hq.md` (HQ's back-wall tank, today a line of text on E). Also the museum's donate and curator flow (`donate`, `curator` in `DefaultIslandWorld.tsx`): find out whether fish can already be donated there, so you don't build a second donation path.
- `web/lib/collections/` (caught species, the collection book).

## Build

1. **Data:** a stamp per user per species, stored server-side with RLS, written only by a server check that the player had the fish and it left their bag. A new migration (timestamped after the newest on main), never edit an applied one. Stop and tell the coordinator before anything touches prod; the coordinator applies it.
2. **At the counter:** with a fish in your bag, Bancha offers "Cook it" (the meal: buff plus stamp; the stamp only the first time per species) or "For the aquarium". Keep it to the counter's existing UI kit; no new modal style.
3. **The book:** the back pages of the menu, a page per water, one slot per species: empty, stamped (cooked) or marked as in the aquarium. Same paper and type as the new menu.
4. **The aquarium:** the species you gave shows up in it. Decide whether HQ's tank is shared by the club (everyone's gifts swim together) or per player, from what the code and specs already say, and say which in your report. Smallest version that reads in a shot.
5. **Milestones** (10, 25, a full water): only with rewards that already exist in the economy. Titles and the home bar stool only if those items exist; the rod part waits for the new rod roster (Meshy). List anything you skipped.

Coin fee and buff values go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

Dish pictures stay the labelled stand-ins: David wants each dish modelled with Meshy, edited in Blender, rendered to a 2D photo for the menu and used in 3D on the plate, and that waits for the Meshy key. Don't make other art for them.

## Gates and evidence

vitest (with and without `NEXT_PUBLIC_GAME_WORLD=new`), tsc, eslint on changed files, a migration test against a local or staging copy (never prod), and headless shots desktop and phone: the counter choice, a cooked stamp landing, the book pages (empty, partly stamped), the aquarium with a gift in it. One `perf:check` only if the aquarium renders new fish. Evidence in `specs/evidence/tasting-book/`, then report to the coordinator with the head SHA, gates, evidence, the migration file names and anything you couldn't verify.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never ports 3000, 3300, 3301.
- Locks: `LANE=game/tasting-book /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Supabase env blanked on your dev server.
- The fishing-depth lane works on its branch in parallel (catch board, signs, cover line, showroom captions). Keep out of `wharf.ts` and the catch board; if you need something of theirs, ask the coordinator.
- New world only (the village is retired). No fetched art. Real names never show in game. Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail code (`specs/lane-rules.md`).

## Status

Round 6 built (2026-11-05), waiting on the coordinator's review. Head: the last `[build]` commit on `game/tasting-book`. Main not merged again (origin/main 18362223 is in from round 4). The migration is NOT applied.

Round 6 (David's tb5 review):
- **The counter menu (tb6-look):** `build_sushi_menu.py` models it better: larger (0.26 x 0.40, was 0.22 x 0.34), thicker boards (17 mm closed) with eased outer edges, the page block set back and cut into leaves, the binding's black cloth wrapping the spine round to the back, and the stab binding's thread as real cord at each of the 15 stitches the cover prints (found from the cover's own pixels), over the round spine. 1040 tris, one material, one draw, 119 KB packed (was 81 KB, 188 tris). It lies square in the middle of your place (`menuAt` [lx, 0.84, 1.32], was lx + 0.1 and turned 0.06): between the fish case and your chopsticks, the soy dish left, the tea right. The full look down still centres it (sushiBar.test). Review renders `r6/tb6-look-blender*.png`.
- **Page one is the collection (tb6-collection, tb6-bag, tb6-given, tb6-learnt):** the first spread is "Collection" (your luck for good, large, with a track of 20 stamps to the +20% cap, "+1% a new fish, up to +20%. A key fish teaches him a dish too.", Open your bag, the next mark) and "Given" (every fish given, newest first, each a stamped slot with its name, "Luck +1%" or "Luck full" past the cap, and a key fish's dish; it scrolls inside its page). Open your bag opens the flat kit's panel over the menu (`GiveSheet`): your rod fish as cards, the new ones first, the ones already given greyed out under "Given" (ItemCard's new `given` cover) and not clickable; pick one and the side says what it gives (Luck +1% for good, and his dish for a key fish), In your bag, Costs, and Give. A give closes the bag onto the collection, where the stamp presses down; a key fish turns to its dish open with Order ready, as approved in tb5-learnt.
- **The pages after (tb6-pages):** four parts, each from a left page, named under the menu (FoldedMenu `chapters`, a word each in place of the dots; the one you are in inked, a click turns to it): Collection; Dishes (a contents page: each key fish and its dish, learnt ones first with a tick, the rest "Give a squid" with a lock, a click turns to it; then the dishes two a page, learnt first); Menu (the pot with the meal note, nigiri and rolls, the chef's omakase, your catch: the feast); All fish (a page per water). Why: give, then what giving taught, then what you can always order, then the checklist at the back; no blank page (round 5 had one after the chef's); the contents and the part names so you never page through to find something.
- **HQ's tank (tb6-tank):** a small thing now. E at the tank ("Drop a fish in") opens the kit's small panel (FlatDialog): its line, your rod fish as thumbs (a dot on one not in your collection yet, "not in your collection yet" on hover), Drop the <fish> in. The fish leaves your bag and swims in the club's tank (the newest 12 drops), and that's all: no slot, no luck, no mark, no dish. TankSheet's cards, side panel and meter are gone.
- **Data (migration changed in place, still unapplied):** `tasting_book` loses `way` (a slot is filled by a give, nothing else); `tasting_serve` takes `'cook'` (the give: fee by species in the book, the stamp, the count marks by fish given, the full water) or `'tank'` (takes the fish, records the serve, pays nothing; the club tank reads the newest `'tank'` serves, `idx_tasting_serves_tank`). memoryStore, supabaseStore (tank from tasting_serves), the collections buff (counts every slot), rules `tastingMarks(book: Set, key)`, service, route (`way: cook | tank`), transport, the demo, tasting.test.ts, the smoke.
- **Kit (showroom /lab/gui?only=flat-pieces, tb6-showroom):** `BoostTrack`, `GivenFish`, `PaperRow`, `spreadOf`, FoldedMenu `chapters`, ItemCard cover `given`; `BookSlot` states are `empty | given` (the aquarium's wave mark deleted). Deleted: the first page's fish row and its Give, `.newFish`, `.newFishNote`, `.choice`, `.slotWave`, TankSheet's flat-panel version.
- **Gates (round 6):** see the report (tsc, vitest, eslint, SQL smokes).
- **Evidence:** `specs/evidence/tasting-book/r6/{desktop,phone}/tb6-*.png` and clips `tb6-{look,give,key,pages,tank}.mp4` with `-poster.webp`, by `shoot.mjs showroom6 book6 tank6 museum6` with CLIP=1, cut by `scratchpad/tasting-book/clips.sh`.

Round 5 (David's tb4 review):
- **The menu on the counter is our menu (tb4-look):** `art/buildings/build_sushi_menu.py` (headless Blender) shapes one box into the closed menu: the spine rounded where the binding wraps it, the open corners rounded, the page block set back between the two boards (a lighter band). Its cover is the game's own, shot from the showroom by `art/buildings/sushi_menu_cover.mjs` (`art/buildings/sushi-menu-cover.png`; `MenuCover` in SushiSheets is now the one cover, used by the menu and the showroom), printed a little deeper (INK_DEPTH) so the warm evening light doesn't wash it out. One material `P_Cloth_Menu` (paper's matte), 188 tris, 666x1024 JPEG, 81 KB, one draw, loaded the first time you sit (`SushiBar.tsx CounterMenu`, `SUSHI_BAR_MENU_URL`). pack-glbs says "nothing to pack" (a JPEG and a tiny mesh). The old code-built card (`counterMenu`, the mergeGeometries import) is deleted. The stand-up cards at the other stools are the bar model's, untouched.
- **The menu's pages (tb4-nigiri):** cover, then the first page "New fish": your bag's fish new to your book (a red dot on a key fish, hover says its dish), the first picked; the picked fish on its plate with Luck +1%, Lasts Permanent and, for a key fish, Dish <name>; Give <fee>. After it the dishes the fish teach ("From your fish", two a panel; locked: "Give Bancha a <fish> on the first page and he learns it"), then the house's (pot, nigiri and rolls, the chef's), then the water pages. A key fish given turns to its dish and opens it with Order ready; any other fish turns to its stamp. "The book" panel is gone (the luck line moved to the first page; the tank's marks live in TankSheet); `BookMarks` deleted from the kit and the showroom. `MenuDish` without `onPick` is a plain dish (no button), its photo hidden on a phone. Phone: the first page drops its words (`.newFishNote`).
- **Rule change (round 5 pick, on the questions card):** a key fish teaches its dish whichever way it fills its slot, cooked at the bar or given to the tank (David: "the pages after are temp boosts that unlcok recipe based on the fishes you provide"). The tank keeps the count marks (gifts only). memoryStore, collectionsDemo, the migration (`tasting_dish`'s not_learned check drops `way = 'aquarium'`, header updated, in place, still unapplied), the smoke (a cooked dace no longer raises not_learned), tasting.test.ts.
- **The seated reminder (tb4-seat):** `.seatHint` (DefaultIslandWorld.module.css): no pill or shadow, 11px light words on a see-through slip at 0.6 (the meal buff's faint look), fading away after about 5 s; "Look down to read the menu · move to get up" (phone: "Drag down to read the menu · the stick to get up").
- **HQ's tank on the flat kit (tb4-tank, tb4-tank-given):** `TankSheet` is a `FlatPanel`: StatusLine (HQ_LINES.aquarium), a quiet count line and a GoalMeter to the next mark, a CardGrid of ItemCards (rarity edge, "Teaches a dish" or "New to your book", ×count; two a row on a phone). Pick one: a SidePanel (picture, what it does, In your bag, Costs Free, Give to the tank). After the give: the SidePanel says "In the tank", what it taught, Yours in the tank, Next mark. IslandSheet, List, ListRow, Badge, Empty, Loading are no longer used here.
- **Gates (round 5):** tsc clean; full vitest 3774 passed, 4 skipped (401 files) with and without NEXT_PUBLIC_GAME_WORLD=new; eslint clean on changed files; SQL smokes tasting_book and game_security pass on a throwaway PG16.
- **Evidence:** `specs/evidence/tasting-book/r5/{desktop,phone}/tb5-*.png` by `shoot.mjs book5 tank5`, plus `r5/tb5-look-blender.png` (the model's own render).

Round 4 (David's tb3 review):
- **The bar seat:** the Menu and Leave buttons are gone (`barMenu` and its CSS deleted). A menu lies on the counter before your stool (`SushiBar.tsx counterMenu`: one merged mesh in vertex colour, washi card, ink strip, red seal, matte; +1 draw call, only while seated; hidden while you read it). Seated, the mouse looks round with no click (`orbitCamera.ts seated`, set by IslandAtmosphere's rig; `useOrbitInput look`), one finger drags the view on a phone (a drag never taps to walk), the arrows as before. The seated tilt down is SEAT_TILT_DOWN (2.3) times the orbit's tilt, so the full look down centres the menu; a look down no longer settles back up. Past MENU_LOOK (0.1 over the middle tilt) SushiBar dispatches `tsi:bar-look`: the prompt "E Read the menu" (Tap on a phone); E (act "stool" while seated) opens it. Not looking down, a quiet status line in the prompt's place: "Look down at the menu · move to get up" (phone: "Drag down to the menu · the stick gets you up"). Put down: Esc, M, a tap outside, the arrow up (looks back to the middle), or the mouse moved up over the vignette past the middle tilt (`looksAtMenu` holds till the middle). Moving gets you up: WASD (also from inside the open menu: it closes and sends tsi:stand) or the phone's stick, which is back while seated (walk only: no Slide, Dash, Jump). "Click to look around" never shows while seated. `lib/game/sushiBar.ts menuAt, SEAT_TILT_DOWN, MENU_LOOK, looksAtMenu`, tests in sushiBar.test.ts.
- **Nigiri page:** "Lasts: Permanent". The choice has only "Cook it" (its line: "cook it for luck, or give it to HQ's tank", or for a key fish "In HQ's tank instead, it teaches Bancha his ..."). The menu's `serve` is now `cook`.
- **HQ's tank:** E at the tank's station ("Give a fish to the tank", was "Look at the aquarium") opens `TankSheet` (SushiSheets.tsx; IslandSheet with List/ListRow like the curator's DonateSheet): HQ_LINES.aquarium, how many of yours swim there and the next mark, then each fish in your bag whose slot is empty (key fish say which dish they teach), Give: POST /api/economy/tasting way aquarium (same rules: free, the only route to the count marks and a key fish's dish, no duplicates). The toast and the mark cards as before; `tsi:tank` makes the Aquarium's gifts reload so yours swims in. Hint lines now say "HQ's tank". The demo's club tank lists each species once (it duplicated a key).
- **Picks:** the full-water prize counts cooked slots (any fill that completes a water's page pays it, a cook too); the count marks stay gifts only. `rules.ts tastingMarks(book: Map, key)` (memoryStore, the demo and the SQL agree). The page note is "A full page: 250" (was "All in the tank", and it went quiet once a fish was cooked). The book's luck is +1% a species to a +20% cap (`TASTING.luck { each: 0.01, cap: 0.2 }`, `bookLuck`; the 0.5% tail is gone, it could never apply under the cap).
- **Migration (not applied, coordinator applies):** `web/supabase/migrations/20261102120000_tasting_book.sql` changed in place: `tasting_serve`'s water check moved out of the aquarium-only block and counts every slot of the water (cooked or aquarium); the count marks unchanged. Header comment updated. Signatures unchanged. The luck cap is TS only (no SQL). Smoke `web/supabase/tests/tasting_book_smoke.sql`: the last cliff pool fish is cooked and pays the water (paid 100, earned 250), a page not yet full pays nothing.
- **Gates (round 4):** tsc clean; full vitest (one run, the new world is the only world) 3774 passed, 4 skipped, 401 files, no load timeouts; eslint clean on changed files; SQL smokes tasting_book and game_security pass on a throwaway PG16.
- **Evidence:** `specs/evidence/tasting-book/{desktop,phone}/tb4-*.png` by `shoot.mjs book4 tank4`: seat, look, menu-open, nigiri (phone also nigiri-page, shut, with Lasts Permanent), choice, menu-down, leave, tank-prompt, tank, tank-given, tank-swim.

Round 3 and before (approved): only key fish teach a dish; cooking gives its stamp and the permanent luck only; dishes small and in the rod's six stats (`withMeal`, `mealOf`); the faint buff on the right edge (`HudBuff`, `BuffChip`); the calmer phone bar; the book (a page per water), stamps, the club-shared tank; dinner service is next launch (`specs/launch/sushi-bar.md`).

Numbers (round 4; meals unchanged from round 3):

| Meal | Cost | Buff |
|---|---|---|
| Miso soup | 20 | Lure +5%, 15 min |
| Salmon nigiri | 40 | Luck +5%, 20 min |
| Tuna roll | 40 | Strength +8%, 20 min |
| Omakase | 150 | Luck +8%, Reel +5%, 30 min |
| Bancha's feast | your epic or legendary fish | Luck +12%, Control +8%, 60 min |
| Staff meal (chef's order) | the fish | Luck +5%, Bite +8%, 30 min |
| Snapper chazuke (key: red snapper) | 250, snapper 1, sea bass 2 | Luck +10%, Bite +10%, 45 min |
| Dace karaage (key: dace) | 200, dace 3 | Reel +10%, 40 min |
| Squid tempura (key: squid) | 300, squid 1, sweet shrimp 2, scallop 1 | Lure +10%, Control +5%, 45 min |
| Catfish kabayaki (key: catfish) | 500, catfish 1, freshwater goby 2 | Strength +10%, Control +10%, 60 min |
| Tuna otoro (key: tuna) | 600, tuna 1, horse mackerel 2, anchovy 2 | Luck +12%, Reel +8%, 60 min |

The book (round 6): the give's fee 100 + 5 a species given before; luck +1% a species given, cap +20% (at 20). Marks (fish given; round 3 to 5: gifts to the tank): 150 at 10, 400 at 25. A full water's page: 250. HQ's tank: free, takes the fish, gives nothing.

## Next

1. Coordinator: review tb6-*, apply `20261102120000_tasting_book.sql` to prod after fishing-depth's catalogue seed, merge after game/fishing-depth.
2. The museum (tb6-museum pitch): build what David picks. The pitch's step 1 (a give also writes the museum donation when the club lacks that species, the curator stops taking fish) is small; the wall tanks wait for the museum rebuild (the treasure lane notes David: "need to rebuild muesum interior later").
3. Open for David (on the questions card): the give's fee now that it is a gift; marks counting gives; the tank taking the fish; luck past the cap.

## Tools and gotchas

- Counter menu: `node art/buildings/sushi_menu_cover.mjs` (a dev server on :3476, `scratchpad/tasting-book/cover.sh` runs one), then `withlock.sh blender ... -P art/buildings/build_sushi_menu.py [-- review <png>]`, then `node scripts/pack-glbs.mjs public/assets/game/buildings/sushi-bar-menu.glb`.
- The seated reminder fades in about 5 s: book5 polls for it every 250 ms after each E, and logs its opacity.
- Smoke: `scratchpad/tasting-book/smoke.sh tasting_book_smoke.sql` (PG16 on 127.0.0.1:54331; 020_player_persistence fails in the stub, as before).
- Clips (round 6): `CLIP=1` makes shoot.mjs record the run and write `marks.json`; `scratchpad/tasting-book/clips.sh <run_dir> <evidence_dir>` cuts each mark into `tb6-<name>.mp4` (h264) with a webp poster and copies the pngs.
- Shots: `ONLY=desktop|phone scratchpad/tasting-book/session.sh <out> showroom counter aquarium book2 book3` under `withlock.sh devserver` (next dev on :3476, Supabase blanked, new world) runs `specs/evidence/tasting-book/shoot.mjs`. Desktop and phone together run past 10 minutes: run them as two calls. The demo's pockets need `&bag=23`.
- The held menu sways forever, so Playwright clicks inside it need `force: true`. "Cook it" has the price in its name: match `/^Cook it/`.
- `?at=` doesn't move you inside HQ: walk with `w` instead.
- The bar opens in the evening: shoot it with `at=19:30&time=evening` (the real clock decides otherwise). The first load can outlast the settle: book3 presses E until the Menu shows. The devserver lock often waits its full 20 minutes (exit 75): run the shoot in the background and wait on its output.
- The `showroom` flow's old "Tasting book (paper)" locator no longer finds its section (it times out after the buff shot); tb-showroom is stale.
- book4 (round 4) doesn't click the canvas, so the seated look is the mouse with no lock (`world(..., { click: false })`); on a phone it dispatches touch PointerEvents on the canvas (one finger), taps the vignette at y 262 to put the menu down (y 24 hits the lab nav), and drags the stick with the mouse (its handlers take any pointer).
- Inside HQ there's no `__move`: walk by `tsi:interior-move` targets in the room's frame (tank4: (-5.2, 0), (-5.2, 6.9), (-0.6, 6.9) rounds the sectional to the tank's station at (0, 6.95)). The dev log prints `window.__orbit` pitch and capture state.
- session.sh exits 1 with ONLY=desktop (its last test is false): not a failure.
