# Lane: rod-gear (rods, add-ons, the hex radar, the rarity ladder)

Worktree `.claude/worktrees/rod-gear`, branch `game/rod-gear`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **f-rods, x-shop and m4's rod shop** in `specs/launch/v1-gameplay.md`. Existing: `web/lib/game/rods.ts` (5 tiers: Flimsy, Cedar, Glass, Lighthouse, Tidewarden), `web/lib/wallet/catalogue.ts` (prices, sell prices), the shop UI, `FishingRig.tsx`, and the rarity in `web/lib/collections/roster.ts` and `fishing.ts`.

1. **The rarity ladder** for items and fish: common, uncommon, rare, epic, legendary, Divine, Contraband. Contraband is for mods and T0/T1 only; how it's earned is still open, so build the tier and gate it behind a flag. Colours in the GUI kit. Update every place rarity shows. Commit it first and report it, because other lanes use it.
2. **5 rods at launch:** from the starter through Cedar to an intermediate rod, each with 5 or 6 stats (for example bite window, line strength, luck or rare odds, cast distance, reel speed). Map the existing tier effects onto them, and show what each stat does.
3. **Add-on slots:** each rod has slots for bait and a bobber (and more later). Each add-on raises stats; for example, the lucky bobber raises luck and bait raises bite time. Add-ons are owned items. Make the existing "Lucky bobber" real.
4. **The rod shop:**
   - each rod's 3D model, turnable;
   - a hex radar chart of its stats, with the equipped add-ons' gains layered on in a different colour over the base;
   - also shown wherever you equip gear.
5. **Hollow items:** hide or replace any shop item that does nothing (the "Basic rod" with no tool, net and shovel tiers with no effect, furniture while homes are closed).

Prices go into the existing catalogue and seed, with a new migration I apply.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Round 6: David's rod data round 5 review (2026-11-04, verbatim; https://claude.ai/artifact/1sHjWWpEULGjw1m2rTgeF9)

Approved: rg5-aura, rg5-bag, rg5-models, rg5-shelf, rg5-epics ("i will check": Riptide rare and Titanium epic, both crafted at the workbench; Tempest epic from a quest or event).
- rg5-questions (redo): "make common fish up to rare as default no level up exists only like awakening some rods have 1, for training rod it has 2 awakenings, but dont show it, its supposed to be sudden. okay to unlock the training rod 35 flimsy rod fish and it triggers a quest that allows you to talk to the rod guy and he asks u to trade the flimsy rod for a training rod. no levels, only awakenings for rods. more expensive, price rods properly. yeah and say unique cenario required"
- rg5-stats (redo): "training should be lower level like similar to flimsy stats, but once you fish like 50 fish it evolves and it goes to stats of a rare, and 2nd level up to a epic, and 3rd to a legendary stats . has to fish 50, 250, 1000. make sure the epic rods dont max out too early, so i think you scale down the stats for all the rods down, to make room for legendary and divine rods stats, legendary is basically 100 and divine goes past like 110-120"
- rg5-training (redo): "on the fishing rod have the bar that has the evolution bar for fish caught thing like the training rod but only certain rare rods have that only epic+ with exception of training rod has the evolution thing, so matters more about how long u fish with a rod rather than always the rarity for late game rods, also the left right arror in the rod box ui needs to be remove same with the all arrow, removed. left right arror put very faint and small and light. also have space for a line for the passive for the rod, some rod dont have passive but like rare+ rods will have passives"
- From the fish list review (fl2-rods, approve): "glass strenght lower, the stats should make sense with the rod. passive ability exist aswell"
- David's answers (2026-11-04, asked because the notes disagreed): the Training rod has **three** awakenings, at 50, 250 and 1000 fish; **epic and up show a fish-caught bar** to the next awakening, and **the Training rod shows only its fish count** (its awakenings stay a surprise).

