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
  - Migrations: `20261028160000_rod_tackle_slots` (re-timestamped, unapplied) and `20261029020457_catalogue_seed` (regenerated, unapplied). Both are in the chain in specs/evidence/launch-fixes/sql-smoke.sh, with the new `rod_tackle_slots_smoke.sql`. 033 and taught_tools smokes now follow the hollow tools.
  - Evidence: `specs/evidence/rod-gear/r2/` (shots.mjs makes them). The round-1 shots in `specs/evidence/rod-gear/` are the "before" set.

## David's decisions

- 2026-10-28 review (verbatim in the coordinator's round-2 prompt): rarity outline on shop cards (common grey, uncommon green, rare blue, epic purple, legendary yellow, divine purple holo); shop sells up to rare rods; hook caps by rod rarity; Flimsy common, Lighthouse rare; divine text white; gui-tiles approved; radar redone (bigger, minimal, lighter, icons with hover lines at the corners, out of 100, the base faint behind the build, linear slide); bait and bobber slots bottom-right of your own rod's square only, fitted ones show on the rod model with a settle; the bobber's detail shows only the bobber with its own radar; bobber and bait to be remodelled properly in Blender (HD for the shop, LP on the rod; the lucky bobber a four-leaf clover), **waiting on David's references** (coordinator asked him).

## Next

1. David's review of round 2 (`specs/evidence/rod-gear/r2/`, the hook-rule table).
2. When references arrive: model the base bobber (variants edit it), the lucky four-leaf-clover bobber and the bait in Blender (design bible Models), HD to `public/assets/game/items/`, LP to `items/lp/`.

## Tools and gotchas

- Locks are contended: there is no queue file (the coordinator removed it); retry `withlock.sh heavy|devserver` in a loop while it exits 75, and keep each hold to one short batch.
- `node scripts/gen-seeds.mjs` writes the catalogue seed migration after a catalogue change; a hand migration that widens a check must sort before it.
- Dev harness: `/dev/economy?view=overlay&section=rods` (the rod shop) and `/dev/economy?view=bag` (the bag's tools: Cedar and Glass rods, the lucky bobber on, sweet bait owned), memory store.
- Shots: `specs/evidence/rod-gear/r2/shots.mjs` (PW=playwright index.mjs from ~/.npm/_npx, SHELL_BIN=the cached chromium_headless_shell-1217, BASE=dev server). The site's intro curtain (`.ld-overlay`) waits on window load and covers dev pages: the script hides it.
- The vitest seed check fails until `node scripts/gen-seeds.mjs` runs after any catalogue text change; delete the lane's own unapplied seed first, and update the chain in launch-fixes/sql-smoke.sh.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/rod-gear /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
