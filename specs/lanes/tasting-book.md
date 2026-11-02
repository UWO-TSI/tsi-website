# Lane: tasting-book (what sushi does)

Worktree `.claude/worktrees/tasting-book`, branch `game/tasting-book`, cut from `game/fishing-depth` at 0db249b4 (it needs that branch's new menu layout; fishing-depth merges to main first, then this one). Agent type `uwotsi-lane`. Dev port 3476.

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

Round 1 built (2026-11-01), waiting on the coordinator's review; the migration is NOT applied. Head: see the last `[build]` commit on `game/tasting-book`.

- **Migration (not applied, coordinator applies):** `web/supabase/migrations/20261101120000_tasting_book.sql`: `tasting_book` (member, species, way cooked|aquarium; owner reads), `tasting_serves` (replays), `tasting_serve(...)` service role only: takes one unlocked fish (collections_take_one), cook pays the fee ('shop') and sets member_buffs source 'tasting', stamps the first time; aquarium fills an empty slot only (`already_in_book`); a newly filled slot pays the count marks and a full water once ('quest'). Fee, buff and marks come from TS (`TASTING`, lib/wallet/catalogue.ts) and are bounded in SQL. Smoke `web/supabase/tests/tasting_book_smoke.sql` passes on a throwaway PG16 after every migration (with fishing_tasks_sushi and game_security smokes).
- **Server:** `tastingPages`, `tastingWater`, `tastingMarks` (rules.ts); `EconomyStore.tasting/aquarium/serve` (memory and Supabase); `tastingView`, `serveFish`, `AQUARIUM_MAX` 12 (service.ts); `GET/POST /api/economy/tasting`; transports; the `?collections=demo` shim answers it (five slots stamped, one in the aquarium, five club gifts).
- **Numbers (TASTING):** fee 10 coins, buff rarer +10% and bigger +10% for 20 min, marks 10 slots 150 coins and 25 slots 400 coins, each full water 250 coins. Pages: River 30, Sea 44 (34 fish and 10 sea creatures), Pond 13 ("Opens with the mountain" while the pond is shut), Cliff pools 4 ("Opens later": no water has them yet).
- **Counter (SushiSheets.tsx MenuPickup):** "Bancha's nigiri" sits with the feast under "Bring your own"; open it, pick a fish from your bag (kit Thumbs), then "Cook it" (fee) or "For the aquarium" (only for an empty slot). After a serve the menu turns to that water's page (`FoldedMenu` `handle`, `FoldedMenuHandle.turn`) and the stamp presses down; milestones pop the reward card (`tsi:gift`, the coin).
- **Book (paper.tsx kit, in the showroom):** `BookPage`, `BookSlot` (empty ink shadow, cooked with the hanko, aquarium with a wave mark, `fresh` press), `BookMarks`; four back pages after the menu's four.
- **Aquarium:** club-shared (HQ is the club's building, and the museum's tanks are club-wide too): `Aquarium.tsx` `Gifts` swims the newest 12 gifted species as their own models on `giftPaths` (hqAquarium.ts), tank-lit.
- **Also:** dinner service written up as next launch in `specs/launch/sushi-bar.md` with David's quote; a selected kit Thumb now keeps its ring while hovered (pieces.module.css).
- **Gates:** tsc clean; vitest with NEXT_PUBLIC_GAME_WORLD=new 3736 passed, 1 failed (active.test.ts listed DISH_ART against SUSHI_MENU; fixed to include the tasting dish, that file passes both ways), and without it 3737 passed, 4 skipped; eslint clean on every changed file; SQL smokes pass. No perf:check: no bench scene covers HQ's interior (v2, cafe, ruins-summoner), so it could not measure the gifts (at most 12 fish models in HQ, a draw or two each).
- **Evidence:** `specs/evidence/tasting-book/{desktop,phone}/tb-*.png` (palette-quantised), shot by `shoot.mjs`.
- **Skipped (no such thing in the economy yet):** titles, the home bar stool (homes closed, no stool item), the rod part (waits for the rod roster). Milestones pay coins only.

## Next

1. Coordinator: review the evidence, apply `20261101120000_tasting_book.sql` to prod, merge after game/fishing-depth.
2. Open questions for David: should the feast also stamp its species; should the aquarium show the giver's world name; cliff pools have no water yet; should the HQ tank's E line mention the gifts.

## Tools and gotchas

- Smoke: `scratchpad/tasting-book/smoke.sh tasting_book_smoke.sql` (PG16 on 127.0.0.1:54331; 020_player_persistence fails in the stub, as before).
- Shots: `ONLY=desktop|phone scratchpad/tasting-book/session.sh <out> showroom counter aquarium` under `withlock.sh devserver` (next dev on :3476, Supabase blanked, new world) runs `specs/evidence/tasting-book/shoot.mjs`. Desktop and phone together run past 10 minutes: run them as two calls. The demo's pockets need `&bag=23`.
- The held menu sways forever, so Playwright clicks inside it need `force: true`. "Cook it" has the price in its name: match `/^Cook it/`.
- `?at=` doesn't move you inside HQ: walk with `w` instead.