Round 6:
1. **No levels anywhere, only awakenings.** Delete the level code and copy ("Level 1 of 3", the ring). Training starts at about Flimsy's stats and hooks common to rare from the start; at 50, 250 and 1000 fish caught with it, it awakens to rare, then epic, then legendary stats. Its card shows only its fish count, and an awakening lands as a short surprise reveal when the fish that triggers it is landed.
2. **Epic and up awaken too**, with a fish-caught evolution bar to the next awakening on the rod card (small, in the r5 line's place), so late rods reward time fished with them. Rare and below have none (Training is the exception). Propose each epic and up rod's awakenings (how many, at how many fish, what each gives: stats, a passive, a stronger aura) for David's OK.
3. **The Training unlock:** at the 35th Flimsy-rod fish a quest starts: the rod seller asks to trade your Flimsy rod for the Training rod (the Flimsy leaves your bag). `20261102170000_rod_catches.sql` is unapplied: change it in place (no grant at the 50th; whatever the quest needs server side). The shop's ??? teaser card reads "Unique scenario required".
4. **Stats rescaled:** every rod down so epics don't max out early; legendary about 100 per stat, Divine past it (110 to 120). Each rod's numbers fit the rod (Glass's strength lower). Old and new table side by side.
5. **Passives:** rare and up have one (a few may have none); a line for it on the rod card, empty for rods without. Propose one per rare and up rod, in the six stats' vocabulary or plain rules.
6. **Prices:** higher, priced against what a player earns per hour fishing at each stage; show the reasoning in a line. Never the gem-to-money rate.
7. **Rod box UI:** remove the left and right arrows on the rod box and the "all" arrow; any left and right arrows that must stay become very faint, small and light. Say which ones stayed.
8. **The roster:** Riptide (rare, crafted), Titanium (epic, crafted) and Tempest (epic, a quest or event) join with stats in the new scale and recipes. Their models are being redone from David's references on the tool-pipeline lane with the same file names; wire the current ones.
9. Evidence ids `rg6-*`: the rod cards (Training before and after an awakening, an epic with its bar, a rare with its passive), the awakening reveal as a strip, the shop with the teaser, the quest talk, the rescaled table, desktop and phone.

## Round 5: David's rod data review (2026-11-03, verbatim; https://claude.ai/artifact/LNrapLgneyk16D14xRTVsi)

- rg4-unlock (approve)
- rg4-training (no mark): "the ui needs fixing, you dont need a whole bar to say " (the note stops there)

Build: the Training rod's level and progress move into the rod card as one small line or ring next to the stats, not a full-width bar; the same for the Fish caught line if it takes a bar too. Wire the tool-pipeline lane's new model files (`rod-carrot.glb`, `rod-precision.glb`, `rod-training.glb`, in game/tool-pipeline) in place of the stand-ins and mount `RodAura` in the shop's RodStage (see tool-pipeline's lane file). Shots of the cards before and after (ids rg5-*).

## Round 4: the new rods' data, the Training rod, the catch tracker (2026-11-02)

David's rod pitch review, verbatim (https://claude.ai/artifact/XqZK2hk32ydhYjbKFhhwFJ):
- rod-carrot (approve): "make the carrot thicket, this is uncommon rod"
- rod-precision (approve)
- rod-training (approve): "this is good, but make it like a common thats like easter egg to unlock and not a common rod you can buy, this rod also has very good satts comparable to uncommon rare, one of best starter rods and it has upgrade potential. I want you to also do a fish caught tracker for all rods so yo know how many fish you caught with a certain rod. "
- rod-ours (redo): "tide warden rod not even epic bruh not cool at all, other rods are wtv, glass rod can be cooler or just make it uncomon, cedar rod should have like leaf elements"

The tool-pipeline lane (game/tool-pipeline) models the rods in parallel: `tools/rod-carrot.glb`, `rod-precision.glb`, `rod-training.glb`, plus reworked Cedar, Glass, Tidewarden, Tempest, Titanium and Riptide. Wire to those file names; until they land, use the old rod files as stand-ins and say so.

Build:
1. **Roster entries** in `web/lib/game/rods.ts` and the catalogue for Carrot (uncommon), Precision (common) and Training (common, never sold). Stats, prices and sell values in the existing economy rules. Never write the gem-to-money rate.
2. **The Training rod as an easter egg:** hidden, unlocked by doing something (propose two or three unlocks and build the one that fits the island best; server-checked), stats comparable to uncommon and rare, one of the best starter rods, with upgrade potential: use the existing tackle and upgrade systems if they fit, otherwise propose the smallest upgrade path and build it.
3. **Per-rod catch tracker:** how many fish you've caught with each rod, counted on the server at catch time, shown on the rod's card (bag and shop). A migration (timestamped after the newest on main) if the catch rows don't already record the rod; stop before prod, the coordinator applies it.
4. Glass may move to uncommon (David: "glass rod can be cooler or just make it uncomon"): wait for his pick on the next pitch, don't move it yet.

## Status

- Round 1 (94eade9f, e35dd842): rarity ladder (cb7bed43, on main), five rods with six stats, bait and bobber slots, the rod shop, hollow items hidden. David reviewed it 2026-10-28 (below).
- **Round 2 built** on `game/rod-gear` (main merged at 581dd5b3; the build f7adcb6a, evidence and fixes 064c59ce; gates: tsc clean, vitest 3551 passed in the new world, eslint clean on changed files, SQL smoke chain clean):
  - Rod rarity: Flimsy common, Cedar uncommon, Glass rare, Lighthouse rare, Tidewarden epic (`RodTier.rarity`, lib/game/rods.ts).
  - Hook rule: a rod hooks one rung above its own rarity (`hookCap`, `canHook`). David's three examples were rare to epic, epic to legendary and legendary to divine; the coordinator applied the same pattern down the ladder. The server rolls with the same `canHook` (peaceful.ts via lib/collections/rolls.ts), so no SQL. Nothing can hook divine until a legendary rod exists.
  - The shop shelf sells rods up to rare (`onShopShelf`, `SHOP_ROD_MAX`). Tidewarden is off the shelf; its workbench recipe stays.
  - Stats are graded out of 100 (`STAT_MAX` 100, rods x10, tackle gains x10; `effects` unchanged in effect).
  - Rarity shows as a thin outline in `--ui-rarity-*` on the shop's and the bag's rod cards and on the detail stage (`rarityEdge`, the `ItemCard`/`DetailView` prop `rarity`). Divine runs `--ui-holo`.
  - Radar rebuilt as a flat kit piece (`components/gui/flat/HexRadar.tsx`):
    - big, light, thin rings in the new `--ui-chart` token;
    - an icon and value at each corner, with the stat's name and one plain line on hover or focus;
    - the build over the rod alone (faint, dashed), sliding linearly over 450 ms.
  - Slots live only on your own rod: the bag's tools shelf opens a rod in `DetailView`, with `RodSlots` (kit `GearSlot`) in the stage's bottom-right corner (`DetailView corner`). The shop has no slots.
  - What's fitted hangs from the rod tip and settles: `RodStage` in components/economy/RodGear.tsx, through `FittedModel hang`, using `rodTip` (moved to lib/game/rodTip.ts).
  - An add-on's detail shows only the add-on (its HD model) and its own radar (`TackleRadar`).
  - HD/LP split: `Tackle.model` is the HD file; `worldModel` maps it to `/assets/game/items/lp/` (lib/game/world/active.ts). Until the real models land, both lp files are copies of the HD ones.
  - Kit: divine badge text is white (`--ui-on-divine`). `--gui-holo` is replaced by `--ui-holo`, and `--gui-rarity-divine` is now main-quest's purple. The themes carry main-quest's exact rarity block, so that merge is trivial. The other `--gui-rarity-*` tokens (the badges and tiles David approved) stay.
  - Migrations: `20261028155000_rod_tackle_slots` (re-timestamped, unapplied) and `20261029020457_catalogue_seed` (regenerated, unapplied). Both are in the chain in specs/evidence/launch-fixes/sql-smoke.sh, with the new `rod_tackle_slots_smoke.sql`. 033 and taught_tools smokes now follow the hollow tools.
  - Evidence: `specs/evidence/rod-gear/r2/` (shots.mjs makes them). The round-1 shots in `specs/evidence/rod-gear/` are the "before" set.

- **Round 4 built** on `game/rod-gear` (on 1ae98ff6; gates: tsc clean, full vitest 3744 passed + 1 load-timeout flake (shoreField, passes alone), eslint clean on changed files, SQL smoke chain clean incl. the new `rod_catches_smoke.sql`; the world_chat smoke's "the rest" assert fails on origin/main's own chain too (checked 1ae98ff6), untouched; migrations re-timestamped to 170000/170100 after tasting-book's 120000):
  - Roster (lib/game/rods.ts, weakest first): Flimsy, **Precision** (common, shop 200), Cedar, **Carrot** (uncommon, shop 550), **Training** (common, `found`, never sold), Glass, Lighthouse, Tidewarden. Tools key by rod key now (`rodByKey`, `heldRig`, `ownedRig(key, …)`); `rodByTier` is the first rod of a tool tier. `rodOf` in RodGear.tsx is gone (use `rodByKey`).
  - Stand-in art: `STAND_IN` (rods.ts) gives Precision the Flimsy's model and icon, Carrot the Cedar's, Training the Glass's (tools.ts, icons/keys.ts). When tool-pipeline's `tools/rod-precision.glb`, `rod-carrot.glb`, `rod-training.glb` and their icons land: delete the lines, then `node scripts/gen-seeds.mjs` (the sprite_urls). rods.test.ts checks every rod's model and icon file exists.
  - The Training rod (`TRAINING`): the Flimsy rod's 50th landed fish finds it (granted in collections_land, server-side; the land reply says `unlocked`, the client shows a "Found: the Training rod" card: `rodNews` in useFishingSession.ts). It trains: +5 to every stat at 25, 75 and 150 fish landed with it (`trained`, `trainingLevel`), on the server's roll and the client's reel; a level-up toasts. Base 205 total (Carrot 170, Glass 230), fully trained 295 (Lighthouse 300). Off sale (`FOUND_ONLY` in RETIRED); the shop shows it only to its finder, pill "Found".
  - Catch tracker: `catch_rolls.rod_key` + `rod_catches` (owner-read RLS, written only by collections_land). Shown on the bag's and the shop's rod cards ("37 fish caught", "Owned · 37 fish") and the rod details' specs (Fish caught, Training level). `InventoryView.catches`, `ShopView.catches`, `rodCatches()` on both stores.
  - Migrations (unapplied, stop for the coordinator): `20261102170000_rod_catches.sql`, `20261102170100_catalogue_seed.sql` (the three rods' rows and icons). Both in the sql-smoke chain (with main's 20261101230000_profile_pronouns, which was missing from it). Apply the migration before the code deploys: the new `collections_cast` takes `p_rod` (old 4-arg calls still work).
  - Evidence: `specs/evidence/rod-gear/r4/` (shots.mjs makes them).

- **Round 5 built** on `game/rod-gear` (origin/main b56f3c36 and game/tool-pipeline merged; gates: tsc clean, full vitest 3765 passed + the known shoreField timeout flake (passes alone), eslint clean on changed files, SQL smoke chain clean except the world_chat "the rest" assert that fails on origin/main too):
  - The rod card's record is one small line under the title (`RodRecord`, RodGear.tsx): "31 fish caught", and on the Training rod a small ring of the way to its next level with "Level 1 of 3 · 31 fish caught" (hover: fish to the next). The full-width specs strip (`rodFacts`) is gone from the shop's and the bag's rod details. The shop's rod radar is 340 wide so the column fits.
  - `STAND_IN` deleted (rods.ts, tools.ts, icons/keys.ts, wallet/service.ts, rods.test.ts): Precision, Carrot and Training use `tools/rod-precision|carrot|training.glb` and their own icons. The seed `20261102170100_catalogue_seed.sql` is regenerated (three sprite_urls), still unapplied, same name.
  - `RodAura` mounts in `FittedModel` (components/economy/ItemViewer.tsx), which the shop's detail and the bag's `RodStage` both use: a rod whose GLB names a `rodFx` wears its effect there; such a rod fits 22% smaller to leave the aura room. Only Tidewarden (rod-5) has an effect among the roster's eight; Riptide, Tempest and Titanium (models and effects landed) are not in the roster yet.
  - Dev harness: `/dev/economy?view=bag&tide=1` puts a Tidewarden rod in the bag.
  - Evidence: `specs/evidence/rod-gear/r5/` (`rg5-before-*` are the round-4 shots, `rg5-*` after; shots.mjs makes them).

- **Round 6 built** on `game/rod-gear` (origin/main 18362223 merged; gates: tsc clean, full vitest 3787 passed + 1 real failure fixed after (toolWheel.test.ts, the Training rod now tier 1; passes alone), no load timeouts, eslint clean on changed files, SQL smoke chain clean except the known world_chat "the rest" assert):
  - **No levels.** `trained`, `trainingLevel`, `toNextLevel`, `TRAINING.levels/step/unlock` and the level ring are deleted. `awakened(rod, catches)` (rods.ts): a rod's `awakenings` (`at`, `base`, `looks`, optional `hooks` and `passive`) replace its stats as it lands fish. `RodTier` gains `hooks`, `passive`, `awakenings`, `stage`; `canHook` reads `hooks`.
  - Training: about the Flimsy's stats (12 each), hooks up to rare; awakens at 50, 250, 1000 to rare (36 to 38), epic (56 to 62), legendary (94 to 100, hooks divine, passive Seasoned) stats. Secret (`secretAwakenings`): its card shows only its fish count; the landing fish pops the reward card "Awakened!" in the new rung's outline (`rodNews`, `tsi:gift` now takes `rarity`).
  - Epics (Titanium, Tidewarden, Tempest) awaken in the open: +6 every stat at 200 fish, +12 at 800 (Tidewarden's second also widens its passive). **Proposed, built, awaiting David's OK.** The card shows a 64 px bar "120 / 200 fish to awaken". A stronger aura per awakening is proposed only (RodAura takes no strength yet).
  - Passives (rare and up, `inPlay`): Glass Sunlit (+10 control, sunny), Riptide Current (+10 reel, sea), Lighthouse Beacon (+10 luck, 8 pm to 6 am), Titanium Steel line (+10 strength, river and pond), Tidewarden Tide keeper (+10 strength, sea), Tempest Storm born (+10 reel and luck, rain). Applied on the server's roll (rolls.ts fishRoll) and the client's reel (useFishingSession). The card's passive line is kept (empty) on rods without one.
  - Rescale: `STAT_MAX` 120 (the radar's ring and the cap). Table: `specs/evidence/rod-gear/r6/rg6-table.png`. Glass's strength 16 is its weakest stat.
  - The Training trade: at the Flimsy's 35th fish a toast and the tracker's quest "The rod seller" (`trainingQuest`, DefaultIslandWorld's quests); E at the tackle counter opens `RodSellerTalk` (components/game) instead of the counter; "Trade the Flimsy rod" calls POST /api/economy/rod-trade, `rod_training_trade` (owning the Training rod retires the Flimsy everywhere: `ownsRod` in rods.ts, tools.ts `ownsTool`, the shop shelf). Store method `tradeForTraining` on both economy stores and transports; error `not_ready`.
  - Shop: a found rod you lack shows as a teaser card (service.ts `TEASER`: "???", "Unique scenario required", silhouette via the kit's `not-found` cover, not clickable; no ref or slug sent). Tempest is found-only and epic, so off the shelf.
  - Rod box: `DetailView quiet` (kit): All without its arrow; previous and next as faint 16 px chevrons at the stage's sides (stayed, for paging). Used by the shop's rod detail and the bag's rod detail.
  - Prices by hours of fishing (about 80 fish an hour: 1,000 coins an hour on a common, 1,250 uncommon, 1,900 rare): Precision 1,000 (was 200), Cedar 2,500 (400), Carrot 3,000 (550), Glass 6,000 (1,200); nominal: Riptide 6,500, Lighthouse 8,000 (3,000), Titanium 14,000, Tidewarden 16,000 (6,000), Training 2,500 (900), Tempest 16,000.
  - Roster: Riptide (rare, tier 3, crafted: wood 6, iron 2, whelk 2, mahi-mahi 1), Titanium (epic, tier 5, crafted: iron 8, gold 2, crystal 2, sturgeon 1), Tempest (epic, tier 5, found, catalogue row 1004, FOUND_ONLY). Current models wired by name (`tools/rod-riptide|titanium|tempest.glb`, their icons and rodFx).
  - Migrations (unapplied, same names and order): `20261102170000_rod_catches.sql` (no grant in collections_land; new `rod_training_trade(uuid)`, service role only) and `20261102170100_catalogue_seed.sql` (regenerated: prices, Tempest, Training copy, and now a crafting block for the two crafted rods). Smoke: `rod_catches_smoke.sql` section 2 tests the trade.
  - Evidence: `specs/evidence/rod-gear/r6/` (shots.mjs makes them).

## David's decisions

- 2026-10-28 review (verbatim in the coordinator's round-2 prompt): rarity outline on shop cards (common grey, uncommon green, rare blue, epic purple, legendary yellow, divine purple holo); shop sells up to rare rods; hook caps by rod rarity; Flimsy common, Lighthouse rare; divine text white; gui-tiles approved; radar redone (bigger, minimal, lighter, icons with hover lines at the corners, out of 100, the base faint behind the build, linear slide); bait and bobber slots bottom-right of your own rod's square only, fitted ones show on the rod model with a settle; the bobber's detail shows only the bobber with its own radar; bobber and bait to be remodelled properly in Blender (HD for the shop, LP on the rod; the lucky bobber a four-leaf clover), **waiting on David's references** (coordinator asked him).

## Next

1. Coordinator: apply `20261102170000_rod_catches` then `20261102170100_catalogue_seed` (before the code deploys); David reviews `specs/evidence/rod-gear/r6/`.
2. David's OK on the proposals: the epics' awakenings (+6 at 200, +12 at 800), each passive, the prices; how the Tempest rod is earned (the quest or event isn't built: it's found-only, never sold).
3. A stronger aura per awakening, if David wants it: RodAura needs a strength input (tool-pipeline's file).
4. Glass to uncommon only on David's pick (round 4 item 4). Riptide, Titanium and Tempest's redone models land on tool-pipeline with the same names: nothing to rewire.
5. When references arrive: model the base bobber, the lucky four-leaf-clover bobber and the bait in Blender (design bible Models).

## Tools and gotchas

- Locks are contended: there is no queue file (the coordinator removed it); retry `withlock.sh heavy|devserver` in a loop while it exits 75, and keep each hold to one short batch.
- `node scripts/gen-seeds.mjs` writes the catalogue seed migration after a catalogue change; a hand migration that widens a check must sort before it.
- Dev harness: `/dev/economy?view=overlay&section=rods` (the rod shop) and `/dev/economy?view=bag` (the bag's tools: Cedar and Glass rods, the lucky bobber on, sweet bait owned), memory store.
- Shots: `specs/evidence/rod-gear/r2/shots.mjs` (PW=playwright index.mjs from ~/.npm/_npx, SHELL_BIN=the cached chromium_headless_shell-1217, BASE=dev server). The site's intro curtain (`.ld-overlay`) waits on window load and covers dev pages: the script hides it.
- `/dev/economy` seeds rod catches (Flimsy 50, Cedar 37, Glass 12, Training `&tc=` default 31, Tidewarden `&tdc=` default 120) and trades for the Training rod (`&found=0`: not yet, the quest is on); `?view=awaken` plays the Training rod's awakening through `rodNews`; `?view=trade&found=0` the rod seller's ask. The harness funds enough coins for the new prices.
- The SQL smoke chain re-applies the backpack migration inside backpack_smoke, which brings back the 4-arg `collections_cast`: rod_catches_smoke drops it first.
- Memory stores: `m.caught(member, rod, n)` seeds rod_catches (both the collections and the economy store).
- The vitest seed check fails until `node scripts/gen-seeds.mjs` runs after any catalogue text change; delete the lane's own unapplied seed first, and update the chain in launch-fixes/sql-smoke.sh.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/rod-gear /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
