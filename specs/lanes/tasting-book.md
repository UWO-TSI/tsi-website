# Lane: tasting-book (what sushi does)

Worktree `.claude/worktrees/tasting-book`, branch `game/tasting-book`, cut from `game/fishing-depth` at 0db249b4 (it needs that branch's new menu layout; fishing-depth merges to main first, then this one). Agent type `uwotsi-lane`. Dev port 3476.

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

Round 2 built (2026-11-02), waiting on the coordinator's review. Head: the last `[build]` commit on `game/tasting-book`; `game/fishing-depth` 34a84a7d is merged in (conflicts in FlatPieces.tsx, collectionsDemo.ts, service.ts imports resolved: the showroom keeps fishing's caption-less layout with the book block under the menu). The migration is NOT applied.

- **Migration (not applied, coordinator applies):** round 1's file was changed in place and renamed to `web/supabase/migrations/20261102120000_tasting_book.sql` (after fishing-depth's `20261102031338_catalogue_seed.sql`, which merges first; no second migration stacked). `tasting_book`, `tasting_serves` as round 1. `tasting_serve(member, species, way, fee, fee_step, marks, mark_pay, full_pay, key)`: the slot must be empty for both ways (`already_in_book`), cook pays `fee + fee_step x cooked so far` (summed under the member's lock), no meal buff any more. New `tasting_dish(member, dish, price, unlock, ingredients[], luck, size, until, key)`: `not_learned` until `unlock` is stamped cooked, takes each ingredient (collections_take_one), pays, sets member_buffs; replays through `sushi_orders`. Both service role only. It also drops round 1's tasting_serve signature if a local copy ran it. Smoke `web/supabase/tests/tasting_book_smoke.sql` (cook, dish, aquarium, RLS) passes on a throwaway PG16 with fishing_tasks_sushi and game_security.
- **The permanent buff is no column:** it is counted from the stamps. `bookLuck(cooked)` (rules.ts) adds to every cast's luck in `lib/collections/{supabaseStore,memoryStore}.ts buff()` (the meal's luck plus the book's; the Supabase read counts `tasting_book` way 'cooked' beside member_buffs, and a failed read rolls plain). It can never drift from the book, and a curve change reprices everyone at once.
- **Numbers (TASTING, catalogue.ts):** fee `tastingFee(n) = 100 + 5n` (n = species cooked before): 100, 150 at 10, 225 at 25, 350 at 50, 550 at 90; all 91 cooked cost 29,575 coins. Luck: +1% rarer fish a species for the first 20, then +0.5% each, cap +40% (reached at 60). It is the same `luck` a meal adds (rare-and-up fish weigh `1 + luck` more). Marks and full waters unchanged (150 at 10, 400 at 25, 250 a water). Dishes: `TASTING.dishes`, one built, Snapper chazuke (red snapper's stamp; a red snapper and two sea bass; 250 coins; rarer and bigger +30% for 45 min). Repeat cooks: none, a stamped fish is not cooked again (duplicates go into dishes or the sell sheet).
- **Server:** `serveFish(store, m, {fish, way, key})` (no clock now), `orderDish` also serves the book's dishes (`store.bookDish`), error `not_learned`; routes unchanged (`/api/economy/tasting`, `/api/economy/sushi`). The `?collections=demo` shim mirrors both; `&dish=1` puts the chazuke's ingredients in the pockets.
- **Menu (SushiSheets.tsx MenuPickup):** "Bancha's nigiri" shows the next fee and the next step of luck ("For good"), lists only fish with an empty slot; the choice says when a fish teaches a dish. Two new panels before the water pages: "The book" (count cooked, luck for good, the next fee, the milestones, moved from the river page) and "From the book" (each dish: learnt or "Cook a Red Snapper for the book and Bancha learns it", its ingredients as kit Thumbs, dimmed when short, Order). `pageSpread` offset is 6 now.
- **Round 1 (approved):** stamp, book, empty book, give, aquarium (club-shared, `Aquarium.tsx Gifts`), kit, questions. Dinner service is in `specs/launch/sushi-bar.md` as next launch.
- **Gates (round 2):** tsc clean; vitest without the env 3742 passed, 4 skipped; with NEXT_PUBLIC_GAME_WORLD=new 3741 passed, 1 timed out under load (shoreField village, 5.98 s of 5 s; passes alone), 4 skipped; eslint clean on changed files; SQL smokes pass.
- **Evidence:** `specs/evidence/tasting-book/{desktop,phone}/tb2-*.png` by `shoot.mjs book2`.

## Next

1. Coordinator: review tb2-*, apply `20261102120000_tasting_book.sql` to prod after fishing-depth's catalogue seed, merge after game/fishing-depth.
2. Open for David: the dish list beyond the chazuke (proposals in the round 2 report); whether every species should teach a dish or only some; whether the aquarium should also give the luck (today it does not, so cooking is the way to the buff and the tank is the free way to the milestones).

## Tools and gotchas

- Smoke: `scratchpad/tasting-book/smoke.sh tasting_book_smoke.sql` (PG16 on 127.0.0.1:54331; 020_player_persistence fails in the stub, as before).
- Shots: `ONLY=desktop|phone scratchpad/tasting-book/session.sh <out> showroom counter aquarium book2` under `withlock.sh devserver` (next dev on :3476, Supabase blanked, new world) runs `specs/evidence/tasting-book/shoot.mjs`. Desktop and phone together run past 10 minutes: run them as two calls. The demo's pockets need `&bag=23`.
- The held menu sways forever, so Playwright clicks inside it need `force: true`. "Cook it" has the price in its name: match `/^Cook it/`.
- `?at=` doesn't move you inside HQ: walk with `w` instead.
