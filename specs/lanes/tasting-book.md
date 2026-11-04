# Lane: tasting-book (what sushi does)

Worktree `.claude/worktrees/tasting-book`, branch `game/tasting-book`, cut from `game/fishing-depth` at 0db249b4 (it needs that branch's new menu layout; fishing-depth merges to main first, then this one). Agent type `uwotsi-lane`. Dev port 3476.

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

Round 3 built (2026-11-04), waiting on the coordinator's review. Head: the last `[build]` commit on `game/tasting-book`; `game/fishing-depth` 8fe80dfe (round 6) is merged in (one conflict, the kit import line in FlatPieces.tsx: both sides' pieces kept). The migration is NOT applied.

- **Rules (round 3, David: "key fish, tank is the route for milestones and unlocks and cooking is solely for bonuses, no"):** a cook pays its fee and gives its stamp and the permanent luck, nothing else. A gift to the tank is free and is the only thing that counts toward the milestones (150 at 10 fish in the tank, 400 at 25, 250 for a water whose every fish is in the tank) and the only way a key fish teaches its dish. A filled slot is never served again; no nigiri for duplicates (they go into dishes or the sell sheet). Rules in `rules.ts tastingMarks` (the tank's set), `memoryStore.ts serve/bookDish`, the SQL and the demo shim.
- **Migration (not applied, coordinator applies):** `web/supabase/migrations/20261102120000_tasting_book.sql` changed in place: `tasting_serve` counts marks only on an aquarium serve and only aquarium slots (the water's bonus when every rod species of it is in the tank); `tasting_dish` is `not_learned` until its key fish is in the tank. Signatures unchanged. Smoke `web/supabase/tests/tasting_book_smoke.sql` adds: a cook pays no mark as the book reaches one; a cooked key fish teaches nothing.
- **Dishes (catalogue.ts):** `MealBuff` is now `Partial<Record<RodStat, number>> & { minutes }`, every meal named in the rod's six stats and small (+5% to +12% a stat); `size` (bigger fish) is gone from every meal (member_buffs.size written 0). `mealOf(source)` finds a buff's meal (name and stats) from member_buffs.source. Five key-fish dishes (TASTING.dishes): snapper chazuke, dace karaage, squid tempura (key squid, not scallop: the scallop isn't a rod fish so it has no slot), catfish kabayaki, tuna otoro (flat mushroom dropped from the karaage: no model, not caught). Numbers table in the round 3 report and below.
- **Buff on the rod:** luck stays the server's (member_buffs.luck on the cast's roll); the other five scale the rod's effects in the reel, `rods.ts withMeal` (bite: + share of `BITE_WINDOW_MS`, now exported from rods.ts; strength: drain x (1 - p); reel: fill x (1 + p); lure: wait x (1 - p); control: bar x (1 + p)), applied at the one place the new world hands MemberFishing its rod (DefaultIslandWorld). `lib/game/mealStore.ts useMeal()` reads the meal (GET /api/economy/sushi), again after a sushi or chef write, and drops it at `until`.
- **HUD buff:** kit piece `BuffChip` (components/gui/flat/index.tsx, flat.module.css `.buff`, in the showroom), `TopCluster.tsx HudBuff`, slot `.buffSlot` in DefaultIslandWorld.module.css: the right edge at 54% of the height (desktop top 401 px, the time column ends at 292 at rest and about 384 in the UI view with the big minimap and wallet; phone top 425, the column ends at 204). A slim faint column (opacity 0.5, 0.9 on hover): each stat's icon over its percent, then the minutes left; its title says it in words. Stat icons moved to `components/economy/statIcons.tsx` (`STAT_ICON`, `mealRows`), RodGear's copy deleted.
- **Phone:** seated at the bar (barSeated) the stick, Slide, Dash, Jump and the tool wheel hide; the "Tap Leave the bar" prompt merges into the Menu row as a quiet "Leave" button (desktop keeps E Leave the bar). The emote button stays. The nigiri page holds only the nigiri (the feast moved to the chef's page beside the omakase); phone dish photos 76 px (from 112) so two dishes fit a narrow panel; the hanko hides on a phone (it sat on the buttons); the put-down X moved over the menu's top right on a phone (it was off screen at right: -48px); fish thumbs get room for their counts. The book's dishes go two to a panel (book spread: The book and dishes 1-2; next: 3-4 and 5); water pages start at spread 5 (`BEFORE_PAGES`). A locked dish's hint (give its key fish to the tank, or "only a ... in the tank teaches it" when it was cooked) shows in its open action too, since a phone hides dish notes.
- **Round 1 and 2 (approved):** stamp, book, empty book, give, aquarium (club-shared), kit, choice, dish learnt and locked, numbers. Dinner service is next launch in `specs/launch/sushi-bar.md` (paragraph updated for round 3).
- **Gates (round 3):** tsc clean; vitest without the env 3747 passed, 4 skipped; with NEXT_PUBLIC_GAME_WORLD=new 3747 passed, 4 skipped; eslint clean on changed files; SQL smokes (tasting_book, game_security) pass on a throwaway PG16.
- **Evidence:** `specs/evidence/tasting-book/{desktop,phone}/tb3-*.png` by `shoot.mjs showroom book3`.

Numbers (round 3):

| Meal | Cost | Buff | Round 2 |
|---|---|---|---|
| Miso soup | 20 | Lure +5%, 15 min | Rarer +5% |
| Salmon nigiri | 40 | Luck +5%, 20 min | Rarer +10% |
| Tuna roll | 40 | Strength +8%, 20 min | Bigger +30% |
| Omakase | 150 | Luck +8%, Reel +5%, 30 min | Rarer +15%, bigger +30% |
| Bancha's feast | your epic or legendary fish | Luck +12%, Control +8%, 60 min | Rarer +35%, bigger +60% |
| Staff meal (chef's order) | the fish | Luck +5%, Bite +8%, 30 min | Rarer +10%, bigger +20% |
| Snapper chazuke (key: red snapper) | 250, snapper 1, sea bass 2 | Luck +10%, Bite +10%, 45 min | Rarer +30%, bigger +30% |
| Dace karaage (key: dace) | 200, dace 3 | Reel +10%, 40 min | proposed: bigger +50% |
| Squid tempura (key: squid) | 300, squid 1, sweet shrimp 2, scallop 1 | Lure +10%, Control +5%, 45 min | proposed (scallop): rarer +40% |
| Catfish kabayaki (key: catfish) | 500, catfish 1, freshwater goby 2 | Strength +10%, Control +10%, 60 min | proposed: rarer +50%, bigger +40% |
| Tuna otoro (key: tuna) | 600, tuna 1, horse mackerel 2, anchovy 2 | Luck +12%, Reel +8%, 60 min | proposed: rarer +60%, bigger +60% |

The book, unchanged: cook fee 100 + 5 a species cooked before; luck +1% a species for the first 20, then +0.5%, cap +40% (at 60).

## Next

1. Coordinator: review tb3-*, apply `20261102120000_tasting_book.sql` to prod after fishing-depth's catalogue seed, merge after game/fishing-depth.
2. Open for David: (a) a cooked fish can never go to the tank, so cooking any fish of a water gives up that water's 250 (the page note goes quiet then): keep, or let the full-water prize count cooked slots too; (b) the permanent luck (cap +40%) is now far above any dish (+12% at most): lower its cap to match "chill out", or keep it; (c) the menu's dishes were changed too (one vocabulary on the menu): say if any should keep "bigger fish"; (d) the buff's place (right edge, mid height) and how faint (half opacity).

## Tools and gotchas

- Smoke: `scratchpad/tasting-book/smoke.sh tasting_book_smoke.sql` (PG16 on 127.0.0.1:54331; 020_player_persistence fails in the stub, as before).
- Shots: `ONLY=desktop|phone scratchpad/tasting-book/session.sh <out> showroom counter aquarium book2 book3` under `withlock.sh devserver` (next dev on :3476, Supabase blanked, new world) runs `specs/evidence/tasting-book/shoot.mjs`. Desktop and phone together run past 10 minutes: run them as two calls. The demo's pockets need `&bag=23`.
- The held menu sways forever, so Playwright clicks inside it need `force: true`. "Cook it" has the price in its name: match `/^Cook it/`.
- `?at=` doesn't move you inside HQ: walk with `w` instead.
- The bar opens in the evening: shoot it with `at=19:30&time=evening` (the real clock decides otherwise). The first load can outlast the settle: book3 presses E until the Menu shows. The devserver lock often waits its full 20 minutes (exit 75): run the shoot in the background and wait on its output.
- The `showroom` flow's old "Tasting book (paper)" locator no longer finds its section (it times out after the buff shot); tb-showroom is stale.
